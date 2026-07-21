import { useEffect, useState } from 'react';
import { View, Image, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Sticker, WallDisplayStyle, CutoutBorderStyle } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import CutoutSticker from '@/components/CutoutSticker';
import { colors, radii } from '@/constants/theme';

interface DayStackProps {
  stickers: Sticker[];
  size: number;
  displayStyle?: WallDisplayStyle;
  borderStyle?: CutoutBorderStyle;
}

// Fanned photo-pile look: index 0 sits on top (front), each one behind it
// nudged out and rotated a bit more. Only ever shows the 3 most recent.
const OFFSETS = [
  { dx: 0, dy: 0, rotate: '0deg', zIndex: 3 },
  { dx: 3, dy: -2, rotate: '8deg', zIndex: 2 },
  { dx: -3, dy: 2, rotate: '-9deg', zIndex: 1 },
];

function useSignedUrl(path: string) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    supabase.storage.from('sticker-images').createSignedUrl(path, 3600)
      .then(({ data }) => { if (data) setUrl(data.signedUrl); });
  }, [path]);
  return url;
}

function StackThumb({
  sticker, size, offset, displayStyle, borderStyle,
}: {
  sticker: Sticker; size: number; offset: typeof OFFSETS[number];
  displayStyle: WallDisplayStyle; borderStyle: CutoutBorderStyle;
}) {
  const url = useSignedUrl(sticker.image_path);
  return (
    <View
      style={[
        styles.thumb,
        displayStyle === 'cutout' && styles.thumbCutout,
        displayStyle === 'cutout' && (borderStyle === 'shadow' ? styles.thumbCutoutShadow : styles.thumbCutoutFlat),
        {
          width: size,
          height: size,
          transform: [{ translateX: offset.dx }, { translateY: offset.dy }, { rotate: offset.rotate }],
          zIndex: offset.zIndex,
        },
      ]}
    >
      {url ? (
        displayStyle === 'cutout' && borderStyle === 'outline' ? (
          <CutoutSticker uri={url} borderStyle="outline" />
        ) : (
          <Image source={{ uri: url }} style={styles.image} resizeMode="contain" />
        )
      ) : (
        <ActivityIndicator size="small" color={colors.terra} />
      )}
    </View>
  );
}

export default function DayStack({ stickers, size, displayStyle = 'framed', borderStyle = 'shadow' }: DayStackProps) {
  const visible = stickers.slice(0, 3);
  const overflow = stickers.length - visible.length;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {visible.map((sticker, i) => (
        <StackThumb
          key={sticker.id}
          sticker={sticker}
          size={size * 0.82}
          offset={OFFSETS[i]}
          displayStyle={displayStyle}
          borderStyle={borderStyle}
        />
      ))}
      {overflow > 0 && (
        <View style={styles.overflowBadge}>
          <Text style={styles.overflowText}>+{overflow}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  thumb: {
    position: 'absolute',
    backgroundColor: colors.card,
    borderRadius: radii.xs,
    padding: 1,
    shadowColor: colors.inkDark,
    shadowOpacity: 0.2,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  // "Cutout" mode: no card behind the sticker shape.
  thumbCutout: {
    backgroundColor: 'transparent',
    padding: 0,
  },
  // Elevation is dropped for both — Android draws it as a rectangle
  // regardless of the PNG's alpha.
  thumbCutoutShadow: { shadowOpacity: 0.25, elevation: 0 },
  thumbCutoutFlat: { shadowOpacity: 0, elevation: 0 },
  image: { width: '100%', height: '100%' },
  overflowBadge: {
    position: 'absolute',
    bottom: -4,
    right: -6,
    minWidth: 14,
    height: 14,
    paddingHorizontal: 2,
    borderRadius: 7,
    backgroundColor: colors.terra,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  overflowText: { fontSize: 8, fontWeight: '800', color: colors.inkDark },
});
