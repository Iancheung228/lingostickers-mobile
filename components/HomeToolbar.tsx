import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Search, SlidersHorizontal, X } from 'lucide-react-native';
import { colors, fonts, radii, MIN_TAP } from '@/constants/theme';
import { haptic } from '@/lib/haptics';

export const TOOLBAR_HEIGHT = 52;

interface Props {
  count: number;
  searchOpen: boolean;
  query: string;
  filtersActive: boolean;
  onOpenSearch: () => void;
  onCloseSearch: () => void;
  onChangeQuery: (q: string) => void;
  onOpenFilter: () => void;
}

// "Your words N" + search + filter (C-mockups, Home). Search opens inline in the
// same row (an input and Cancel), and the filter button shows a dot when
// anything other than the defaults is on. The sticky behaviour lives in the
// screen; this is just the row.
export default function HomeToolbar({
  count, searchOpen, query, filtersActive, onOpenSearch, onCloseSearch, onChangeQuery, onOpenFilter,
}: Props) {
  const input = useRef<TextInput>(null);
  useEffect(() => { if (searchOpen) input.current?.focus(); }, [searchOpen]);

  if (searchOpen) {
    return (
      <View style={styles.row}>
        <View style={styles.field}>
          <Search size={16} strokeWidth={2} color={colors.inkLight} />
          <TextInput
            ref={input}
            testID="collection-search-input"
            value={query}
            onChangeText={onChangeQuery}
            placeholder="Search word, meaning, notes"
            placeholderTextColor={colors.inkLight}
            style={styles.input}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            maxFontSizeMultiplier={1.5}
          />
          {query.length > 0 && (
            <Pressable onPress={() => onChangeQuery('')} style={styles.clear} accessibilityRole="button" accessibilityLabel="Clear the search box">
              <X size={16} strokeWidth={2} color={colors.inkLight} />
            </Pressable>
          )}
        </View>
        <Pressable testID="collection-search-cancel" onPress={onCloseSearch} style={styles.cancel} accessibilityRole="button" accessibilityLabel="Cancel search">
          <Text style={styles.cancelText} maxFontSizeMultiplier={1.5}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <View style={styles.titleWrap}>
        <Text style={styles.title} maxFontSizeMultiplier={1.5} accessibilityRole="header">Your words</Text>
        <Text style={styles.count} maxFontSizeMultiplier={1.3}>{count}</Text>
      </View>
      <Pressable
        testID="home-search"
        onPress={() => { haptic.select(); onOpenSearch(); }}
        style={styles.btn}
        accessibilityRole="button"
        accessibilityLabel="Search your collection"
      >
        <Search size={16} strokeWidth={2} color={colors.inkDark} />
      </Pressable>
      <Pressable
        testID="home-filter"
        onPress={() => { haptic.select(); onOpenFilter(); }}
        style={styles.btn}
        accessibilityRole="button"
        accessibilityLabel={filtersActive ? 'Sort and filter, on' : 'Sort and filter'}
      >
        <SlidersHorizontal size={16} strokeWidth={2} color={colors.inkDark} />
        {filtersActive && <View style={styles.dot} />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: TOOLBAR_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20 },
  titleWrap: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  title: { fontSize: 17, lineHeight: 22, fontFamily: fonts.display, color: colors.inkDark },
  count: { fontSize: 13, lineHeight: 16, fontFamily: fonts.mono, color: colors.inkLight },
  // 40pt visual (mockup); the row is 52 tall so the hit area is 44+ vertically.
  btn: {
    width: 40, height: 40, borderRadius: radii.full, borderWidth: 1, borderColor: colors.ctl,
    backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center',
  },
  dot: { position: 'absolute', top: 7, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.terra },
  field: {
    flex: 1, height: 40, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 12,
    borderRadius: radii.full, borderWidth: 1, borderColor: colors.ctl, backgroundColor: colors.card,
  },
  input: { flex: 1, padding: 0, fontSize: 16, fontFamily: fonts.text, color: colors.inkMid },
  clear: { width: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center' },
  cancel: { minHeight: MIN_TAP, justifyContent: 'center', paddingHorizontal: 4 },
  cancelText: { fontSize: 16, fontFamily: fonts.display, color: colors.inkDark },
});
