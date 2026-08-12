import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  LayoutChangeEvent, Animated, Alert,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { ImagePlus } from 'lucide-react-native';
import { Sticker, WallBackgroundDim } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { useSignedUrls } from '@/hooks/useSignedUrls';
import { seededRandom } from '@/lib/seededRandom';
import WallBackground from '@/components/WallBackground';
import CutoutSticker from '@/components/CutoutSticker';
import BackgroundCropper from '@/components/BackgroundCropper';
import { colors, radii, fonts, spacing, shadows } from '@/constants/theme';

interface MiniStickerWallProps {
  stickers: Sticker[]; // newest-first, as fetched by the caller
  userId?: string;
  backgroundPath?: string | null;
  backgroundDim?: WallBackgroundDim;
  onChangeBackground: (path: string | null) => Promise<{ error: Error | null }>;
}

// Enough to read as "a wall" without crowding a compact home-screen panel —
// past this the fan below starts overlapping tiles too heavily to tell them
// apart.
const PREVIEW_COUNT = 6;
const PANEL_HEIGHT = 160;
const BASE_TILE = 64;
const HOME_BACKGROUND_MAX_SIDE = 1600;
const TAPE_COLORS = [colors.skyNight + 'CC', colors.sageLight + 'EE', colors.terraLight + 'EE'];
const NEW_WINDOW_MS = 24 * 60 * 60 * 1000;

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

// "Most fav or recent": the newest capture always anchors the center, the
// rest of the fan is a blend of your favorites and your latest additions
// (deduped) rather than a strict recency list — favoriting something is a
// direct way to make it show up here.
function pickPreview(stickers: Sticker[]): Sticker[] {
  if (stickers.length === 0) return [];
  const [hero, ...rest] = stickers;
  const favorites = rest.filter(s => s.is_favorite).slice(0, 3);
  const favoriteIds = new Set(favorites.map(s => s.id));
  const recents = rest.filter(s => !favoriteIds.has(s.id));
  const fillCount = Math.max(PREVIEW_COUNT - 1 - favorites.length, 0);
  return [hero, ...favorites, ...recents.slice(0, fillCount)];
}

function MiniTile({
  sticker, slot, canvasWidth, canvasHeight, isHero, heroScale, opacity, url,
}: {
  sticker: Sticker; slot: number; canvasWidth: number; canvasHeight: number;
  isHero: boolean; heroScale: Animated.Value; opacity: Animated.Value; url: string | null;
}) {
  const scale = Math.max(0.7, 1.15 - Math.abs(slot) * 0.09);
  const size = BASE_TILE * scale;
  // Systematic fan rotation (by slot) plus a small per-sticker jitter, so
  // tiles read as individually pinned rather than mechanically arranged.
  const jitter = (seededRandom(sticker.id, 5) * 2 - 1) * 4;
  const rotation = slot * 6 + jitter;
  const tapeColor = TAPE_COLORS[Math.floor(seededRandom(sticker.id, 6) * TAPE_COLORS.length)];
  const tapeRotation = (seededRandom(sticker.id, 7) * 2 - 1) * 16;
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const spread = Math.min(BASE_TILE * 0.62, (canvasWidth / 2 - size / 2) / 3.2);

  const x = centerX + slot * spread - size / 2;
  const y = centerY + Math.abs(slot) * 5 - size / 2;
  const isFresh = Date.now() - new Date(sticker.created_at).getTime() < NEW_WINDOW_MS;

  return (
    <Animated.View
      style={[
        styles.tile,
        {
          left: x,
          top: y,
          width: size,
          height: size,
          zIndex: 10 - Math.abs(slot),
          opacity,
          transform: [
            { rotate: `${rotation}deg` },
            { scale: isHero ? heroScale : 1 },
          ],
        },
      ]}
    >
      <View style={[styles.tape, { backgroundColor: tapeColor, transform: [{ rotate: `${tapeRotation}deg` }] }]} />
      {url ? (
        <CutoutSticker uri={url} cacheKey={sticker.image_path} borderStyle="outline" />
      ) : (
        <ActivityIndicator size="small" color={colors.terra} style={styles.tileLoader} />
      )}
      {isHero && isFresh && (
        <View style={styles.newBadge}>
          <Text style={styles.newBadgeText}>✨ new</Text>
        </View>
      )}
    </Animated.View>
  );
}

// Owns the entrance stagger + hero "breathing" idle animation. Keyed by the
// caller on the joined preview ids, so it fully remounts (fresh Animated
// values, replayed entrance) only when the actual set of stickers shown
// changes — not on every unrelated re-render of the parent screen.
function TileFan({
  preview, slots, canvasWidth, canvasHeight, urls,
}: {
  preview: Sticker[]; slots: number[]; canvasWidth: number; canvasHeight: number; urls: Map<string, string>;
}) {
  const opacities = useRef(preview.map(() => new Animated.Value(0))).current;
  const heroScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.stagger(45, opacities.map(v =>
      Animated.timing(v, { toValue: 1, duration: 260, useNativeDriver: true })
    )).start();

    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(heroScale, { toValue: 1.035, duration: 1800, useNativeDriver: true }),
        Animated.timing(heroScale, { toValue: 1, duration: 1800, useNativeDriver: true }),
      ])
    );
    breathe.start();
    return () => breathe.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {preview.map((sticker, i) => (
        <MiniTile
          key={sticker.id}
          sticker={sticker}
          slot={slots[i]}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          isHero={slots[i] === 0}
          heroScale={heroScale}
          opacity={opacities[i]}
          url={urls.get(sticker.image_path) ?? null}
        />
      ))}
    </>
  );
}

export default function MiniStickerWall({
  stickers, userId, backgroundPath, backgroundDim, onChangeBackground,
}: MiniStickerWallProps) {
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [pickedAsset, setPickedAsset] = useState<{ uri: string; width: number; height: number } | null>(null);
  // home_background_path is a fixed filename (see handleCropConfirm) so it
  // reads identically before and after a re-upload — bump this alongside it
  // so WallBackground actually re-fetches a fresh signed URL instead of
  // silently keeping the old photo on screen. See WallBackground.tsx.
  const [backgroundVersion, setBackgroundVersion] = useState(0);
  const preview = useMemo(() => pickPreview(stickers), [stickers]);
  const slots = fanSlots(preview.length);
  const previewKey = preview.map(s => s.id).join(',');
  // One batched sign request for the whole fan instead of each tile minting
  // its own — see hooks/useSignedUrls.ts.
  const previewUrls = useSignedUrls(useMemo(() => preview.map(s => s.image_path), [previewKey]));

  const onLayout = (e: LayoutChangeEvent) => setCanvasWidth(e.nativeEvent.layout.width);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(tabs)/wall');
  };

  // Picking only stages the photo into the cropper (see BackgroundCropper) —
  // the actual resize/upload happens once the user confirms a crop in
  // handleCropConfirm, so nobody uploads a photo they haven't previewed.
  const handlePickBackground = async () => {
    if (!userId || uploadingBackground) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Photos Access Needed', 'LingoStickers needs access to your photo library to set a cover photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    const asset = !result.canceled ? result.assets[0] : null;
    if (!asset) return;
    setPickedAsset({ uri: asset.uri, width: asset.width, height: asset.height });
  };

  // Mirrors the full Wall tab's own background upload (app/profile.tsx) but
  // writes to home_background_path instead of wall_background_path — the
  // two are deliberately independent so personalizing this preview doesn't
  // also change the real Wall tab, or vice versa. The cropper has already
  // cropped, resized, and compressed the file, so this just uploads it.
  const handleCropConfirm = async (localUri: string) => {
    if (!userId) return;
    setPickedAsset(null);
    setUploadingBackground(true);
    try {
      // Fixed filename + upsert so re-uploading just replaces the old photo
      // rather than accumulating orphaned files under the user's folder.
      const path = `${userId}/home-background.jpg`;
      const bytes = await new File(localUri).bytes();
      const { error: uploadError } = await supabase.storage
        .from('sticker-images')
        .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;

      const { error } = await onChangeBackground(path);
      if (error) throw error;
      setBackgroundVersion(v => v + 1);
    } catch (err: any) {
      Alert.alert("Couldn't set cover photo", err?.message ?? 'Something went wrong.');
    } finally {
      setUploadingBackground(false);
    }
  };

  const handleRemoveBackground = () => {
    if (!backgroundPath) return;
    Alert.alert(
      'Remove cover photo',
      'Go back to the default corkboard look?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            const path = backgroundPath;
            const { error } = await onChangeBackground(null);
            if (error) { Alert.alert("Couldn't remove cover photo", error.message); return; }
            await supabase.storage.from('sticker-images').remove([path]);
          },
        },
      ]
    );
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={styles.panel}
      onLayout={onLayout}
      onPress={handlePress}
    >
      <WallBackground path={backgroundPath} dim={backgroundDim} version={backgroundVersion} />
      {preview.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>Your wall is empty — scan something to start filling it in!</Text>
        </View>
      ) : (
        canvasWidth > 0 && (
          <TileFan key={previewKey} preview={preview} slots={slots} canvasWidth={canvasWidth} canvasHeight={PANEL_HEIGHT} urls={previewUrls} />
        )
      )}
      <View style={styles.label}>
        <Text style={styles.labelText}>Your Wall →</Text>
      </View>

      {!!userId && (
        <TouchableOpacity
          style={styles.editBtn}
          onPress={handlePickBackground}
          onLongPress={backgroundPath ? handleRemoveBackground : undefined}
          delayLongPress={400}
          hitSlop={8}
          activeOpacity={0.8}
        >
          {uploadingBackground ? (
            <ActivityIndicator size="small" color={colors.inkDark} />
          ) : (
            <ImagePlus size={14} color={colors.inkDark} />
          )}
        </TouchableOpacity>
      )}

      <BackgroundCropper
        asset={pickedAsset}
        frameWidth={canvasWidth}
        frameHeight={PANEL_HEIGHT}
        maxOutputSide={HOME_BACKGROUND_MAX_SIDE}
        onCancel={() => setPickedAsset(null)}
        onConfirm={handleCropConfirm}
      />
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
  // No card/background here on purpose — just the sticker's own cutout PNG
  // (CutoutSticker), so the panel shows photos "floating" on the board
  // rather than boxed in white index cards. Android ignores PNG alpha for
  // shadow shape, so elevation is dropped there (matches BoardCanvas.tsx's
  // cutout tiles) — the shadow only really shows on iOS.
  tile: {
    position: 'absolute',
    shadowColor: colors.inkDark,
    shadowOpacity: 0.22,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 0,
  },
  tileLoader: { flex: 1 },
  tape: {
    position: 'absolute',
    top: -8,
    left: '50%',
    marginLeft: -14,
    width: 28,
    height: 11,
    borderRadius: 2,
  },
  newBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: colors.sage,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: radii.full,
    ...shadows.card,
  },
  newBadgeText: { fontSize: 8, fontFamily: fonts.mono, fontWeight: '700', color: colors.inkDark },
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
  editBtn: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    width: 26,
    height: 26,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
});
