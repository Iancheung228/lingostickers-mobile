import { useRef } from 'react';
import { Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { ImagePlus, ImageOff } from 'lucide-react-native';
import BottomSheet, { BottomSheetHandle } from '@/components/BottomSheet';
import { useToast } from '@/components/ToastProvider';
import { friendlyErrorSync } from '@/lib/friendlyError';
import { haptic } from '@/lib/haptics';
import { libraryThumbPathFor, type BackgroundChoice, type SavedBackground } from '@/lib/backgroundLibrary';
import { useSavedBackgrounds } from '@/hooks/useSavedBackgrounds';
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


// Choose a background: a saved one, a fresh photo, or none. This only
// *chooses*; the caller owns what happens next (the crop + dim flow), so the
// board is written exactly as before.
export default function BackgroundPickerSheet({
  visible, onClose, onChoose, allowNone = true, title = 'Background',
}: BackgroundPickerSheetProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const toast = useToast();
  const { backgrounds, loading, remove, thumbUrlFor } = useSavedBackgrounds();
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
      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={[styles.tile, styles.actionTile]}
          onPress={() => { haptic.tap(); choose({ kind: 'photos' }); }}
          accessibilityRole="button"
          accessibilityLabel="Choose from Photos"
          testID="background-choose-photos"
          activeOpacity={0.85}
        >
          <ImagePlus size={22} strokeWidth={1.75} color={colors.terraInk} />
          <Text style={styles.actionText}>Choose from Photos</Text>
        </TouchableOpacity>

        {allowNone && (
          <TouchableOpacity
            style={[styles.tile, styles.actionTile]}
            onPress={() => choose({ kind: 'none' })}
            accessibilityRole="button"
            accessibilityLabel="None, plain board"
            testID="background-choose-none"
            activeOpacity={0.85}
          >
            <ImageOff size={22} strokeWidth={1.75} color={colors.inkMid} />
            <Text style={styles.actionText}>None</Text>
          </TouchableOpacity>
        )}

        {backgrounds.map((item, i) => {
          const url = thumbUrlFor(item);
          return (
            <TouchableOpacity
              key={item.id}
              style={styles.tile}
              onPress={() => choose({ kind: 'saved', saved: item })}
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

      {!loading && backgrounds.length === 0 && (
        <Text style={styles.note}>Photos you use as backgrounds are saved here, so you can reuse them on other boards.</Text>
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
  // Three across inside the sheet's 20pt gutters and two 8pt gaps.
  tile: {
    width: '31.5%',
    aspectRatio: 0.8,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.sky,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionTile: { alignItems: 'center', justifyContent: 'center', gap: spacing.xs, padding: spacing.sm },
  actionText: { fontSize: 13, fontFamily: fonts.display, color: colors.inkMid, textAlign: 'center' },
  note: { fontSize: 13, fontFamily: fonts.text, color: colors.inkLight, lineHeight: 19, textAlign: 'center', marginTop: spacing.xs },
});
