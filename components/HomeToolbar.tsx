import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Search, SlidersHorizontal, X } from 'lucide-react-native';
import { colors, fonts, radii, MIN_TAP } from '@/constants/theme';
import IconButton from '@/components/ui/IconButton';

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
      <IconButton testID="home-search" label="Search your collection" onPress={onOpenSearch}>
        <Search size={18} strokeWidth={2} color={colors.inkDark} />
      </IconButton>
      <IconButton
        testID="home-filter"
        label={filtersActive ? 'Sort and filter, on' : 'Sort and filter'}
        onPress={onOpenFilter}
        dot={filtersActive}
      >
        <SlidersHorizontal size={18} strokeWidth={2} color={colors.inkDark} />
      </IconButton>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: TOOLBAR_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20 },
  titleWrap: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  title: { fontSize: 17, lineHeight: 22, fontFamily: fonts.display, color: colors.inkDark },
  count: { fontSize: 13, lineHeight: 16, fontFamily: fonts.mono, color: colors.inkLight },
  field: {
    flex: 1, height: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 12,
    borderRadius: radii.full, borderWidth: 1, borderColor: colors.ctl, backgroundColor: colors.card,
  },
  input: { flex: 1, padding: 0, fontSize: 16, fontFamily: fonts.text, color: colors.inkMid },
  clear: { width: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center' },
  cancel: { minHeight: MIN_TAP, justifyContent: 'center', paddingHorizontal: 4 },
  cancelText: { fontSize: 16, fontFamily: fonts.display, color: colors.inkDark },
});
