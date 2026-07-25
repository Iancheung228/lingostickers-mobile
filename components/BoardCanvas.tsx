import { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS, withTiming, SharedValue } from 'react-native-reanimated';
import { Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { BoardStickerWithSticker, Sticker, WallDisplayStyle, CutoutBorderStyle, WallBackgroundDim } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { getTileSize } from '@/lib/boardLayout';
import WallBackground from '@/components/WallBackground';
import CutoutSticker from '@/components/CutoutSticker';
import { colors, fonts } from '@/constants/theme';

const LONG_PRESS_MS = 400;
const TRASH_SIZE = 60;
const TRASH_MARGIN = 14;

interface TrashBounds {
  left: number;
  top: number;
  size: number;
}

interface BoardCanvasProps {
  items: BoardStickerWithSticker[];
  displayStyle: WallDisplayStyle;
  borderStyle: CutoutBorderStyle;
  canvasSize: { width: number; height: number };
  onSelectSticker: (sticker: Sticker) => void;
  onMove: (stickerId: string, x: number, y: number) => void;
  onRemove: (item: BoardStickerWithSticker) => void;
  backgroundPath?: string | null;
  backgroundDim?: WallBackgroundDim;
}

export default function BoardCanvas({
  items, displayStyle, borderStyle, canvasSize, onSelectSticker, onMove, onRemove,
  backgroundPath, backgroundDim,
}: BoardCanvasProps) {
  // Shared across every tile so whichever one is currently being held can
  // reveal the trash zone and report hovering over it — a single drag at a
  // time is the only case that matters here.
  const dragActive = useSharedValue(0);
  const hoverTrash = useSharedValue(0);

  const trashBounds: TrashBounds = {
    left: canvasSize.width / 2 - TRASH_SIZE / 2,
    top: canvasSize.height - TRASH_SIZE - TRASH_MARGIN,
    size: TRASH_SIZE,
  };

  const trashStyle = useAnimatedStyle(() => ({
    opacity: dragActive.value,
    transform: [{ scale: 0.8 + dragActive.value * 0.2 + hoverTrash.value * 0.15 }],
    backgroundColor: hoverTrash.value ? colors.error : colors.inkDark,
  }));

  return (
    <View style={[styles.canvas, { width: canvasSize.width, height: canvasSize.height }]}>
      <WallBackground path={backgroundPath} dim={backgroundDim} />
      {canvasSize.width > 0 && items.map(item => (
        <CanvasTile
          key={item.sticker_id}
          item={item}
          canvasSize={canvasSize}
          displayStyle={displayStyle}
          borderStyle={borderStyle}
          onSelect={onSelectSticker}
          onMove={onMove}
          onRemove={onRemove}
          dragActive={dragActive}
          hoverTrash={hoverTrash}
          trashBounds={trashBounds}
        />
      ))}
      {canvasSize.width > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.trashZone,
            trashStyle,
            { left: trashBounds.left, top: trashBounds.top, width: trashBounds.size, height: trashBounds.size, borderRadius: trashBounds.size / 2 },
          ]}
        >
          <Trash2 size={24} color={colors.card} />
        </Animated.View>
      )}
    </View>
  );
}

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

function CanvasTile({
  item, canvasSize, displayStyle, borderStyle, onSelect, onMove, onRemove, dragActive, hoverTrash, trashBounds,
}: {
  item: BoardStickerWithSticker;
  canvasSize: { width: number; height: number };
  displayStyle: WallDisplayStyle;
  borderStyle: CutoutBorderStyle;
  onSelect: (sticker: Sticker) => void;
  onMove: (stickerId: string, x: number, y: number) => void;
  onRemove: (item: BoardStickerWithSticker) => void;
  dragActive: SharedValue<number>;
  hoverTrash: SharedValue<number>;
  trashBounds: TrashBounds;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const { width: tileWidth, height: tileHeight } = useMemo(() => getTileSize(item.sticker_id), [item.sticker_id]);
  const translateX = useSharedValue(item.x);
  const translateY = useSharedValue(item.y);
  const startX = useSharedValue(item.x);
  const startY = useSharedValue(item.y);

  useEffect(() => {
    supabase.storage.from('sticker-images')
      .createSignedUrl(item.sticker.image_path, 3600)
      .then(({ data }) => { if (data) setImageUrl(data.signedUrl); });
  }, [item.sticker.image_path]);

  // Re-sync the shared position if this item's stored coordinates change
  // from outside a gesture (e.g. a fresh fetch after re-opening the board).
  useEffect(() => {
    translateX.value = item.x;
    translateY.value = item.y;
  }, [item.x, item.y]);

  const maxX = Math.max(0, canvasSize.width - tileWidth);
  const maxY = Math.max(0, canvasSize.height - tileHeight);

  const handleTap = () => onSelect(item.sticker);
  const handleMove = (x: number, y: number) => onMove(item.sticker_id, x, y);
  const handleRemove = () => onRemove(item);
  const handlePickup = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  const handleHoverTrash = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

  // Pan only takes over after a hold, so a quick tap still opens the
  // sticker detail via the sibling Tap gesture below (see Gesture.Race).
  const pan = useMemo(() => Gesture.Pan()
    .activateAfterLongPress(LONG_PRESS_MS)
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
      dragActive.value = withTiming(1, { duration: 150 });
      runOnJS(handlePickup)();
    })
    .onUpdate((e) => {
      translateX.value = clamp(startX.value + e.translationX, 0, maxX);
      translateY.value = clamp(startY.value + e.translationY, 0, maxY);
      const tileCenterX = translateX.value + tileWidth / 2;
      const tileCenterY = translateY.value + tileHeight / 2;
      const trashCenterX = trashBounds.left + trashBounds.size / 2;
      const trashCenterY = trashBounds.top + trashBounds.size / 2;
      const distance = Math.hypot(tileCenterX - trashCenterX, tileCenterY - trashCenterY);
      const nowOverTrash = distance < trashBounds.size ? 1 : 0;
      if (nowOverTrash === 1 && hoverTrash.value === 0) {
        runOnJS(handleHoverTrash)();
      }
      hoverTrash.value = nowOverTrash;
    })
    .onEnd(() => {
      dragActive.value = withTiming(0, { duration: 150 });
      if (hoverTrash.value === 1) {
        hoverTrash.value = 0;
        runOnJS(handleRemove)();
      } else {
        runOnJS(handleMove)(translateX.value, translateY.value);
      }
    }), [maxX, maxY, trashBounds.left, trashBounds.top, trashBounds.size]);

  const tap = useMemo(() => Gesture.Tap()
    .maxDuration(LONG_PRESS_MS)
    .onEnd(() => {
      runOnJS(handleTap)();
    }), [item]);

  const composed = useMemo(() => Gesture.Race(pan, tap), [pan, tap]);

  const animatedStyle = useAnimatedStyle(() => ({
    left: translateX.value,
    top: translateY.value,
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={[
          styles.tile,
          displayStyle === 'cutout' && styles.tileCutout,
          displayStyle === 'cutout' && (borderStyle === 'shadow' ? styles.tileCutoutShadow : styles.tileCutoutFlat),
          animatedStyle,
          { width: tileWidth, height: tileHeight, transform: [{ rotate: `${item.rotation}deg` }] },
        ]}
      >
        <View style={styles.imageWrap}>
          {imageUrl ? (
            displayStyle === 'cutout' && borderStyle === 'outline' ? (
              <CutoutSticker uri={imageUrl} borderStyle="outline" />
            ) : (
              <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
            )
          ) : (
            <ActivityIndicator color={colors.terra} />
          )}
        </View>
        <Text style={[styles.word, { fontSize: clamp(tileWidth * 0.125, 9, 13) }]} numberOfLines={1}>
          {item.sticker.word}
        </Text>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  canvas: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: colors.skyNight,
  },
  trashZone: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.inkDark,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  tile: {
    position: 'absolute',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 6,
    shadowColor: colors.inkDark,
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  tileCutout: {
    backgroundColor: 'transparent',
    padding: 0,
  },
  tileCutoutShadow: { shadowOpacity: 0.22, elevation: 0 },
  tileCutoutFlat: { shadowOpacity: 0, elevation: 0 },
  imageWrap: { flex: 1, marginBottom: 4 },
  image: { width: '100%', height: '100%' },
  word: { fontSize: 11, fontFamily: fonts.jp, color: colors.inkDark, textAlign: 'center' },
});
