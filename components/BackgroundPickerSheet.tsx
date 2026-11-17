import { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { File } from 'expo-file-system';
import { ImagePlus, ImageOff, Images } from 'lucide-react-native';
import BottomSheet, { BottomSheetHandle } from '@/components/BottomSheet';
import { useToast } from '@/components/ToastProvider';
import { friendlyErrorSync } from '@/lib/friendlyError';
import { haptic } from '@/lib/haptics';
import { libraryThumbPathFor, type BackgroundChoice, type SavedBackground } from '@/lib/backgroundLibrary';
import { useSavedBackgrounds } from '@/hooks/useSavedBackgrounds';
import { pickBackgroundPhotos, shrinkForStorage } from '@/lib/pickBackgroundPhoto';
import { radii, spacing, fonts } from '@/constants/theme';
import { useTheme, useThemedStyles, type Theme } from '@/hooks/useTheme';

interface BackgroundPickerSheetProps {
  visible: boolean;
  /// Unmount: runs once the sheet is off screen (and after onChoose, if any).
  onClose: () => void;
  /// Called after the sheet has finished leaving, never while it is still on
  /// screen: the crop editor and the system photo picker are Modals too, and
  /// iOS drops a Modal presented while another is dismissing.
  onChoose: (choice: BackgroundChoice) => void;
  /// Offer "None". The board menu hides it for a board with no background yet.
  allowNone?: boolean;
  title?: string;
}

const SHEET_GUTTER = 20;

// Choose a background: a saved one, a fresh photo, or none. This only
// *chooses*; the caller owns what happens next (the crop + dim flow), so the
// board is written exactly as before.
export default function BackgroundPickerSheet({
  visible, onClose, onChoose, allowNone = true, title = 'Background',
}: BackgroundPickerSheetProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const toast = useToast();
  const { backgrounds, loading, remove, save, thumbUrlFor } = useSavedBackgrounds();
  // Stocking the library several photos at a time, without applying any. The
  // sheet stays up (the system picker presents over it) so the new tiles land
  // in front of you and one can be tapped straight away.
  const [adding, setAdding] = useState<{ done: number; total: number } | null>(null);
  // Shown in the sheet, not as a toast: the sheet is a Modal and the toast
  // host draws under it.
  // Tiles get an explicit size. Percentage width + aspectRatio inside a
  // wrapping row collapsed every row after the first to its borders (seen on
  // the Simulator once the library had >1 entry). Computed from the window
  // minus the sheet's gutters (BottomSheet paddingHorizontal 20) rather than
  // measured, so the first frame is already right and nothing jumps while the
  // sheet slides in.
  const { width: windowWidth } = useWindowDimensions();
  const tileW = Math.floor((windowWidth - 2 * SHEET_GUTTER - 2 * spacing.sm) / 3);
  const tileSize = { width: tileW, height: Math.round(tileW / 0.8) };
  const [addResult, setAddResult] = useState<{ ok: boolean; message: string } | null>(null);
  const addingRef = useRef(false);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  // A previous run's "Saved 3 backgrounds" must not greet a later reopen.
  useEffect(() => { if (visible) setAddResult(null); }, [visible]);
  const sheet = useRef<BottomSheetHandle>(null);
  const chosen = useRef<BackgroundChoice | null>(null);

  if (!visible) return null;

  const choose = (choice: BackgroundChoice) => {
    chosen.current = choice;
    sheet.current?.close();
  };

  const confirmDelete = (item: SavedBackground) => {
    Alert.alert(
      'Delete this background?',
      'It leaves your saved backgrounds. Boards already using it keep theirs.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await remove(item);
            if (error) {
              haptic.error();
              toast.show({ kind: 'error', message: friendlyErrorSync(error, "Couldn't delete that background. Try again.") });
            }
          },
        },
      ],
    );
  };

  const addToSaved = async () => {
    // A ref, set before the first await: state lags a render, and a double tap
    // during the permission/picker await would open two pickers.
    if (addingRef.current) return;
    addingRef.current = true;
    try {
      await runAdd();
    } finally {
      addingRef.current = false;
    }
  };

  const runAdd = async () => {
    haptic.tap();
    const photos = await pickBackgroundPhotos();
    if (photos.length === 0) return;
    setAddResult(null);
    setAdding({ done: 0, total: photos.length });
    let failed = 0;
    // One at a time: each is a full-size upload, and save() inserts each row
    // as it lands, so tiles appear in order instead of all at the end.
    for (let i = 0; i < photos.length; i++) {
      try {
        const shrunk = await shrinkForStorage(photos[i]);
        const saved = await save(shrunk);
        if (!saved) failed++;
        // shrinkForStorage always writes a temp copy; the picker's original is not ours.
        try { if (shrunk.uri !== photos[i].uri) new File(shrunk.uri).delete(); } catch { /* best effort */ }
      } catch {
        failed++;
      }
      setAdding({ done: i + 1, total: photos.length });
    }
    setAdding(null);
    const ok = photos.length - failed;
    // The sheet may have been closed while this ran; its in-sheet note is then
    // invisible, so say it with a toast instead.
    if (!visibleRef.current) {
      if (failed === 0) {
        haptic.success();
        toast.show({ kind: 'info', message: ok === 1 ? 'Saved 1 background.' : `Saved ${ok} backgrounds.` });
      } else {
        haptic.error();
        toast.show({ kind: 'error', message: `Saved ${ok} of ${photos.length} backgrounds. Try the rest again.` });
      }
      return;
    }
    if (failed === 0) {
      haptic.success();
      setAddResult({ ok: true, message: ok === 1 ? 'Saved 1 background. Tap it to use it.' : `Saved ${ok} backgrounds. Tap one to use it.` });
    } else {
      haptic.error();
      setAddResult({
        ok: false,
        message: ok === 0
          ? "Couldn't save those photos. Check your connection and try again."
          : `Saved ${ok} of ${photos.length}. ${failed} didn't upload. Try those again.`,
      });
    }
  };

  const handleClosed = () => {
    const pending = chosen.current;
    chosen.current = null;
    onClose();
    if (pending) onChoose(pending);
  };

  return (
    <BottomSheet
      ref={sheet}
      onRequestClose={() => sheet.current?.close()}
      onClosed={handleClosed}
      maxHeight="80%"
      header={<Text style={styles.title}>{title}</Text>}
    >
      <ScrollView
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={[styles.tile, tileSize, styles.actionTile]}
          onPress={() => { haptic.tap(); choose({ kind: 'photos' }); }}
          accessibilityRole="button"
          accessibilityLabel="Choose from Photos"
          testID="background-choose-photos"
          activeOpacity={0.85}
        >
          <ImagePlus size={22} strokeWidth={1.75} color={colors.terraInk} />
          <Text style={styles.actionText} maxFontSizeMultiplier={1.2}>Choose from Photos</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tile, tileSize, styles.actionTile, !!adding && styles.tileBusy]}
          onPress={addToSaved}
          disabled={!!adding}
          accessibilityRole="button"
          accessibilityLabel={adding ? `Saving photos, ${adding.done} of ${adding.total}` : 'Add photos to saved backgrounds'}
          accessibilityHint="Pick several photos to keep for any board. Nothing is applied yet."
          accessibilityState={{ busy: !!adding, disabled: !!adding }}
          testID="background-add-several"
          activeOpacity={0.85}
        >
          {adding ? (
            <>
              <ActivityIndicator color={colors.terraInk} />
              <Text style={styles.actionText} maxFontSizeMultiplier={1.2}>Saving {Math.min(adding.done + 1, adding.total)} of {adding.total}</Text>
            </>
          ) : (
            <>
              <Images size={22} strokeWidth={1.75} color={colors.terraInk} />
              <Text style={styles.actionText} maxFontSizeMultiplier={1.2}>Add photos to saved</Text>
            </>
          )}
        </TouchableOpacity>

        {allowNone && (
          <TouchableOpacity
            style={[styles.tile, tileSize, styles.actionTile]}
            onPress={() => choose({ kind: 'none' })}
            accessibilityRole="button"
            accessibilityLabel="None, plain board"
            testID="background-choose-none"
            activeOpacity={0.85}
          >
            <ImageOff size={22} strokeWidth={1.75} color={colors.inkMid} />
            <Text style={styles.actionText} maxFontSizeMultiplier={1.2}>None</Text>
          </TouchableOpacity>
        )}

        {backgrounds.map((item, i) => {
          const url = thumbUrlFor(item);
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.tile, tileSize]}
              onPress={() => choose({ kind: 'saved', saved: item })}
              // New uploads prepend tiles; keep the grid still under the finger.
              disabled={!!adding}
              onLongPress={() => confirmDelete(item)}
              delayLongPress={350}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Saved background ${i + 1}`}
              accessibilityHint="Double tap to use it. Use the actions menu to delete it."
              accessibilityActions={[{ name: 'delete', label: 'Delete this saved background' }]}
              onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === 'delete') confirmDelete(item); }}
              testID={`saved-background-${i}`}
            >
              {url ? (
                <Image
                  source={{ uri: url, cacheKey: libraryThumbPathFor(item.path) }}
                  cachePolicy="memory-disk"
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
              ) : (
                <ActivityIndicator style={StyleSheet.absoluteFill} color={colors.inkLight} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {addResult && (
        <Text style={[styles.note, addResult.ok ? styles.noteOk : styles.noteError]} accessibilityLiveRegion="polite">
          {addResult.message}
        </Text>
      )}
      {!loading && backgrounds.length === 0 && (
        <Text style={styles.note}>Add several photos at once, or any photo you use as a background lands here, ready for every board.</Text>
      )}
      {backgrounds.length > 0 && (
        <Text style={styles.note}>Touch and hold a saved background to delete it.</Text>
      )}
    </BottomSheet>
  );
}

const makeStyles = ({ colors }: Theme) => StyleSheet.create({
  title: { fontSize: 20, fontFamily: fonts.display, color: colors.inkDark },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingTop: spacing.md, paddingBottom: spacing.sm },
  // Three across: width/height come from tileSize (computed from the window).
  tile: {
    flexShrink: 0,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.sky,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tileBusy: { opacity: 0.8 },
  actionTile: { alignItems: 'center', justifyContent: 'center', gap: spacing.xs, padding: spacing.sm },
  actionText: { fontSize: 13, fontFamily: fonts.display, color: colors.inkMid, textAlign: 'center' },
  noteOk: { color: colors.inkMid },
  noteError: { color: colors.errorInk },
  note: { fontSize: 13, fontFamily: fonts.text, color: colors.inkLight, lineHeight: 19, textAlign: 'center', marginTop: spacing.xs },
});
