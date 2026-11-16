import { View, Text, StyleSheet } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { CutoutBorderStyle, Sticker } from '@/lib/types';
import CutoutSticker from '@/components/CutoutSticker';
import { listImagePath } from '@/lib/thumbnails';
import StickerImageFallback from '@/components/StickerImageFallback';
import { radii, wordFontFor } from '@/constants/theme';
import { useTheme, useThemedStyles, type Theme } from '@/hooks/useTheme';

// One cutout on the home wall, with its contact shadow (no tape). Shared by the panel on the
// home feed and by the editor sheet so the two can't drift apart in how a
// tile looks — the same reason WallBackdrop was split out of
// WallBackground. Position and size are the caller's business (both derive
// them from lib/homeWall.ts); this only draws.
export default function HomeWallTile({
  sticker, size, url, showWord, borderStyle = 'outline',
}: {
  sticker: Sticker;
  size: number;
  url: string | null;
  // The user's own choice, from Profile → Cutout border. This used to be
  // hardcoded to 'outline' here and to 'none' in the editor — so the home
  // wall ignored the setting entirely, and arranging stickers showed them
  // differently from the wall you were arranging.
  borderStyle?: CutoutBorderStyle;
  // The word chip is worth its clutter while arranging (you're picking out
  // one specific sticker from ten), and not on the panel, where the wall is
  // meant to read as a picture rather than a labelled list.
  showWord?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <>
      {/* Attached contact shadow (SPEC): an ellipse at 82% of the height. */}
      <View pointerEvents="none" style={styles.contact}>
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="contact" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor={colors.shadowDeep} stopOpacity="0.30" />
              <Stop offset="0.6" stopColor={colors.shadowDeep} stopOpacity="0.16" />
              <Stop offset="1" stopColor={colors.shadowDeep} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Ellipse cx="50%" cy="50%" rx="50%" ry="50%" fill="url(#contact)" />
        </Svg>
      </View>
      {url ? (
        <CutoutSticker uri={url} cacheKey={listImagePath(sticker) ?? undefined} borderStyle={borderStyle} />
      ) : (
        // A typed card on the wall has no picture to wait for; the fallback
        // shows its glyph instead of a spinner that never stops.
        <View style={styles.loader}>
          <StickerImageFallback sticker={sticker} size={Math.round(size * 0.4)} />
        </View>
      )}
      {showWord && (
        // Frosted chip rather than bare text: the wall sits on whatever
        // photo the user picked, so the word has to carry its own contrast.
        <View style={styles.wordChip}>
          <Text style={[styles.wordChipText, { fontFamily: wordFontFor(sticker.language) }]} numberOfLines={1}>{sticker.word}</Text>
        </View>
      )}
    </>
  );
}

const makeStyles = ({ colors }: Theme) => StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // 9pt ellipse at 82% of the height, softened by a radial fade (RN has no blur).
  contact: { position: 'absolute', left: '14%', right: '14%', top: '79%', height: 15 },
  wordChip: {
    position: 'absolute',
    bottom: -5,
    alignSelf: 'center',
    maxWidth: '96%',
    backgroundColor: colors.glass,
    borderRadius: radii.xs,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  wordChipText: { fontSize: 9, color: colors.inkDark, textAlign: 'center' },
});
