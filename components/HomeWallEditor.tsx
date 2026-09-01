import { useEffect, useMemo, useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, FlatList,
  SafeAreaView, ActivityIndicator, Alert, useWindowDimensions,
} from 'react-native';
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, runOnJS, withTiming, withSpring, SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { Check, ImagePlus, Trash2, Wand2, X } from 'lucide-react-native';
import { Sticker, HomeStickerWithSticker, WallBackgroundDim } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { useSignedUrls } from '@/hooks/useSignedUrls';
import { homeCanvasSize, homeTileFraction, maxPlacement, HOME_WALL_CAP } from '@/lib/homeWall';
import WallBackground from '@/components/WallBackground';
import BackgroundCropper, { CropResult } from '@/components/BackgroundCropper';
import CutoutSticker from '@/components/CutoutSticker';
import HomeWallTile from '@/components/HomeWallTile';
import { colors, radii, fonts, spacing, shadows } from '@/constants/theme';

const HOME_BACKGROUND_MAX_SIDE = 1600;
const TRASH_SIZE = 52;
const TRASH_MARGIN = 10;
const TRAY_TILE = 62;

interface HomeWallEditorProps {
  visible: boolean;
  onClose: () => void;
  userId: string | undefined;
  // The whole collection, to pick from. Passed in rather than re-queried:
  // the home screen already holds this list.
  stickers: Sticker[];
  items: HomeStickerWithSticker[];
  onAdd: (stickerId: string, aspect: number) => Promise<{ error: Error | null }>;
  onRemove: (stickerId: string) => Promise<{ error: Error | null }>;
  onMove: (stickerId: string, x: number, y: number) => void;
  onTidy: (aspect: number) => Promise<{ error: Error | null }>;
  backgroundPath?: string | null;
  backgroundDim?: WallBackgroundDim;
  backgroundVersion: number;
  onChangeBackground: (path: string | null) => Promise<{ error: Error | null }>;
  onBackgroundUploaded: () => void;
}

export default function HomeWallEditor({
  visible, onClose, userId, stickers, items,
  onAdd, onRemove, onMove, onTidy,
  backgroundPath, backgroundDim, backgroundVersion, onChangeBackground, onBackgroundUploaded,
}: HomeWallEditorProps) {
  const { width: screenWidth } = useWindowDimensions();
  // Derived from the same constants the home panel uses, so the canvas here
  // is the panel's exact aspect ratio on every device — which is the whole
  // reason free placement is trustworthy: what you arrange is what shows up
  // on the home screen, not a re-flow of it. See lib/homeWall.ts.
  const canvas = useMemo(() => homeCanvasSize(screenWidth), [screenWidth]);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [pickedAsset, setPickedAsset] = useState<{ uri: string; width: number; height: number } | null>(null);

  const placedIds = useMemo(() => new Set(items.map(i => i.sticker_id)), [items]);
  const atCap = items.length >= HOME_WALL_CAP;

  const trayUrls = useSignedUrls(useMemo(() => stickers.map(s => s.image_path), [stickers]));
  const canvasUrls = useSignedUrls(useMemo(() => items.map(i => i.sticker.image_path), [items]));

  // Shared across every tile so whichever one is being dragged can reveal
  // the trash zone and report hovering it — only one drag at a time matters.
  const dragActive = useSharedValue(0);
  const hoverTrash = useSharedValue(0);

  const trashBounds = {
    left: canvas.width / 2 - TRASH_SIZE / 2,
    top: canvas.height - TRASH_SIZE - TRASH_MARGIN,
    size: TRASH_SIZE,
  };

  const trashStyle = useAnimatedStyle(() => ({
    opacity: dragActive.value,
    transform: [{ scale: 0.8 + dragActive.value * 0.2 + hoverTrash.value * 0.15 }],
    backgroundColor: hoverTrash.value ? colors.error : colors.inkDark,
  }));

  const handleToggle = async (sticker: Sticker) => {
    if (placedIds.has(sticker.id)) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await onRemove(sticker.id);
      return;
    }
    if (atCap) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await onAdd(sticker.id, canvas.aspect);
  };

  const handleTidy = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await onTidy(canvas.aspect);
  };

  // Picking only stages the photo into the cropper — the resize/upload
  // happens on confirm, so nobody uploads a photo they haven't previewed.
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

  // Takes only the cropped result: the home wall offers "change photo", not
  // "reposition the one that's there", so it has no use for the source or
  // the crop rect the editor also hands back (see CropResult).
  const handleCropConfirm = async ({ uri: localUri }: CropResult) => {
    if (!userId) return;
    setPickedAsset(null);
    setUploadingBackground(true);
    try {
      // Fixed filename + upsert so re-uploading replaces the old photo
      // rather than accumulating orphans under the user's folder.
      const path = `${userId}/home-background.jpg`;
      const bytes = await new File(localUri).bytes();
      const { error: uploadError } = await supabase.storage
        .from('sticker-images')
        .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;

      const { error } = await onChangeBackground(path);
      if (error) throw error;
      onBackgroundUploaded();
    } catch (err: any) {
      Alert.alert("Couldn't set cover photo", err?.message ?? 'Something went wrong.');
    } finally {
      setUploadingBackground(false);
    }
  };

  const handleRemoveBackground = () => {
    if (!backgroundPath) return;
    Alert.alert('Remove cover photo', 'Go back to the default corkboard look?', [
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
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {/* A RN Modal renders into its own view hierarchy, outside the root
          provider in app/_layout.tsx — without its own root here, none of
          the drag gestures below would ever fire. */}
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>Arrange your wall</Text>
              <Text style={[styles.subtitle, atCap && styles.subtitleFull]}>
                {atCap
                  ? `Wall full (${HOME_WALL_CAP}) — take one off to add another`
                  : `${items.length} of ${HOME_WALL_CAP} pinned · drag to move, drag onto the bin to remove`}
              </Text>
            </View>
            <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.canvasWrap}>
            <View style={[styles.canvas, { width: canvas.width, height: canvas.height }]}>
              <WallBackground path={backgroundPath} dim={backgroundDim} version={backgroundVersion} />

              {items.map(item => (
                <DraggableTile
                  key={item.sticker_id}
                  item={item}
                  canvas={canvas}
                  url={canvasUrls.get(item.sticker.image_path) ?? null}
                  onMove={onMove}
                  onRemove={onRemove}
                  dragActive={dragActive}
                  hoverTrash={hoverTrash}
                  trashBounds={trashBounds}
                />
              ))}

              {items.length === 0 && (
                <View style={styles.canvasEmpty}>
                  <Text style={styles.canvasEmptyText}>
                    Tap stickers below to pin them here.
                  </Text>
                </View>
              )}

              <Animated.View
                pointerEvents="none"
                style={[
                  styles.trashZone,
                  trashStyle,
                  {
                    left: trashBounds.left, top: trashBounds.top,
                    width: trashBounds.size, height: trashBounds.size,
                    borderRadius: trashBounds.size / 2,
                  },
                ]}
              >
                <Trash2 size={20} color={colors.card} />
              </Animated.View>
            </View>
          </View>

          <View style={styles.toolbar}>
            <TouchableOpacity
              style={[styles.toolBtn, items.length === 0 && styles.toolBtnDisabled]}
              onPress={handleTidy}
              disabled={items.length === 0}
              activeOpacity={0.85}
            >
              <Wand2 size={14} color={colors.inkDark} />
              <Text style={styles.toolText}>Tidy up</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolBtn} onPress={handlePickBackground} activeOpacity={0.85}>
              {uploadingBackground ? (
                <ActivityIndicator size="small" color={colors.inkDark} />
              ) : (
                <ImagePlus size={14} color={colors.inkDark} />
              )}
              <Text style={styles.toolText}>{backgroundPath ? 'Change photo' : 'Cover photo'}</Text>
            </TouchableOpacity>

            {/* Used to be a hidden long-press on the panel's corner button,
                which is not a thing anyone finds on purpose. */}
            {!!backgroundPath && (
              <TouchableOpacity style={styles.toolIconBtn} onPress={handleRemoveBackground} activeOpacity={0.85} hitSlop={8}>
                <X size={14} color={colors.inkDark} />
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.trayLabel}>Your collection</Text>
          {stickers.length === 0 ? (
            <Text style={styles.trayEmpty}>Nothing in your collection yet — scan something first!</Text>
          ) : (
            // A tray rather than the full-screen StickerPickerModal used by
            // boards: stacking a second sheet over this one would hide the
            // wall at exactly the moment you're deciding what belongs on it.
            <FlatList
              data={stickers}
              keyExtractor={s => s.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tray}
              renderItem={({ item }) => {
                const placed = placedIds.has(item.id);
                const url = trayUrls.get(item.image_path) ?? null;
                return (
                  <TouchableOpacity
                    style={[
                      styles.trayItem,
                      placed && styles.trayItemPlaced,
                      !placed && atCap && styles.trayItemBlocked,
                    ]}
                    onPress={() => handleToggle(item)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.trayImage}>
                      {url ? (
                        <CutoutSticker uri={url} cacheKey={item.image_path} borderStyle="none" />
                      ) : (
                        <ActivityIndicator size="small" color={colors.terra} />
                      )}
                    </View>
                    {placed && (
                      <View style={styles.trayCheck}>
                        <Check size={11} color={colors.white} strokeWidth={3} />
                      </View>
                    )}
                    <Text style={styles.trayWord} numberOfLines={1}>{item.word}</Text>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </SafeAreaView>

        <BackgroundCropper
          asset={pickedAsset}
          frameWidth={canvas.width}
          frameHeight={canvas.height}
          maxOutputSide={HOME_BACKGROUND_MAX_SIDE}
          onCancel={() => setPickedAsset(null)}
          onConfirm={handleCropConfirm}
        />
      </GestureHandlerRootView>
    </Modal>
  );
}

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

function DraggableTile({
  item, canvas, url, onMove, onRemove, dragActive, hoverTrash, trashBounds,
}: {
  item: HomeStickerWithSticker;
  canvas: { width: number; height: number; aspect: number };
  url: string | null;
  onMove: (stickerId: string, x: number, y: number) => void;
  onRemove: (stickerId: string) => Promise<{ error: Error | null }>;
  dragActive: SharedValue<number>;
  hoverTrash: SharedValue<number>;
  trashBounds: { left: number; top: number; size: number };
}) {
  const side = homeTileFraction(item.sticker_id) * canvas.width;
  const { maxX: maxFx, maxY: maxFy } = maxPlacement(homeTileFraction(item.sticker_id), canvas.aspect);
  const maxX = maxFx * canvas.width;
  const maxY = maxFy * canvas.height;

  const x = useSharedValue(item.x * canvas.width);
  const y = useSharedValue(item.y * canvas.height);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const lifted = useSharedValue(0);

  // Re-sync from stored coordinates when they change outside a gesture —
  // "Tidy up" rewrites every position at once, and the tile has to follow.
  // Skipped mid-drag, where the finger is the authority on where this tile
  // is and an incoming echo of its own last write would fight it.
  useEffect(() => {
    if (lifted.value !== 0) return;
    x.value = withTiming(item.x * canvas.width, { duration: 220 });
    y.value = withTiming(item.y * canvas.height, { duration: 220 });
  }, [item.x, item.y, canvas.width, canvas.height]);

  const commitMove = (nx: number, ny: number) => {
    // Back to fractions on the way out: the panel renders the same numbers
    // against a different canvas size.
    onMove(item.sticker_id, nx / canvas.width, ny / canvas.height);
  };
  const commitRemove = () => { onRemove(item.sticker_id); };
  const pickup = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  const overTrash = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

  // No activateAfterLongPress here, unlike BoardCanvas: the board needs a
  // hold because a plain tap there opens the sticker. Edit mode is explicit
  // on this screen, so a tap has nothing else to mean and drag can start
  // immediately — which is most of why arranging here feels lighter.
  const pan = useMemo(() => Gesture.Pan()
    .onStart(() => {
      startX.value = x.value;
      startY.value = y.value;
      lifted.value = withSpring(1, { damping: 18, stiffness: 260 });
      dragActive.value = withTiming(1, { duration: 150 });
      runOnJS(pickup)();
    })
    .onUpdate((e) => {
      x.value = clamp(startX.value + e.translationX, 0, maxX);
      y.value = clamp(startY.value + e.translationY, 0, maxY);
      const cx = x.value + side / 2;
      const cy = y.value + side / 2;
      const tx = trashBounds.left + trashBounds.size / 2;
      const ty = trashBounds.top + trashBounds.size / 2;
      const now = Math.hypot(cx - tx, cy - ty) < trashBounds.size ? 1 : 0;
      if (now === 1 && hoverTrash.value === 0) runOnJS(overTrash)();
      hoverTrash.value = now;
    })
    .onEnd(() => {
      lifted.value = withSpring(0, { damping: 18, stiffness: 260 });
      dragActive.value = withTiming(0, { duration: 150 });
      if (hoverTrash.value === 1) {
        hoverTrash.value = 0;
        runOnJS(commitRemove)();
      } else {
        runOnJS(commitMove)(x.value, y.value);
      }
    }), [maxX, maxY, side, trashBounds.left, trashBounds.top, trashBounds.size]);

  // Picked-up tiles scale up and straighten out, and their shadow deepens —
  // enough of the tile shows around a fingertip to see what you're placing,
  // without offsetting it away from the finger (which would mean the tile
  // lands somewhere other than where you dropped it).
  const animatedStyle = useAnimatedStyle(() => ({
    left: x.value,
    top: y.value,
    zIndex: 10 + Math.round(lifted.value * 10),
    shadowOpacity: 0.22 + lifted.value * 0.2,
    shadowRadius: 4 + lifted.value * 8,
    transform: [
      { rotate: `${item.rotation * (1 - lifted.value)}deg` },
      { scale: 1 + lifted.value * 0.15 },
    ],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.tile, animatedStyle, { width: side, height: side }]}>
        <HomeWallTile sticker={item.sticker} size={side} url={url} showWord />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.sky },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.ms,
    gap: spacing.md,
  },
  headerText: { flex: 1 },
  title: { fontSize: 20, fontFamily: fonts.cozy, color: colors.inkDark },
  subtitle: { fontSize: 11, fontWeight: '600', color: colors.inkLight, marginTop: 3 },
  subtitleFull: { color: colors.terra },
  doneBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.terra,
    ...shadows.button,
  },
  doneText: { fontSize: 14, fontFamily: fonts.cozy, color: colors.white },

  canvasWrap: { alignItems: 'center' },
  // The same white mount the home panel wears, so this reads as that panel
  // pulled forward rather than as a different surface.
  canvas: {
    borderRadius: radii.xl,
    borderWidth: 5,
    borderColor: colors.white,
    overflow: 'hidden',
    ...shadows.card,
  },
  canvasEmpty: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  canvasEmptyText: { fontSize: 13, fontWeight: '600', color: colors.inkDark, textAlign: 'center', opacity: 0.85 },
  tile: {
    position: 'absolute',
    shadowColor: colors.inkDark,
    shadowOffset: { width: 0, height: 2 },
    // Android ignores PNG alpha when shaping a shadow, so elevation is off
    // here the same way it is on the board canvas's cutout tiles.
    elevation: 0,
  },
  trashZone: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
    shadowColor: colors.inkDark,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },

  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    ...shadows.card,
  },
  toolBtnDisabled: { opacity: 0.45 },
  toolIconBtn: {
    width: 34, height: 34,
    borderRadius: radii.full,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card,
    ...shadows.card,
  },
  toolText: { fontSize: 12, fontWeight: '700', color: colors.inkDark },

  trayLabel: {
    fontSize: 12, fontWeight: '700', color: colors.inkLight,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm,
    letterSpacing: 0.3,
  },
  trayEmpty: { color: colors.inkFaint, fontSize: 13, paddingHorizontal: spacing.lg },
  tray: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.md },
  trayItem: { width: TRAY_TILE, alignItems: 'center' },
  trayItemPlaced: { opacity: 1 },
  trayItemBlocked: { opacity: 0.35 },
  trayImage: {
    width: TRAY_TILE, height: TRAY_TILE,
    borderRadius: radii.md,
    backgroundColor: colors.sand,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  trayCheck: {
    position: 'absolute',
    top: -3, right: -3,
    width: 19, height: 19,
    borderRadius: radii.full,
    backgroundColor: colors.success,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.sky,
  },
  trayWord: {
    fontSize: 9, fontFamily: fonts.jp, color: colors.inkMid,
    marginTop: 4, textAlign: 'center', width: '100%',
  },
});
