import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { WallBackgroundDim } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import CorkBackground from '@/components/CorkBackground';
import { colors } from '@/constants/theme';

// Flat scrim opacity per dim level — keeps stickers/text legible over an
// arbitrary user photo regardless of how bright or busy it is. 'none' skips
// the scrim (and the vignette below) entirely, for previewing the photo as-
// uploaded with no darkening at all. Only the home mini-wall preview
// (profiles.home_background_dim) still uses this fixed enum — boards moved
// to a continuous percentage, see MAX_DIM_PCT below.
export const DIM_OPACITY: Record<WallBackgroundDim, number> = {
  none: 0,
  light: 0.18,
  medium: 0.38,
  dark: 0.58,
};

// Boards' tint slider (BackgroundDimSlider) goes from 0 to this many percent
// — capped below 100 so the scrim never gets dark enough to actually hide
// the photo/stickers, matching the legibility intent the old fixed levels
// had (the darkest of which, 'dark', was 58%).
export const MAX_DIM_PCT = 70;

interface WallBackdropProps {
  // Already-resolved signed URL, or null for "no photo" / "not signed yet".
  url: string | null;
  // Boards pass a percent (0-MAX_DIM_PCT); the home mini-wall preview still
  // passes the fixed none/light/medium/dark enum.
  dim?: WallBackgroundDim | number;
  // Stable identity for expo-image's cache. Callers that replace the file
  // behind a fixed path must vary this (see WallBackground's `version`).
  cacheKey?: string;
}

// The *look* of a board surface, with no opinion about where the URL came
// from. Split out from WallBackground below because the two places that draw
// a board surface resolve their URLs differently: the canvas signs one path
// on its own (WallBackground), while BoardRail signs every tile's photo in
// one batched createSignedUrls call and already holds the result. Before
// this split the rail hand-rolled its own image + scrim and silently drifted
// — it never drew the vignette, so a dimmed board looked edge-darkened on
// the canvas and flat in its own thumbnail. Two copies of one appearance is
// the rendering-side version of skills.md #1: if more than one component has
// to *agree* on something, it gets one definition, not two.
export function WallBackdrop({ url, dim = 'medium', cacheKey }: WallBackdropProps) {
  if (!url) return <CorkBackground />;

  const dimOpacity = typeof dim === 'number' ? dim / 100 : DIM_OPACITY[dim];

  return (
    <View style={StyleSheet.absoluteFill}>
      <Image
        source={{ uri: url, cacheKey }}
        cachePolicy="memory-disk"
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />
      {dimOpacity > 0 && (
        <>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.inkDark, opacity: dimOpacity }]} />
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <RadialGradient id="vignette" cx="50%" cy="50%" r="75%">
                <Stop offset="0.6" stopColor={colors.inkDark} stopOpacity="0" />
                <Stop offset="1" stopColor={colors.inkDark} stopOpacity="0.28" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#vignette)" />
          </Svg>
        </>
      )}
    </View>
  );
}

interface WallBackgroundProps {
  path?: string | null;
  dim?: WallBackgroundDim | number;
  // Every background photo (home preview, per-board cover) is uploaded to a
  // fixed filename with upsert:true so re-uploading doesn't accumulate
  // orphaned files — but that means `path` stays the exact same string
  // before and after someone replaces the photo, so it can't be the only
  // effect dependency below or a re-upload would silently never refetch.
  // Callers that mutate the underlying file in place must bump this on every
  // successful upload so a fresh signed URL actually gets fetched.
  version?: number;
}

// Drop-in replacement for CorkBackground: falls back to the default cork
// gradient when the user hasn't set a photo, so every board/wall surface
// (custom boards and the auto chapter wall) reads as the same treatment
// whether or not they've personalized it. Signs its own URL — use
// WallBackdrop directly if you already have one in hand.
export default function WallBackground({ path, dim = 'medium', version }: WallBackgroundProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) { setUrl(null); return; }
    supabase.storage.from('sticker-images')
      .createSignedUrl(path, 3600)
      .then(({ data }) => { if (data) setUrl(data.signedUrl); });
  }, [path, version]);

  return (
    <WallBackdrop
      url={path ? url : null}
      dim={dim}
      cacheKey={path ? `${path}:${version ?? 0}` : undefined}
    />
  );
}
