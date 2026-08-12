import { StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { CutoutBorderStyle } from '@/lib/types';

interface CutoutStickerProps {
  uri: string;
  // Stable identity for this image's disk cache entry — pass the sticker's
  // storage path (not the uri itself), since the signed uri's token rotates
  // on every re-sign (see hooks/useSignedUrls.ts) and would otherwise force
  // a full re-download every time it's re-signed.
  cacheKey?: string;
  borderStyle: CutoutBorderStyle;
}

// Fakes a real sticker-sheet white outline: tintColor recolors every
// non-transparent pixel of an image using its own alpha channel as the
// mask, so stacking several white-tinted copies of the same cutout PNG in a
// ring behind the full-color one traces a rough, uniform-width border
// around the shape — no image processing needed. Only rendered for the
// 'outline' style; 'shadow'/'none' are just the container's own shadow.
const OUTLINE_OFFSETS: [number, number][] = [
  [2, 0], [-2, 0], [0, 2], [0, -2],
  [1.4, 1.4], [-1.4, 1.4], [1.4, -1.4], [-1.4, -1.4],
];

export default function CutoutSticker({ uri, cacheKey, borderStyle }: CutoutStickerProps) {
  return (
    <>
      {borderStyle === 'outline' && OUTLINE_OFFSETS.map(([dx, dy], i) => (
        <Image
          key={i}
          source={{ uri, cacheKey }}
          cachePolicy="memory-disk"
          contentFit="contain"
          style={[
            StyleSheet.absoluteFillObject,
            styles.outlineCopy,
            { transform: [{ translateX: dx }, { translateY: dy }] },
          ]}
        />
      ))}
      <Image
        source={{ uri, cacheKey }}
        cachePolicy="memory-disk"
        contentFit="contain"
        style={StyleSheet.absoluteFillObject}
      />
    </>
  );
}

const styles = StyleSheet.create({
  outlineCopy: { tintColor: '#FFFFFF' },
});
