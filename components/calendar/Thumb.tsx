import { View } from 'react-native';
import { Image } from 'expo-image';
import { listImagePath } from '@/lib/thumbnails';
import StickerImageFallback from '@/components/StickerImageFallback';
import { Sticker } from '@/lib/types';

// A sticker on a list surface: sign, load and cache under the same
// listImagePath (skills.md #17).
export default function Thumb({ sticker, size, url }: { sticker: Sticker; size: number; url: string | null }) {
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
