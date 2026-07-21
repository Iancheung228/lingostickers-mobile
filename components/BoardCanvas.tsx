import { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import { BoardStickerWithSticker, Sticker, WallDisplayStyle, CutoutBorderStyle } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import CorkBackground from '@/components/CorkBackground';
import CutoutSticker from '@/components/CutoutSticker';
import { colors, fonts } from '@/constants/theme';

const TILE_WIDTH = 88;
const TILE_HEIGHT = 100;
const TAP_THRESHOLD = 6;

interface BoardCanvasProps {
  items: BoardStickerWithSticker[];
  displayStyle: WallDisplayStyle;
  borderStyle: CutoutBorderStyle;
  canvasSize: { width: number; height: number };
  onSelectSticker: (sticker: Sticker) => void;
  onMove: (stickerId: string, x: number, y: number) => void;
  onLongPressRemove: (item: BoardStickerWithSticker) => void;
}

export default function BoardCanvas({
  items, displayStyle, borderStyle, canvasSize, onSelectSticker, onMove, onLongPressRemove,
}: BoardCanvasProps) {
  return (
    <View style={[styles.canvas, { width: canvasSize.width, height: canvasSize.height }]}>
      <CorkBackground />
      {canvasSize.width > 0 && items.map(item => (
        <CanvasTile
          key={item.sticker_id}
          item={item}
          canvasSize={canvasSize}
          displayStyle={displayStyle}
          borderStyle={borderStyle}
          onSelect={onSelectSticker}
          onMove={onMove}
          onLongPressRemove={onLongPressRemove}
        />
      ))}
    </View>
  );
}

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

function CanvasTile({
  item, canvasSize, displayStyle, borderStyle, onSelect, onMove, onLongPressRemove,
}: {
  item: BoardStickerWithSticker;
  canvasSize: { width: number; height: number };
  displayStyle: WallDisplayStyle;
  borderStyle: CutoutBorderStyle;
  onSelect: (sticker: Sticker) => void;
  onMove: (stickerId: string, x: number, y: number) => void;
  onLongPressRemove: (item: BoardStickerWithSticker) => void;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
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

  const maxX = Math.max(0, canvasSize.width - TILE_WIDTH);
  const maxY = Math.max(0, canvasSize.height - TILE_HEIGHT);

  const handleTap = () => onSelect(item.sticker);
  const handleMove = (x: number, y: number) => onMove(item.sticker_id, x, y);
  const handleRemove = () => onLongPressRemove(item);

  const pan = useMemo(() => Gesture.Pan()
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = clamp(startX.value + e.translationX, 0, maxX);
      translateY.value = clamp(startY.value + e.translationY, 0, maxY);
    })
    .onEnd((e) => {
      const moved = Math.abs(e.translationX) > TAP_THRESHOLD || Math.abs(e.translationY) > TAP_THRESHOLD;
      if (moved) {
        runOnJS(handleMove)(translateX.value, translateY.value);
      } else {
        runOnJS(handleTap)();
      }
    }), [maxX, maxY]);

  const longPress = useMemo(() => Gesture.LongPress()
    .minDuration(450)
    .onStart(() => {
      runOnJS(handleRemove)();
    }), [item]);

  const composed = useMemo(() => Gesture.Race(longPress, pan), [longPress, pan]);

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
          { width: TILE_WIDTH, height: TILE_HEIGHT, transform: [{ rotate: `${item.rotation}deg` }] },
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
        <Text style={styles.word} numberOfLines={1}>{item.sticker.word}</Text>
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
