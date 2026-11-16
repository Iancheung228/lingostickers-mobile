import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/useTheme';

// The surface of the Home wall (SPEC "Sticker wall"): a radial cream field, or
// the user's own photo under a cream top wash and a rose bottom scrim. Shared by
// the panel and the arrange editor so what you arrange is what you see.
export default function HomeWallField({ path, version = 0 }: { path?: string | null; version?: number }) {
  const { wall } = useTheme();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) { setUrl(null); return; }
    let alive = true;
    supabase.storage.from('sticker-images').createSignedUrl(path, 3600)
      .then(({ data }) => { if (alive && data) setUrl(data.signedUrl); });
    return () => { alive = false; };
  }, [path, version]);

  const photo = !!path && !!url;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="field" cx="50%" cy="30%" rx="130%" ry="100%" fx="50%" fy="30%" gradientUnits="objectBoundingBox">
            <Stop offset="0" stopColor={wall.fieldStops[0]} />
            <Stop offset="0.58" stopColor={wall.fieldStops[1]} />
            <Stop offset="1" stopColor={wall.fieldStops[2]} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#field)" />
      </Svg>
      {photo && (
        <>
          <Image
            source={{ uri: url!, cacheKey: `${path}:${version}` }}
            cachePolicy="memory-disk"
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="wash" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={wall.creamWash} />
                <Stop offset="0.7" stopColor={wall.creamWash} stopOpacity="0" />
              </LinearGradient>
              <LinearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0.6" stopColor={wall.roseScrim} stopOpacity="0" />
                <Stop offset="1" stopColor={wall.roseScrim} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#wash)" />
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#scrim)" />
          </Svg>
        </>
      )}
    </View>
  );
}
