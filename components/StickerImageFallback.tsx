import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import type { Sticker } from '@/lib/types';
import { wordFontFor } from '@/constants/theme';
import { useTheme, useThemedStyles, type Theme } from '@/hooks/useTheme';

// What a sticker's picture slot shows while there is no picture to draw.
//
// Two different situations used to share one spinner. A sticker with an
// image_path is waiting on a signed URL or a download, and a spinner is right.
// A card with no image_path at all (typed in with TypeWordSheet, or a scene
// card, since migration 043) will never get a picture, so the spinner spun
// forever and read as "still loading" on every visit. Those cards get their
// word's first character instead, in the word's own font family.
export default function StickerImageFallback({
  sticker,
  size = 28,
}: {
  sticker: Pick<Sticker, 'image_path' | 'word' | 'language'>;
  /** Font size of the glyph shown for a card with no picture. */
  size?: number;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  // Every call site centres its picture slot, so neither branch needs layout
  // of its own.
  if (sticker.image_path) {
    return <ActivityIndicator color={colors.terraInk} />;
  }
  // Array.from splits by code point, so a kana or a surrogate-pair character
  // is kept whole rather than cut in half.
  const glyph = Array.from(headword(sticker.word, sticker.language))[0] ?? '';
  return (
    <Text
      style={[styles.glyph, { fontSize: size, fontFamily: wordFontFor(sticker.language) }]}
      accessible={false}
    >
      {glyph}
    </Text>
  );
}

// French cards often carry their article ("un quokka", "l'arbre"), which
// would make half the collection's placeholders a "u" or an "l". The glyph is
// meant to identify the word, so it skips the article. Japanese and Cantonese
// have none to skip.
const FRENCH_ARTICLE = /^(?:(?:un|une|le|la|les|des|du)\s+|l['’]\s*)/i;

function headword(word: string, language: Sticker['language']): string {
  const trimmed = word.trim();
  if (language !== 'fr') return trimmed;
  const rest = trimmed.replace(FRENCH_ARTICLE, '');
  return rest || trimmed;
}

const makeStyles = ({ colors }: Theme) => StyleSheet.create({
  glyph: { color: colors.inkFaint, textAlign: 'center' },
});
