import { useEffect, useState } from 'react';
import { View, Image, Text, StyleSheet, TouchableOpacity, ActivityIndicator, LayoutChangeEvent } from 'react-native';
import { router } from 'expo-router';
import { Sticker } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import CorkBackground from '@/components/CorkBackground';
import { colors, radii, fonts, spacing, shadows } from '@/constants/theme';

interface MiniStickerWallProps {
  stickers: Sticker[]; // newest-first, as fetched by the caller
}

// Enough to read as "a wall" without crowding a compact home-screen panel —
// past this the fan below starts overlapping tiles too heavily to tell them
// apart.
const PREVIEW_COUNT = 6;
const PANEL_HEIGHT = 160;
const BASE_TILE = 64;

function useSignedUrl(path: string) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    supabase.storage.from('sticker-images').createSignedUrl(path, 3600)
      .then(({ data }) => { if (data) setUrl(data.signedUrl); });
  }, [path]);
  return url;
}

// A short, wide preview panel doesn't suit the multi-row masonry pack used
// on the full Wall/Board screens (lib/boardLayout.ts) — with only ~6 photos
// in a strip this wide, that algorithm's left-packed last row reads
// lopsided. Instead: a single-row "fan of photos" spreading out from the
// newest capture at center — front-most, largest, least rotated — which
// reads as "here's what you just added" rather than a random scatter.
function fanSlots(n: number): number[] {
  if (n === 0) return [];
  // Center-out sequence: 0, +1, -1, +2, -2, ... — the newest sticker (i=0)
  // always lands at slot 0 (front and center); older ones alternate out to
  // either side.
  const seq: number[] = [0];
  let k = 1;
  while (seq.length < n) {
    seq.push(k);
    if (seq.length < n) seq.push(-k);
    k++;
  }
  return seq;
}

function MiniTile({
  sticker, slot, canvasWidth, canvasHeight,
}: {
  sticker: Sticker; slot: number; canvasWidth: number; canvasHeight: number;
}) {
  const url = useSignedUrl(sticker.image_path);
  const scale = Math.max(0.7, 1.15 - Math.abs(slot) * 0.09);
  const size = BASE_TILE * scale;
  const rotation = slot * 6;
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const spread = Math.min(BASE_TILE * 0.62, (canvasWidth / 2 - size / 2) / 3.2);

  const x = centerX + slot * spread - size / 2;
  const y = centerY + Math.abs(slot) * 5 - size / 2;

  return (
    <View
      style={[
        styles.tile,
        {
          left: x,
          top: y,
          width: size,
          height: size,
          zIndex: 10 - Math.abs(slot),
          transform: [{ rotate: `${rotation}deg` }],
        },
      ]}
    >
      {url ? (
        <Image source={{ uri: url }} style={styles.tileImage} resizeMode="cover" />
      ) : (
        <ActivityIndicator size="small" color={colors.terra} />
      )}
    </View>
  );
}

export default function MiniStickerWall({ stickers }: MiniStickerWallProps) {
  const [canvasWidth, setCanvasWidth] = useState(0);
  const preview = stickers.slice(0, PREVIEW_COUNT);
  const slots = fanSlots(preview.length);

  const onLayout = (e: LayoutChangeEvent) => setCanvasWidth(e.nativeEvent.layout.width);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={styles.panel}
      onLayout={onLayout}
      onPress={() => router.push('/(tabs)/wall')}
    >
      <CorkBackground />
      {preview.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>Your wall is empty — scan something to start filling it in!</Text>
        </View>
      ) : (
        canvasWidth > 0 && preview.map((sticker, i) => (
          <MiniTile
            key={sticker.id}
            sticker={sticker}
            slot={slots[i]}
            canvasWidth={canvasWidth}
            canvasHeight={PANEL_HEIGHT}
          />
        ))
      )}
      <View style={styles.label}>
        <Text style={styles.labelText}>Your Wall →</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    height: PANEL_HEIGHT,
    borderRadius: radii.xl,
    overflow: 'hidden',
    ...shadows.card,
  },
  tile: {
    position: 'absolute',
    backgroundColor: colors.card,
    borderRadius: radii.sm,
    padding: 3,
    shadowColor: colors.inkDark,
    shadowOpacity: 0.22,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  tileImage: { width: '100%', height: '100%', borderRadius: radii.xs },
  emptyWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyText: { fontSize: 13, fontWeight: '600', color: colors.inkDark, textAlign: 'center', opacity: 0.8 },
  label: {
    position: 'absolute',
    right: spacing.ms,
    bottom: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.75)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  labelText: { fontSize: 10, fontFamily: fonts.mono, fontWeight: '700', color: colors.inkDark },
});
