import { useEffect, useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { WallBackgroundDim } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import CorkBackground from '@/components/CorkBackground';
import { colors } from '@/constants/theme';

// Flat scrim opacity per dim level — keeps stickers/text legible over an
// arbitrary user photo regardless of how bright or busy it is.
const DIM_OPACITY: Record<WallBackgroundDim, number> = {
  light: 0.18,
  medium: 0.38,
  dark: 0.58,
};

interface WallBackgroundProps {
  path?: string | null;
  dim?: WallBackgroundDim;
}

// Drop-in replacement for CorkBackground: falls back to the default cork
// gradient when the user hasn't set a photo, so every board/wall surface
// (custom boards and the auto chapter wall) reads as the same treatment
// whether or not they've personalized it.
export default function WallBackground({ path, dim = 'medium' }: WallBackgroundProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) { setUrl(null); return; }
    supabase.storage.from('sticker-images')
      .createSignedUrl(path, 3600)
      .then(({ data }) => { if (data) setUrl(data.signedUrl); });
  }, [path]);

  if (!path || !url) return <CorkBackground />;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Image source={{ uri: url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.inkDark, opacity: DIM_OPACITY[dim] }]} />
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="vignette" cx="50%" cy="50%" r="75%">
            <Stop offset="0.6" stopColor={colors.inkDark} stopOpacity="0" />
            <Stop offset="1" stopColor={colors.inkDark} stopOpacity="0.28" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#vignette)" />
      </Svg>
    </View>
  );
}
