import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { CutoutBorderStyle, Sticker } from '@/lib/types';
import { seededRandom } from '@/lib/seededRandom';
import CutoutSticker from '@/components/CutoutSticker';
import { colors, radii, wordFontFor } from '@/constants/theme';

// One pinned cutout, taped to the home wall. Shared by the panel on the
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
  const tapeColor = TAPE_COLORS[Math.floor(seededRandom(sticker.id, 6) * TAPE_COLORS.length)];
  const tapeRotation = (seededRandom(sticker.id, 7) * 2 - 1) * 16;

  return (
    <>
      <View
        style={[
          styles.tape,
          {
            backgroundColor: tapeColor,
            width: size * 0.42,
            height: size * 0.17,
            marginLeft: -size * 0.21,
            top: -size * 0.09,
            transform: [{ rotate: `${tapeRotation}deg` }],
          },
        ]}
      />
      {url ? (
        <CutoutSticker uri={url} cacheKey={sticker.image_path} borderStyle={borderStyle} />
      ) : (
        <ActivityIndicator size="small" color={colors.terra} style={styles.loader} />
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

const TAPE_COLORS = [colors.skyNight + 'CC', colors.sageLight + 'EE', colors.terraLight + 'EE'];

const styles = StyleSheet.create({
  loader: { flex: 1 },
  tape: { position: 'absolute', left: '50%', borderRadius: 2, zIndex: 2 },
  wordChip: {
    position: 'absolute',
    bottom: -5,
    alignSelf: 'center',
    maxWidth: '96%',
    backgroundColor: 'rgba(255, 253, 244, 0.92)',
    borderRadius: radii.xs,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  wordChipText: { fontSize: 9, color: colors.inkDark, textAlign: 'center' },
});
