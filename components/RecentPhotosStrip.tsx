import { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { LayoutGrid } from 'lucide-react-native';
import { fonts, radii, spacing } from '@/constants/theme';
import { BATCH_MAX } from '@/lib/batchScan';
import { confirmLabel } from '@/lib/photoSelection';
import type { LibAsset } from '@/lib/photoLibrary';
import PhotoThumb from '@/components/PhotoThumb';
import { useTheme, useThemedStyles, type Theme } from '@/hooks/useTheme';

const THUMB = 56;
const GAP = 8;

interface Props {
  recent: LibAsset[];
  used: ReadonlySet<string>;
  selected: LibAsset[];
  capped: boolean;
  busy: boolean;
  onToggle: (a: LibAsset) => void;
  onClear: () => void;
  onConfirm: () => void;
  onSeeAll: () => void;
}

// The newest photos, one tap from a sticker. Sits above the shutter row; the
// header line is where the confirm lives so the thumbnails never move when a
// selection starts. Thumbs have a 8pt gap and no horizontal hitSlop (lesson 9:
// gap >= left_slop + right_slop); the header buttons are 44pt drawn controls.
export default function RecentPhotosStrip({ recent, used, selected, capped, busy, onToggle, onClear, onConfirm, onSeeAll }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const order = useCallback((id: string) => selected.findIndex((s) => s.id === id) + 1, [selected]);
  const n = selected.length;

  if (!recent.length) return null;
  return (
    <View style={styles.wrap} testID="recent-strip">
      <View style={styles.header}>
        <Text style={styles.title} maxFontSizeMultiplier={1.2}>
          {capped ? `Up to ${BATCH_MAX} at a time` : n ? `${n} selected` : 'Recent photos'}
        </Text>
        {n > 0 && (
          <View style={styles.actions}>
            <Pressable onPress={onClear} hitSlop={{ top: 4, bottom: 4 }} style={styles.clear} accessibilityRole="button" accessibilityLabel="Clear selection" testID="recent-clear">
              <Text style={styles.clearText} maxFontSizeMultiplier={1.2}>Clear</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={busy}
              hitSlop={{ top: 4, bottom: 4 }}
              style={[styles.confirm, busy && styles.dim]}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel(n)}
              accessibilityState={{ disabled: busy }}
              testID="recent-confirm"
            >
              <Text style={styles.confirmText} maxFontSizeMultiplier={1.2}>{confirmLabel(n)}</Text>
            </Pressable>
          </View>
        )}
      </View>
      <FlatList
        horizontal
        data={recent}
        keyExtractor={(a) => a.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Sep}
        initialNumToRender={8}
        windowSize={5}
        removeClippedSubviews
        extraData={selected}
        renderItem={({ item }) => (
          <PhotoThumb asset={item} size={THUMB} radius={10} order={order(item.id)} used={used.has(item.id)} onPress={onToggle} />
        )}
        ListFooterComponent={
          <Pressable onPress={onSeeAll} style={styles.seeAll} accessibilityRole="button" accessibilityLabel="See all photos" testID="recent-see-all">
            <LayoutGrid size={20} strokeWidth={1.75} color={colors.inkDark} />
            <Text style={styles.seeAllText} maxFontSizeMultiplier={1.2}>See all</Text>
          </Pressable>
        }
        ListFooterComponentStyle={styles.footer}
      />
    </View>
  );
}

const Sep = () => <View style={{ width: GAP }} />;

const makeStyles = ({ colors }: Theme) => StyleSheet.create({
  wrap: { alignSelf: 'stretch', marginBottom: spacing.sm },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 44, paddingHorizontal: spacing.md,
  },
  title: { fontSize: 13, lineHeight: 18, fontFamily: fonts.text, color: colors.inkMid },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  clear: { minHeight: 40, paddingHorizontal: spacing.md, justifyContent: 'center' },
  clearText: { fontSize: 14, lineHeight: 18, fontFamily: fonts.text, color: colors.inkMid },
  confirm: {
    minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radii.full,
    backgroundColor: colors.terra, justifyContent: 'center',
  },
  confirmText: { fontSize: 14, lineHeight: 18, fontFamily: fonts.display, color: colors.white },
  dim: { opacity: 0.45 },
  list: { paddingHorizontal: spacing.md },
  footer: { marginLeft: GAP },
  seeAll: {
    width: THUMB, height: THUMB, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 2,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.ctl,
  },
  seeAllText: { fontSize: 11, lineHeight: 13, fontFamily: fonts.text, color: colors.inkDark },
});
