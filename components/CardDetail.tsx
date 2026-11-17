import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Download, Heart, MoreHorizontal, Mic, Pencil, Play, Share2, Square, Volume2 } from 'lucide-react-native';
import StickerImageFallback from '@/components/StickerImageFallback';
import BottomSheet, { type BottomSheetHandle } from '@/components/BottomSheet';
import { SentenceGloss, SentenceInsight } from '@/components/SentenceGloss';
import { splitAroundWord } from '@/components/CardView';
import { useToast } from '@/components/ToastProvider';
import { usePendingDeletes } from '@/components/PendingDeleteProvider';
import { useVoiceTake } from '@/hooks/useVoiceTake';
import { showMenu } from '@/lib/actionMenu';
import type { EditTarget } from '@/lib/cardEdit';
import { saveStickerToPhotos, shareSticker } from '@/lib/exportSticker';
import { haptic } from '@/lib/haptics';
import { languageLabel } from '@/lib/languages';
import { flipMs, useMotion } from '@/lib/motion';
import { ageInDays, dueAtMs, formatInterval, START_EASE } from '@/lib/review';
import { speak, speakAsync, stopSpeaking } from '@/lib/speech';
import { supabase } from '@/lib/supabase';
import IconButton from '@/components/ui/IconButton';
import type { Sticker } from '@/lib/types';
import { fonts, radii, sentenceFontFor, spacing, MIN_TAP } from '@/constants/theme';
import { useTheme, useThemedStyles, type Theme } from '@/hooks/useTheme';

// The card (Nov 14 card spec): ONE white card on the cream sheet that flips
// about Y. It opens on the FRONT, the keepsake (date, sticker, word, note);
// flipping shows the reference back (labelled rows, one pencil per row, Where /
// When footer). No quiz prompt lives here, ever: "Test me" hands off to the
// caller. Progress and the say-it-yourself compare sit behind "Details".
// Every drawn control is a real one (lessons #8, #9): the pencils, the flip
// hint, the Details button and the sheet's grabber all do what they look like.

const HOLD_MS = 150;

/** The columns "Reset progress" and "Undo" write: the scheduler's whole state. */
const SCHEDULE_COLUMNS = [
  'ease_factor', 'interval_days', 'learning_step', 'due_at', 'review_count', 'lapses', 'last_reviewed_at',
] as const;

const shortDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** Hold to record: the finger, not the mic (see useVoiceTake). Shared by SAY IT and Details. */
function useHoldToRecord(voice: ReturnType<typeof useVoiceTake>, blocked = false) {
  const toast = useToast();
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const started = useRef(false);
  const pressIn = () => {
    if (voice.uploading || blocked) return;
    started.current = false;
    hold.current = setTimeout(() => { started.current = true; void voice.start(); }, HOLD_MS);
  };
  const pressOut = () => {
    if (hold.current) { clearTimeout(hold.current); hold.current = null; }
    if (started.current) { started.current = false; void voice.stop(); }
    else { voice.cancelHold(); toast.show({ kind: 'info', message: 'Hold to record' }); }
  };
  return { pressIn, pressOut };
}

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
  /// Opened over a practice session: nothing here may write the schedule.
  noScheduleWrites?: boolean;
  /// Whether the page is scrolled to its top: pull-down-to-close only starts there.
  onAtTop?: (atTop: boolean) => void;
}

export default function CardDetail({
  sticker, imageUrl, onClose, onEdit, onTest, onUpdate, onDeleted, onRemoveFromBoard, embedded, noScheduleWrites, onAtTop,
}: CardDetailProps) {
  const { colors, type, headwordStyle } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { deleteWithUndo } = usePendingDeletes();
  const voice = useVoiceTake(sticker, onUpdate);
  const [busy, setBusy] = useState(false);
  const { reduced } = useMotion();
  const [flipped, setFlipped] = useState(false);
  const flip = useRef(new Animated.Value(0)).current;
  const flippingRef = useRef(false);
  const backAtTop = useRef(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const hold = useHoldToRecord(voice);

  useEffect(() => {
    flip.setValue(0);
    setFlipped(false);
    flippingRef.current = false;
    onAtTop?.(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sticker.id]);

  // 220ms about Y, or a 120ms crossfade under Reduce Motion (lib/motion.ts).
  const toggleFlip = () => {
    if (flippingRef.current) return;
    flippingRef.current = true;
    const next = !flipped;
    setFlipped(next);
    haptic.select();
    stopSpeaking();
    onAtTop?.(next ? backAtTop.current : true);
    Animated.timing(flip, { toValue: next ? 1 : 0, duration: reduced ? 120 : flipMs, useNativeDriver: true })
      .start(() => { flippingRef.current = false; });
  };

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
            const reset: Partial<Sticker> = {
              ease_factor: START_EASE, interval_days: 0, learning_step: null, due_at: null,
              review_count: 0, lapses: 0, last_reviewed_at: null,
            };
            const ok = await writeSchedule(reset);
            if (!ok) {
              onUpdate?.(sticker.id, before);
              toast.show({ kind: 'error', message: "Couldn't reset that card. Try again." });
              return;
            }
            toast.show({
              kind: 'undo',
              message: 'Progress reset',
              action: { label: 'Undo', onPress: async () => {
                  // writeSchedule updates the UI first; if the DB refused, put the UI back to match it.
                  if (!(await writeSchedule(before))) {
                    onUpdate?.(sticker.id, reset);
                    toast.show({ kind: 'error', message: "Couldn't undo that. The card is still reset." });
                  }
                } },
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
      ...((sticker.review_count ?? 0) > 0 && !noScheduleWrites ? [{ label: 'Reset progress', onPress: resetProgress }] : []),
      ...(embedded ? [] : [{ label: 'Delete card', onPress: deleteCard, destructive: true }]),
    ]);
  };

  const found = new Date(sticker.discovered_at ?? sticker.created_at);
  const foundOk = !Number.isNaN(found.getTime());
  const note = sticker.notes?.trim() || '';
  const reviews = sticker.review_count ?? 0;
  const status = reviews === 0 ? 'New card' : `${reviews} ${reviews === 1 ? 'review' : 'reviews'}`;
  const canTest = !!onTest && !embedded;
  const hasMenu = !!onRemoveFromBoard || (reviews > 0 && !noScheduleWrites) || !embedded;
  const parts = splitAroundWord(sticker.sentence, sticker.word);
  const forms = (sticker.forms ?? []).filter(f => f && f.l && f.v);
  const detailsSheetOpen = detailsOpen;

  const frontFace = reduced
    ? { opacity: flip.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }
    : {
        opacity: flip.interpolate({ inputRange: [0, 0.5, 0.5001, 1], outputRange: [1, 1, 0, 0] }),
        transform: [{ perspective: 1400 }, { rotateY: flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }],
      };
  const backFace = reduced
    ? { opacity: flip }
    : {
        opacity: flip.interpolate({ inputRange: [0, 0.4999, 0.5, 1], outputRange: [0, 0, 1, 1] }),
        transform: [{ perspective: 1400 }, { rotateY: flip.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] }) }],
      };
  const hide = (hidden: boolean) => ({
    accessibilityElementsHidden: hidden,
    importantForAccessibility: (hidden ? 'no-hide-descendants' : 'auto') as 'no-hide-descendants' | 'auto',
  });

  const TestMe = canTest ? (
    <Pressable
      testID="card-test-me"
      onPress={() => { haptic.tap(); onTest?.(); }}
      style={({ pressed }) => [styles.pill, styles.pillPrimary, pressed && { backgroundColor: colors.terraLight }]}
      accessibilityRole="button"
      accessibilityLabel="Test me"
    >
      <Text style={styles.pillText} maxFontSizeMultiplier={1.5}>Test me</Text>
    </Pressable>
  ) : null;

  return (
    <View style={[styles.page, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
      <View style={styles.topRow}>
        <IconButton onPress={onClose} label="Close this card" testID="card-close">
          <ChevronLeft size={24} strokeWidth={1.75} color={colors.inkDark} />
        </IconButton>
        <View style={styles.topRight}>
          <IconButton onPress={toggleFavorite} label={sticker.is_favorite ? 'Remove from favourites' : 'Add to favourites'} selected={sticker.is_favorite}>
            <Heart
              size={22} strokeWidth={1.75}
              color={sticker.is_favorite ? colors.terraInk : colors.inkDark}
              fill={sticker.is_favorite ? colors.terra : 'none'}
            />
          </IconButton>
          {!!sticker.image_path && (
            <>
              <IconButton onPress={() => runExport('share')} label="Share sticker" disabled={busy}><Share2 size={20} strokeWidth={1.75} color={colors.inkDark} /></IconButton>
              <IconButton onPress={() => runExport('save')} label="Save sticker to Photos" disabled={busy}><Download size={20} strokeWidth={1.75} color={colors.inkDark} /></IconButton>
            </>
          )}
          {hasMenu && (
            <IconButton onPress={openMenu} label="More actions"><MoreHorizontal size={22} strokeWidth={1.75} color={colors.inkDark} /></IconButton>
          )}
        </View>
      </View>

      <View style={styles.cardArea}>
        {/* FRONT: the keepsake. The whole card flips; Test me is its own button. */}
        <Animated.View style={[styles.face, frontFace]} pointerEvents={flipped ? 'none' : 'auto'} {...hide(flipped)}>
          <View style={styles.card}>
            <Pressable
              testID="card-front"
              style={styles.cardClip}
              onPress={toggleFlip}
              accessibilityRole="button"
              accessibilityLabel={`${sticker.word}, ${sticker.translation}. Flip card`}
            >
              <View style={styles.dateRow}>
                {foundOk && (
                  <>
                    <Text style={styles.dayNumber} maxFontSizeMultiplier={1.2}>{found.toLocaleDateString(undefined, { day: 'numeric' })}</Text>
                    <View>
                      <Text style={styles.weekday} maxFontSizeMultiplier={type.h2.maxFontSizeMultiplier}>{found.toLocaleDateString(undefined, { weekday: 'long' })}</Text>
                      <Text style={styles.monthYear} maxFontSizeMultiplier={type.micro.maxFontSizeMultiplier}>
                        {found.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }).toUpperCase()}
                      </Text>
                    </View>
                  </>
                )}
                <View style={styles.flexSpace} />
                <Text style={styles.dayCount} maxFontSizeMultiplier={type.micro.maxFontSizeMultiplier}>DAY {ageInDays(sticker.created_at)}</Text>
              </View>

              <View style={styles.stickerWell}>
                {sticker.image_path && imageUrl ? (
                  <View style={styles.stickerBox}>
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

              <View style={styles.wordBlock}>
                <Text
                  style={[headwordStyle(sticker.language, 34), styles.centered]}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                  maxFontSizeMultiplier={type.headword.maxFontSizeMultiplier}
                >
                  {sticker.word}
                </Text>
                {!!sticker.reading && (
                  <Text style={[styles.readingFront, styles.centered]} numberOfLines={1} maxFontSizeMultiplier={type.data.maxFontSizeMultiplier}>
                    [{sticker.reading}]
                  </Text>
                )}
                {!!note && (
                  <Text style={[styles.noteCaption, styles.centered]} numberOfLines={2} maxFontSizeMultiplier={type.small.maxFontSizeMultiplier}>
                    {note}
                  </Text>
                )}
              </View>
            </Pressable>
            <View style={styles.cardBar}>
              <SpeakButton word={sticker.word} language={sticker.language} />
              <View style={styles.flexSpace} />
              {TestMe}
            </View>
          </View>
        </Animated.View>

        {/* BACK: the reference. */}
        <Animated.View style={[styles.face, backFace]} pointerEvents={flipped ? 'auto' : 'none'} {...hide(!flipped)}>
          <View style={styles.card}>
            <View style={styles.cardClip}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.backScroll}
                keyboardShouldPersistTaps="handled"
                onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                  backAtTop.current = e.nativeEvent.contentOffset.y <= 0;
                  if (flipped) onAtTop?.(backAtTop.current);
                }}
                scrollEventThrottle={16}
              >
                <Text style={styles.metaLine} maxFontSizeMultiplier={type.micro.maxFontSizeMultiplier}>
                  {languageLabel(sticker.language).toUpperCase()} · {status.toUpperCase()}
                </Text>

                <Row label="WORD" editLabel={`Word, ${sticker.word}. Edit`} onEdit={() => onEdit('word')}>
                  <Text
                    style={headwordStyle(sticker.language)}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                    maxFontSizeMultiplier={type.headword.maxFontSizeMultiplier}
                  >
                    {sticker.word}
                  </Text>
                </Row>

                <Row
                  label="SAY IT"
                  editLabel={sticker.reading ? `Reading, ${sticker.reading}. Edit` : undefined}
                  onEdit={sticker.reading ? () => onEdit('reading') : undefined}
                >
                  <View style={styles.sayRow}>
                    <Text style={[styles.reading, styles.flexShrink]} numberOfLines={2} maxFontSizeMultiplier={type.data.maxFontSizeMultiplier}>
                      {sticker.reading ? `[${sticker.reading}]` : ' '}
                    </Text>
                    <SpeakButton word={sticker.word} language={sticker.language} filled />
                    <Pressable
                      onPressIn={hold.pressIn}
                      onPressOut={hold.pressOut}
                      disabled={voice.uploading}
                      style={[styles.mic, voice.recording && styles.micLive]}
                      accessibilityRole="button"
                      accessibilityLabel={`Hold to record yourself saying ${sticker.word}`}
                      accessibilityState={{ disabled: voice.uploading, busy: voice.recording }}
                    >
                      <Mic size={20} strokeWidth={1.75} color={voice.recording ? colors.white : colors.terraInk} />
                    </Pressable>
                  </View>
                  <Text style={styles.hint} maxFontSizeMultiplier={type.small.maxFontSizeMultiplier}>
                    {voice.recording ? 'Recording… let go to stop' : 'Hold the mic to record your pronunciation'}
                  </Text>
                </Row>

                <Row
                  label={sticker.part_of_speech ? `MEANS · ${sticker.part_of_speech.toUpperCase()}` : 'MEANS'}
                  editLabel={`Meaning, ${sticker.translation}. Edit`}
                  onEdit={() => onEdit('meaning')}
                >
                  <Text style={styles.meaning} maxFontSizeMultiplier={type.h2.maxFontSizeMultiplier}>{sticker.translation}</Text>
                </Row>

                {!!sticker.sentence && (
                  <Row label="IN USE" editLabel={`Sentence, ${sticker.sentence}. Edit`} onEdit={() => onEdit('sentence')}>
                    <Text style={[styles.sentence, { fontFamily: sentenceFontFor(sticker.language) }]} maxFontSizeMultiplier={type.body.maxFontSizeMultiplier}>
                      {parts ? (
                        <>
                          {parts[0]}
                          <Text style={styles.sentenceWord}>{parts[1]}</Text>
                          {parts[2]}
                        </>
                      ) : sticker.sentence}
                    </Text>
                    {!!sticker.sentence_translation && (
                      <Text style={styles.translation} maxFontSizeMultiplier={type.body.maxFontSizeMultiplier}>{sticker.sentence_translation}</Text>
                    )}
                    <SentenceGloss raw={sticker.sentence_gloss} sentence={sticker.sentence} language={sticker.language} />
                    <SentenceInsight text={sticker.sentence_insight} />
                  </Row>
                )}

                {forms.map((f, i) => (
                  <Row key={`${f.l}-${i}`} label={f.l.toUpperCase()}>
                    <Text style={styles.formValue} maxFontSizeMultiplier={type.body.maxFontSizeMultiplier}>{f.v}</Text>
                  </Row>
                ))}

                {note ? (
                  <Row label="NOTES" editLabel={`What happened. ${note}. Edit`} onEdit={() => onEdit('note')}>
                    <Text style={styles.formValue} maxFontSizeMultiplier={type.body.maxFontSizeMultiplier}>{note}</Text>
                  </Row>
                ) : (
                  <Pressable
                    onPress={() => onEdit('note')}
                    style={({ pressed }) => [styles.notePrompt, pressed && { backgroundColor: colors.sand }]}
                    accessibilityRole="button"
                    accessibilityLabel="Add what happened that day"
                  >
                    <Pencil size={16} strokeWidth={1.75} color={colors.inkLight} />
                    <Text style={styles.hint} maxFontSizeMultiplier={type.small.maxFontSizeMultiplier}>Add what happened that day…</Text>
                  </Pressable>
                )}
              </ScrollView>
            </View>
            <View style={styles.cardBar}>
              <Pressable
                testID="card-details"
                onPress={() => { haptic.select(); onAtTop?.(false); setDetailsOpen(true); }}
                style={({ pressed }) => [styles.pill, pressed && { backgroundColor: colors.terraLight }]}
                accessibilityRole="button"
                accessibilityLabel="Details"
                accessibilityHint="Progress and compare your pronunciation"
              >
                <Text style={styles.pillText} maxFontSizeMultiplier={1.5}>Details</Text>
              </Pressable>
              <View style={styles.flexSpace} />
              {TestMe}
            </View>
          </View>
        </Animated.View>
      </View>

      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <View style={styles.footerCol}>
            <Text style={styles.footerLabel} maxFontSizeMultiplier={type.micro.maxFontSizeMultiplier}>WHERE</Text>
            <Text style={styles.footerValue} numberOfLines={1} maxFontSizeMultiplier={type.small.maxFontSizeMultiplier}>
              {sticker.location_label?.trim() || 'Not recorded'}
            </Text>
          </View>
          {foundOk && (
            <View style={[styles.footerCol, styles.footerRight]}>
              <Text style={styles.footerLabel} maxFontSizeMultiplier={type.micro.maxFontSizeMultiplier}>WHEN</Text>
              <Text style={styles.footerValue} maxFontSizeMultiplier={type.small.maxFontSizeMultiplier}>
                {`${found.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}, ${found.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`}
              </Text>
            </View>
          )}
        </View>
        <Pressable
          testID="card-flip"
          onPress={toggleFlip}
          style={styles.flipHint}
          accessibilityRole="button"
          accessibilityLabel={flipped ? 'Flip card back to the front' : 'Flip card to see the details'}
        >
          <Text style={styles.flipText} maxFontSizeMultiplier={type.small.maxFontSizeMultiplier}>
            {flipped ? 'Tap to flip back' : 'Tap to flip'} · pull down to close
          </Text>
        </Pressable>
      </View>

      {detailsSheetOpen && (
        <DetailsSheet sticker={sticker} voice={voice} onClosed={() => { setDetailsOpen(false); onAtTop?.(!flipped || backAtTop.current); }} />
      )}
    </View>
  );
}

function Row({ label, editLabel, onEdit, children }: {
  label: string; editLabel?: string; onEdit?: () => void; children: React.ReactNode;
}) {
  const { type, colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <Text style={styles.rowLabel} maxFontSizeMultiplier={type.micro.maxFontSizeMultiplier}>{label}</Text>
        {onEdit ? (
          <Pressable
            onPress={() => { haptic.select(); onEdit(); }}
            hitSlop={0}
            style={styles.pencilHit}
            accessibilityRole="button"
            accessibilityLabel={editLabel ?? `Edit ${label.toLowerCase()}`}
          >
            <View style={styles.pencil}><Pencil size={16} strokeWidth={1.75} color={colors.inkLight} /></View>
          </Pressable>
        ) : <View style={styles.pencilSpacer} />}
      </View>
      {children}
    </View>
  );
}

function SpeakButton({ word, language, filled }: { word: string; language: Sticker['language']; filled?: boolean }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={() => speak(word, language)}
      style={({ pressed }) => [styles.speak, filled && styles.speakFilled, pressed && styles.speakPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Hear ${word} pronounced`}
    >
      <Volume2 size={18} strokeWidth={1.75} color={filled ? colors.white : colors.inkDark} />
    </Pressable>
  );
}

function DetailsSheet({ sticker, voice, onClosed }: {
  sticker: Sticker; voice: ReturnType<typeof useVoiceTake>; onClosed: () => void;
}) {
  const { type } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const sheet = useRef<BottomSheetHandle>(null);
  return (
    <BottomSheet
      ref={sheet}
      onRequestClose={() => sheet.current?.close()}
      onClosed={onClosed}
      maxHeight="80%"
      header={<Text style={styles.sheetTitle}>Details</Text>}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetBody}>
        <Text style={styles.section} maxFontSizeMultiplier={type.small.maxFontSizeMultiplier}>Progress</Text>
        <ProgressBlock sticker={sticker} />
        <Text style={styles.section} maxFontSizeMultiplier={type.small.maxFontSizeMultiplier}>Say it yourself</Text>
        <CompareBlock sticker={sticker} voice={voice} />
      </ScrollView>
    </BottomSheet>
  );
}

// ── Progress (A-card 6): everything the scheduler already stores ──
function ProgressBlock({ sticker }: { sticker: Sticker }) {
  const { type } = useTheme();
  const styles = useThemedStyles(makeStyles);
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
  const { colors, type } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { pressIn, pressOut } = useHoldToRecord(voice, false);
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
          <Mic size={22} strokeWidth={1.75} color={voice.recording ? colors.white : colors.terraInk} />
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

const makeStyles = ({ colors, e1, type, stickerShadow }: Theme) => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.sky, paddingHorizontal: 20 },
  fill: { width: '100%', height: '100%' },
  flexSpace: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  centered: { textAlign: 'center' },

  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: spacing.sm },
  topRight: { flexDirection: 'row', gap: spacing.sm },

  cardArea: { flex: 1 },
  face: { ...StyleSheet.absoluteFillObject, backfaceVisibility: 'hidden' },
  // Shadow on the outer view, clipping on the inner (a view that does both loses the shadow on iOS).
  card: { flex: 1, backgroundColor: colors.card, borderRadius: radii.lg, ...e1 },
  cardClip: { flex: 1, borderRadius: radii.lg, overflow: 'hidden' },
  cardBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: 16, paddingBottom: 14, paddingTop: 4, minHeight: MIN_TAP + 18,
  },

  // front
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.ms, paddingHorizontal: 20, paddingTop: 18 },
  dayNumber: { fontFamily: fonts.display, fontSize: 44, lineHeight: 50, color: colors.inkDark },
  weekday: { ...type.h2, fontSize: 20, lineHeight: 26 },
  monthYear: { ...type.micro, fontFamily: fonts.mono, letterSpacing: 1.5 },
  dayCount: { ...type.micro, fontFamily: fonts.mono, letterSpacing: 1.5 },
  stickerWell: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  stickerBox: { width: '100%', height: '100%', ...stickerShadow },
  wordBlock: { paddingHorizontal: 20, gap: 2, alignItems: 'stretch' },
  readingFront: { ...type.data, fontSize: 16, lineHeight: 22, color: colors.inkLight },
  noteCaption: { ...type.small, marginTop: spacing.xs },

  // back
  backScroll: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12 },
  metaLine: { ...type.micro, fontFamily: fonts.mono, letterSpacing: 1.5 },
  row: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: MIN_TAP - 8 },
  rowLabel: { ...type.micro, fontFamily: fonts.mono, letterSpacing: 1.5 },
  pencilHit: { width: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center', marginVertical: -8, marginRight: -6 },
  pencilSpacer: { width: MIN_TAP, height: 28, marginRight: -6 },
  pencil: {
    width: 32, height: 32, borderRadius: radii.full, backgroundColor: colors.sand,
    alignItems: 'center', justifyContent: 'center',
  },
  sayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reading: { ...type.data, fontSize: 20, lineHeight: 28, color: colors.inkDark, flex: 1 },
  hint: { ...type.small },
  meaning: { ...type.h2, color: colors.inkMid },
  sentence: { fontSize: 20, lineHeight: 30, color: colors.inkDark },
  sentenceWord: { textDecorationLine: 'underline' },
  translation: { ...type.body, color: colors.inkLight, marginTop: spacing.xs },
  formValue: { ...type.body, color: colors.inkDark },
  notePrompt: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md,
    minHeight: MIN_TAP, borderRadius: radii.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.ctl,
    paddingHorizontal: 12,
  },

  speak: {
    width: MIN_TAP, height: MIN_TAP, borderRadius: radii.full,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.terraLight,
  },
  speakFilled: { backgroundColor: colors.terra },
  speakPressed: { backgroundColor: colors.terraTintPressed },
  mic: {
    width: MIN_TAP, height: MIN_TAP, borderRadius: radii.full, backgroundColor: colors.terraLight,
    borderWidth: 1.5, borderColor: colors.terra, alignItems: 'center', justifyContent: 'center',
  },
  micLive: { backgroundColor: colors.error, borderColor: colors.error },

  pill: {
    height: MIN_TAP, paddingHorizontal: 20, borderRadius: radii.full,
    borderWidth: 1.5, borderColor: colors.terra, alignItems: 'center', justifyContent: 'center',
  },
  pillPrimary: { backgroundColor: colors.card },
  pillText: { ...type.button, fontSize: 15, lineHeight: 20, color: colors.terraInk },

  // footer under the card
  footer: { paddingTop: spacing.ms },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, gap: spacing.md },
  footerCol: { flexShrink: 1 },
  footerRight: { alignItems: 'flex-end' },
  footerLabel: { ...type.micro, fontFamily: fonts.mono, letterSpacing: 1.5 },
  footerValue: { ...type.small, color: colors.inkDark },
  flipHint: { minHeight: MIN_TAP, alignItems: 'center', justifyContent: 'center' },
  flipText: { ...type.small },

  // details sheet
  sheetTitle: { ...type.h2, paddingHorizontal: 20, paddingBottom: spacing.sm },
  sheetBody: { paddingHorizontal: 20, paddingBottom: 24 },
  section: { ...type.small, fontFamily: fonts.display, marginTop: spacing.md, marginBottom: spacing.sm },

  progressCard: { backgroundColor: colors.card, borderRadius: radii.md, padding: 16, ...e1 },
  progressGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  progressCell: { width: '33.333%' },
  progressValue: { ...type.data, fontSize: 16, lineHeight: 22, color: colors.inkDark },
  progressLabel: { ...type.micro },
  notReviewed: { ...type.body, color: colors.inkLight },

  compareCard: { backgroundColor: colors.card, borderRadius: radii.md, padding: 16, gap: spacing.ms, ...e1 },
  compareRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.ms },
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
