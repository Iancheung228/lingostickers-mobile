import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Heart, MoreHorizontal, Mic, Play, Square } from 'lucide-react-native';
import Button from '@/components/ui/Button';
import StickerImageFallback from '@/components/StickerImageFallback';
import { CardBack } from '@/components/CardView';
import { useToast } from '@/components/ToastProvider';
import { usePendingDeletes } from '@/components/PendingDeleteProvider';
import { useVoiceTake } from '@/hooks/useVoiceTake';
import { showMenu } from '@/lib/actionMenu';
import type { EditTarget } from '@/lib/cardEdit';
import { saveStickerToPhotos, shareSticker } from '@/lib/exportSticker';
import { haptic } from '@/lib/haptics';
import { languageLabel } from '@/lib/languages';
import { dueAtMs, formatInterval, START_EASE } from '@/lib/review';
import { speak, speakAsync, stopSpeaking } from '@/lib/speech';
import { supabase } from '@/lib/supabase';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import IconButton from '@/components/ui/IconButton';
import type { Sticker } from '@/lib/types';
import { colors, e1, fonts, radii, spacing, stickerShadow, type, MIN_TAP } from '@/constants/theme';

// The card as a reference page (A-card 6): it opens on the ANSWER, not the
// quiz. Photo hero, the same back body the study loop shows, a Progress block
// from the card's own columns, and a sticky "Test me" that turns it into a
// quiz. Every field is tap-to-edit; there is no flip gesture here, so a whole
// field can be the target (lesson #9).

const HERO_HEIGHT = 280;
const HOLD_MS = 150;

/** The columns "Reset progress" and "Undo" write: the scheduler's whole state. */
const SCHEDULE_COLUMNS = [
  'ease_factor', 'interval_days', 'learning_step', 'due_at', 'review_count', 'lapses', 'last_reviewed_at',
] as const;

const shortDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

interface CardDetailProps {
  sticker: Sticker;
  imageUrl: string | null;
  onClose: () => void;
  onEdit: (target: EditTarget) => void;
  onTest?: () => void;
  onUpdate?: (id: string, patch: Partial<Sticker>) => void;
  /// Fired once the card is on its way out (undo toast up), so the screen
  /// behind drops it from its list.
  onDeleted?: () => void;
  /// Present only when opened from a board: unpin from that one board.
  onRemoveFromBoard?: { boardName: string; remove: () => void | Promise<void> };
  /// Opened over a study session: no Delete, no Test me.
  embedded?: boolean;
  /// Whether the page is scrolled to its top: pull-down-to-close only starts there.
  onAtTop?: (atTop: boolean) => void;
}

export default function CardDetail({
  sticker, imageUrl, onClose, onEdit, onTest, onUpdate, onDeleted, onRemoveFromBoard, embedded, onAtTop,
}: CardDetailProps) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { deleteWithUndo } = usePendingDeletes();
  const voice = useVoiceTake(sticker, onUpdate);
  const [busy, setBusy] = useState(false);

  // ── favourite: optimistic, reverted with a toast on failure ──
  const toggleFavorite = useCallback(async () => {
    const next = !sticker.is_favorite;
    haptic.tap();
    onUpdate?.(sticker.id, { is_favorite: next });
    const { error } = await supabase.from('stickers').update({ is_favorite: next }).eq('id', sticker.id);
    if (error) {
      onUpdate?.(sticker.id, { is_favorite: !next });
      toast.show({ kind: 'error', message: "Couldn't update the favourite. Try again." });
    }
  }, [sticker.id, sticker.is_favorite, onUpdate, toast]);

  // ── export: one at a time, both buttons spin off the same download ──
  const runExport = async (kind: 'save' | 'share') => {
    if (busy) return;
    setBusy(true);
    try {
      const onError = (message: string) => { haptic.error(); toast.show({ kind: 'error', message }); };
      const ok = kind === 'save' ? await saveStickerToPhotos(sticker, onError) : await shareSticker(sticker, onError);
      if (ok && kind === 'save') toast.show({ kind: 'success', message: 'Saved to Photos. Long-press it there to lift it out as a chat sticker.' });
    } catch {
      toast.show({ kind: 'error', message: "Couldn't export that sticker. Try again." });
    } finally {
      setBusy(false);
    }
  };

  // ── reset progress: confirm, then an undo toast ──
  const writeSchedule = async (patch: Partial<Sticker>) => {
    onUpdate?.(sticker.id, patch);
    const { error } = await supabase.from('stickers').update(patch).eq('id', sticker.id);
    return !error;
  };
  const resetProgress = () => {
    Alert.alert(
      `Reset progress for “${sticker.word}”?`,
      'It comes back as a new card.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            const before = Object.fromEntries(SCHEDULE_COLUMNS.map(k => [k, sticker[k]])) as Partial<Sticker>;
            const ok = await writeSchedule({
              ease_factor: START_EASE, interval_days: 0, learning_step: null, due_at: null,
              review_count: 0, lapses: 0, last_reviewed_at: null,
            });
            if (!ok) {
              onUpdate?.(sticker.id, before);
              toast.show({ kind: 'error', message: "Couldn't reset that card. Try again." });
              return;
            }
            toast.show({
              kind: 'undo',
              message: 'Progress reset',
              action: { label: 'Undo', onPress: () => { void writeSchedule(before); } },
            });
          },
        },
      ],
    );
  };

  const removeFromBoard = () => {
    if (!onRemoveFromBoard) return;
    const { boardName, remove } = onRemoveFromBoard;
    // Not destructive (the card stays in the collection), so no confirm: say what
    // happened instead.
    void (async () => {
      await remove();
      haptic.tap();
      onClose();
      toast.show({ kind: 'info', message: `Removed from “${boardName}”. It's still in your collection.` });
    })();
  };

  // The action sheet's Delete row IS the confirm. Delete is deferred behind an
  // undo toast, and the card is hidden from every list in the meantime.
  const deleteCard = () => {
    deleteWithUndo(sticker);
    onDeleted?.();
    onClose();
  };

  const openMenu = () => {
    haptic.select();
    showMenu([
      { label: sticker.is_favorite ? 'Remove from favourites' : 'Favourite', onPress: toggleFavorite },
      ...(sticker.image_path ? [
        { label: 'Share', onPress: () => runExport('share') },
        { label: 'Save to Photos', onPress: () => runExport('save') },
      ] : []),
      ...(onRemoveFromBoard ? [{ label: `Remove from “${onRemoveFromBoard.boardName}”`, onPress: removeFromBoard }] : []),
      ...((sticker.review_count ?? 0) > 0 ? [{ label: 'Reset progress', onPress: resetProgress }] : []),
      ...(embedded ? [] : [{ label: 'Delete card', onPress: deleteCard, destructive: true }]),
    ]);
  };

  const reviews = sticker.review_count ?? 0;
  const status = reviews === 0 ? 'New card' : `Reviewed ${reviews} ${reviews === 1 ? 'time' : 'times'}`;

  return (
    <View style={styles.page}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: (onTest && !embedded ? TEST_ME_HEIGHT + 24 + 12 : 24) + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        onScroll={e => onAtTop?.(e.nativeEvent.contentOffset.y <= 0)}
        scrollEventThrottle={16}
      >
        <View style={[styles.hero, { height: HERO_HEIGHT + insets.top, paddingTop: insets.top }]}>
          {sticker.image_path && imageUrl ? (
            <View style={[styles.heroImage, stickerShadow]}>
              <Image
                source={{ uri: imageUrl, cacheKey: sticker.image_path }}
                cachePolicy="memory-disk"
                contentFit="contain"
                transition={150}
                style={styles.fill}
              />
            </View>
          ) : (
            <StickerImageFallback sticker={sticker} size={96} />
          )}
        </View>

        <View style={styles.body}>
          <Text style={styles.status} maxFontSizeMultiplier={type.small.maxFontSizeMultiplier}>
            {languageLabel(sticker.language)} · {status}
          </Text>
          <CardBack
            card={sticker}
            variant="detail"
            onSpeak={() => speak(sticker.word, sticker.language)}
            onEdit={onEdit}
          />
          <Text style={styles.editNote} maxFontSizeMultiplier={type.small.maxFontSizeMultiplier}>Tap a field to edit it.</Text>

          <Text style={styles.section} maxFontSizeMultiplier={type.small.maxFontSizeMultiplier}>Progress</Text>
          <ProgressBlock sticker={sticker} />

          <Text style={styles.section} maxFontSizeMultiplier={type.small.maxFontSizeMultiplier}>Say it yourself</Text>
          <CompareBlock sticker={sticker} voice={voice} />
        </View>
      </ScrollView>

      {/* Floating controls, drawn over the hero. */}
      <View style={[styles.topRow, { top: insets.top + 8 }]} pointerEvents="box-none">
        <Disc onPress={onClose} label="Close this card"><ChevronLeft size={24} strokeWidth={1.75} color={colors.inkDark} /></Disc>
        <View style={styles.topRight}>
          <Disc onPress={toggleFavorite} label={sticker.is_favorite ? 'Remove from favourites' : 'Add to favourites'} selected={sticker.is_favorite}>
            <Heart
              size={22} strokeWidth={1.75}
              color={sticker.is_favorite ? colors.terra : colors.inkDark}
              fill={sticker.is_favorite ? colors.terra : 'none'}
            />
          </Disc>
          <Disc onPress={openMenu} label="More actions"><MoreHorizontal size={22} strokeWidth={1.75} color={colors.inkDark} /></Disc>
        </View>
      </View>

      {!!onTest && !embedded && (
        <View style={[styles.sticky, { paddingBottom: insets.bottom + 12 }]} pointerEvents="box-none">
          {/* A short fade so content slides under the button instead of being sliced by it. */}
          <View style={styles.fade} pointerEvents="none"><Svg width="100%" height="100%" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="testMeFade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.sky} stopOpacity="0" />
                <Stop offset="0.7" stopColor={colors.sky} stopOpacity="1" />
                <Stop offset="1" stopColor={colors.sky} stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#testMeFade)" />
          </Svg></View>
          <Button label="Test me" onPress={onTest} style={styles.testMe} />
        </View>
      )}
    </View>
  );
}

const TEST_ME_HEIGHT = 52; // Button's height
const FADE_HEIGHT = 60;

function Disc({ onPress, label, children, selected }: {
  onPress: () => void; label: string; children: React.ReactNode; selected?: boolean;
}) {
  return <IconButton onPress={onPress} label={label} selected={selected}>{children}</IconButton>;
}

// ── Progress (A-card 6): everything the scheduler already stores ──
function ProgressBlock({ sticker }: { sticker: Sticker }) {
  const reviews = sticker.review_count ?? 0;
  if (reviews === 0) {
    return (
      <View style={styles.progressCard}>
        <Text style={styles.notReviewed} maxFontSizeMultiplier={type.body.maxFontSizeMultiplier}>Not reviewed yet</Text>
      </View>
    );
  }
  const due = dueAtMs(sticker);
  const cells: [string, string][] = [
    ['Interval', sticker.learning_step != null || !sticker.interval_days ? 'Learning' : formatInterval(sticker.interval_days)],
    ['Ease', `${Math.round((sticker.ease_factor ?? START_EASE) * 100)}%`],
    ['Lapses', `${sticker.lapses ?? 0}`],
    ['Reviews', `${reviews}`],
    ['Due', due <= Date.now() ? 'Now' : shortDate(due)],
    ['Last', sticker.last_reviewed_at ? shortDate(new Date(sticker.last_reviewed_at).getTime()) : '—'],
  ];
  return (
    <View style={[styles.progressCard, styles.progressGrid]}>
      {cells.map(([label, value]) => (
        <View key={label} style={styles.progressCell} accessible accessibilityLabel={`${label}, ${value}`}>
          <Text style={styles.progressValue} maxFontSizeMultiplier={type.data.maxFontSizeMultiplier}>{value}</Text>
          <Text style={styles.progressLabel} maxFontSizeMultiplier={type.micro.maxFontSizeMultiplier}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Hold to record + Compare (A-card 5, B-core 5) ──
function CompareBlock({ sticker, voice }: { sticker: Sticker; voice: ReturnType<typeof useVoiceTake> }) {
  const toast = useToast();
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const started = useRef(false);
  // 0 idle, 1 native voice, 2 gap, 3 your take.
  const [stage, setStage] = useState<0 | 1 | 2 | 3>(0);
  const run = useRef(0);
  const sawPlaying = useRef(false);
  const comparing = stage !== 0;

  const stopCompare = useCallback(() => {
    run.current += 1;
    stopSpeaking();
    voice.pauseTake();
    setStage(0);
  }, [voice]);

  useEffect(() => () => { run.current += 1; stopSpeaking(); }, []);

  // The take has finished once it has been heard playing and has stopped.
  useEffect(() => {
    if (stage !== 3) return;
    if (voice.playing) sawPlaying.current = true;
    else if (sawPlaying.current) setStage(0);
  }, [stage, voice.playing]);

  const compare = async () => {
    if (comparing) { stopCompare(); return; }
    if (!voice.hasTake) return;
    const mine = ++run.current;
    haptic.tap();
    setStage(1);
    await speakAsync(sticker.word, sticker.language);
    if (run.current !== mine) return;
    setStage(2);
    await new Promise(r => setTimeout(r, 400));
    if (run.current !== mine) return;
    sawPlaying.current = false;
    setStage(3);
    voice.playTake();
    // Never wait forever if the take can't start.
    setTimeout(() => { if (run.current === mine && !sawPlaying.current) setStage(0); }, 4000);
  };

  const pressIn = () => {
    if (voice.uploading || comparing) return;
    started.current = false;
    hold.current = setTimeout(() => { started.current = true; void voice.start(); }, HOLD_MS);
  };
  const pressOut = () => {
    if (hold.current) { clearTimeout(hold.current); hold.current = null; }
    if (started.current) { started.current = false; void voice.stop(); }
    else { voice.cancelHold(); toast.show({ kind: 'info', message: 'Hold to record' }); }
  };

  const caption = voice.recording
    ? 'Recording… let go to stop'
    : voice.hasTake || voice.takeLoading
      ? 'Compare plays the native voice, then yours.'
      : 'Record a take first';

  return (
    <View style={styles.compareCard}>
      <View style={styles.compareRow}>
        <Pressable
          onPressIn={pressIn}
          onPressOut={pressOut}
          disabled={voice.uploading}
          style={[styles.mic, voice.recording && styles.micLive]}
          accessibilityRole="button"
          accessibilityLabel={`Hold to record yourself saying ${sticker.word}`}
          accessibilityState={{ disabled: voice.uploading, busy: voice.recording }}
        >
          <Mic size={22} strokeWidth={1.75} color={voice.recording ? colors.white : colors.terra} />
        </Pressable>

        {voice.hasTake && !voice.recording && (
          <Pressable
            onPress={() => { stopCompare(); voice.playTake(); }}
            style={styles.playTake}
            accessibilityRole="button"
            accessibilityLabel={`Play your recording of ${sticker.word}`}
          >
            <Play size={18} strokeWidth={1.75} color={colors.inkDark} />
          </Pressable>
        )}

        <Pressable
          onPress={compare}
          disabled={!voice.hasTake || voice.recording}
          style={({ pressed }) => [styles.compareBtn, pressed && { backgroundColor: colors.terraTintPressed }, (!voice.hasTake || voice.recording) && styles.compareOff]}
          accessibilityRole="button"
          accessibilityLabel="Compare your recording with the native voice"
          accessibilityState={{ disabled: !voice.hasTake || voice.recording }}
        >
          {comparing && <Square size={14} strokeWidth={2} color={colors.inkDark} fill={colors.inkDark} />}
          <Text style={[styles.compareText, (!voice.hasTake || voice.recording) && { color: colors.inkLight }]} maxFontSizeMultiplier={1.5}>
            {comparing ? 'Stop' : 'Compare'}
          </Text>
        </Pressable>
      </View>

      {comparing && (
        <View style={styles.segments} accessible accessibilityLabel={stage === 3 ? 'Playing your recording' : 'Playing the native voice'}>
          <View style={[styles.segment, stage >= 1 && styles.segmentOn]} />
          <View style={[styles.segment, stage >= 3 && styles.segmentOn]} />
        </View>
      )}
      <Text style={styles.caption} maxFontSizeMultiplier={type.small.maxFontSizeMultiplier}>{caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.sky },
  fill: { width: '100%', height: '100%' },
  hero: {
    backgroundColor: colors.sand,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImage: { width: 190, height: 190 },
  body: { paddingHorizontal: 20, paddingTop: 22 },
  status: { ...type.small, marginBottom: spacing.xs },
  editNote: { ...type.small, marginTop: spacing.ms },
  section: { ...type.small, fontFamily: fonts.display, marginTop: spacing.lg, marginBottom: spacing.sm },

  topRow: {
    position: 'absolute', left: 12, right: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  topRight: { flexDirection: 'row', gap: spacing.sm },
  fade: { position: 'absolute', left: 0, right: 0, top: -FADE_HEIGHT, height: FADE_HEIGHT },
  sticky: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: colors.sky },
  testMe: { alignSelf: 'stretch' },

  progressCard: { backgroundColor: colors.white, borderRadius: radii.md, padding: 16, ...e1 },
  progressGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  progressCell: { width: '33.333%' },
  progressValue: { ...type.data, fontSize: 16, lineHeight: 22, color: colors.inkDark },
  progressLabel: { ...type.micro },
  notReviewed: { ...type.body, color: colors.inkLight },

  compareCard: { backgroundColor: colors.white, borderRadius: radii.md, padding: 16, gap: spacing.ms, ...e1 },
  compareRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.ms },
  mic: {
    width: 56, height: 56, borderRadius: radii.full, backgroundColor: colors.terraLight,
    borderWidth: 1.5, borderColor: colors.terra, alignItems: 'center', justifyContent: 'center',
  },
  micLive: { backgroundColor: colors.error, borderColor: colors.error },
  playTake: {
    width: MIN_TAP, height: MIN_TAP, borderRadius: radii.full, backgroundColor: colors.sand,
    alignItems: 'center', justifyContent: 'center',
  },
  compareBtn: {
    flex: 1, height: MIN_TAP, borderRadius: radii.full, backgroundColor: colors.terraLight,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
  },
  compareOff: { backgroundColor: colors.sand },
  compareText: { ...type.button, fontSize: 16 },
  segments: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.terraLight },
  segmentOn: { backgroundColor: colors.terra },
  caption: { ...type.small },
});
