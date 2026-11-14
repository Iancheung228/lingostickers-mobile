import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Heart } from 'lucide-react-native';
import StickerImageFallback from '@/components/StickerImageFallback';
import { listImagePath } from '@/lib/thumbnails';
import { isDue } from '@/lib/review';
import type { Sticker } from '@/lib/types';
import { colors, e1, fonts, radii, stickerShadow, wordFontFor, MIN_TAP } from '@/constants/theme';

interface Props {
  sticker: Sticker;
  imageUrl: string | null;
  onPress: (s: Sticker) => void;
  onToggleFavorite: (id: string) => void;
}

export const WELL_HEIGHT = 108;

// The Home grid cell (C-look 4 "Sticker grid cell"): a sand well with the cutout
// at 85% of it and the contact shadow, the word in the learning face, the
// meaning in caption, a "Due" tag only when due, and a heart with a 44pt hit
// area. One accessibility element per card ("pomme, apple, due today"); the
// favourite is an accessibility action, not a second focus stop.
function StickerGridCell({ sticker, imageUrl, onPress, onToggleFavorite }: Props) {
  const due = isDue(sticker);
  const fav = !!sticker.is_favorite;
  return (
    <Pressable
      testID={`sticker-cell-${sticker.word}`}
      onPress={() => onPress(sticker)}
      style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${sticker.word}, ${sticker.translation}${due ? ', due today' : ''}${fav ? ', favourite' : ''}`}
      accessibilityActions={[{ name: 'favourite', label: fav ? 'Remove from favourites' : 'Add to favourites' }]}
      onAccessibilityAction={e => { if (e.nativeEvent.actionName === 'favourite') onToggleFavorite(sticker.id); }}
    >
      <View style={styles.well}>
        <View style={styles.stickerBox}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl, cacheKey: listImagePath(sticker) ?? undefined }}
              cachePolicy="memory-disk"
              style={styles.image}
              contentFit="contain"
            />
          ) : (
            <StickerImageFallback sticker={sticker} size={40} />
          )}
        </View>
        <Pressable
          onPress={() => onToggleFavorite(sticker.id)}
          style={styles.heartHit}
          accessible={false}
          importantForAccessibility="no"
        >
          <Heart size={20} strokeWidth={1.75} color={colors.terra} fill={fav ? colors.terra : 'transparent'} />
        </Pressable>
      </View>
      <View style={styles.text}>
        <Text style={[styles.word, { fontFamily: wordFontFor(sticker.language) }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {sticker.word}
        </Text>
        <View style={styles.meaningRow}>
          <Text style={styles.meaning} numberOfLines={1} maxFontSizeMultiplier={1.5}>{sticker.translation}</Text>
          {due && <View style={styles.dueTag}><Text style={styles.dueText} maxFontSizeMultiplier={1.15}>Due</Text></View>}
        </View>
      </View>
    </Pressable>
  );
}

export default memo(StickerGridCell);

const styles = StyleSheet.create({
  cell: { flex: 1, backgroundColor: colors.card, borderRadius: radii.md, ...e1 },
  pressed: { opacity: 0.92 },
  well: {
    height: WELL_HEIGHT, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center',
    borderTopLeftRadius: radii.md, borderTopRightRadius: radii.md,
  },
  stickerBox: { width: '85%', height: '85%', ...stickerShadow },
  image: { width: '100%', height: '100%' },
  heartHit: { position: 'absolute', top: 0, right: 0, width: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center' },
  text: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 },
  word: { fontSize: 18, lineHeight: 24, color: colors.inkDark },
  meaningRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, minHeight: 20 },
  meaning: { flex: 1, fontSize: 14, lineHeight: 20, fontFamily: fonts.text, color: colors.inkLight },
  dueTag: { backgroundColor: colors.againTint, borderRadius: radii.full, paddingHorizontal: 8, paddingVertical: 2 },
  dueText: { fontSize: 12, lineHeight: 16, fontFamily: fonts.display, color: colors.error },
});
