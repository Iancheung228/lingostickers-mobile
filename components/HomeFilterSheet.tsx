import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import BottomSheet, { type BottomSheetHandle } from '@/components/BottomSheet';
import Button from '@/components/ui/Button';
import { colors, fonts, spacing, MIN_TAP } from '@/constants/theme';
import { haptic } from '@/lib/haptics';

export type SortMode = 'newest' | 'oldest' | 'due' | 'az';
export const DEFAULT_SORT: SortMode = 'newest';
export const SORT_LABELS: Record<SortMode, string> = {
  newest: 'Newest',
  oldest: 'Oldest',
  due: 'Due soonest',
  az: 'A to Z',
};
const SORT_ORDER: SortMode[] = ['newest', 'oldest', 'due', 'az'];

interface Props {
  sort: SortMode;
  favoritesOnly: boolean;
  dueOnly: boolean;
  onSort: (s: SortMode) => void;
  onFavoritesOnly: (v: boolean) => void;
  onDueOnly: (v: boolean) => void;
  onReset: () => void;
  onClosed: () => void;
}

// Sort (one of four), Show (favourites only, due only) and Reset. Changes apply
// at once so the grid behind the sheet shows what you chose; Done just closes.
export default function HomeFilterSheet({
  sort, favoritesOnly, dueOnly, onSort, onFavoritesOnly, onDueOnly, onReset, onClosed,
}: Props) {
  const sheet = useRef<BottomSheetHandle>(null);
  const isDefault = sort === DEFAULT_SORT && !favoritesOnly && !dueOnly;
  return (
    <BottomSheet
      ref={sheet}
      onRequestClose={() => sheet.current?.close()}
      onClosed={onClosed}
      header={<Text style={styles.title} accessibilityRole="header">Sort and filter</Text>}
    >
      <View style={styles.body}>
        <Text style={styles.section}>Sort by</Text>
        {SORT_ORDER.map(mode => (
          <Pressable
            key={mode}
            testID={`collection-sort-${mode}`}
            style={styles.option}
            accessibilityRole="button"
            accessibilityState={{ selected: sort === mode }}
            onPress={() => { haptic.select(); onSort(mode); }}
          >
            <Text style={[styles.optionText, sort === mode && styles.optionOn]}>{SORT_LABELS[mode]}</Text>
            {sort === mode && <Check size={18} strokeWidth={2} color={colors.terra} />}
          </Pressable>
        ))}

        <Text style={[styles.section, styles.sectionGap]}>Show</Text>
        <Pressable
          testID="home-filter-fav"
          style={styles.option}
          accessibilityRole="button"
          accessibilityLabel="Favourites only"
          accessibilityState={{ selected: favoritesOnly }}
          onPress={() => { haptic.select(); onFavoritesOnly(!favoritesOnly); }}
        >
          <Text style={[styles.optionText, favoritesOnly && styles.optionOn]}>Favourites only</Text>
          {favoritesOnly && <Check size={18} strokeWidth={2} color={colors.terra} />}
        </Pressable>
        <Pressable
          testID="home-filter-due"
          style={styles.option}
          accessibilityRole="button"
          accessibilityLabel="Due only"
          accessibilityState={{ selected: dueOnly }}
          onPress={() => { haptic.select(); onDueOnly(!dueOnly); }}
        >
          <Text style={[styles.optionText, dueOnly && styles.optionOn]}>Due only</Text>
          {dueOnly && <Check size={18} strokeWidth={2} color={colors.terra} />}
        </Pressable>

        <View style={styles.actions}>
          <Button label="Reset" kind="secondary" disabled={isDefault} onPress={onReset} style={styles.flex} testID="home-filter-reset" />
          <Button label="Done" onPress={() => sheet.current?.close()} style={styles.flex} testID="home-filter-done" />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, lineHeight: 28, fontFamily: fonts.display, color: colors.inkDark, paddingHorizontal: 20, marginBottom: spacing.sm },
  body: { paddingHorizontal: 20, paddingBottom: spacing.md },
  section: { fontSize: 14, lineHeight: 20, fontFamily: fonts.text, color: colors.inkLight, marginBottom: 4, marginLeft: 4 },
  sectionGap: { marginTop: spacing.md },
  option: {
    minHeight: MIN_TAP + 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider,
  },
  optionText: { fontSize: 16, fontFamily: fonts.text, color: colors.inkMid },
  optionOn: { fontFamily: fonts.display, color: colors.inkDark },
  actions: { flexDirection: 'row', gap: 12, marginTop: spacing.md },
  flex: { flex: 1 },
});
