import { View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Image } from 'expo-image';
import { listImagePath } from '@/lib/thumbnails';
import StickerImageFallback from '@/components/StickerImageFallback';
import { Sticker } from '@/lib/types';

// A sticker on a list surface: sign, load and cache under the same
// listImagePath (skills.md #17).
// A missing URL here means signing failed (stickers only mount once URLs are in
// or the grace ran out), so the quiet fallback is a soft dot, not a spinner
// that would spin forever.
export default function Thumb({ sticker, size, url }: { sticker: Sticker; size: number; url: string | null }) {
  const { colors } = useTheme();
  if (!url && sticker.image_path) {
    const d = Math.round(size * 0.4);
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: colors.border }} />
      </View>
    );
  }
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {url ? (
        <Image
          source={{ uri: url, cacheKey: listImagePath(sticker) ?? undefined }}
          cachePolicy="memory-disk"
          style={{ width: '100%', height: '100%' }}
          contentFit="contain"
        />
      ) : (
        <StickerImageFallback sticker={sticker} size={Math.round(size * 0.55)} />
      )}
    </View>
  );
}
