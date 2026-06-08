import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Rect, Corner, clampBox, resizeBoxFromCorner } from '@/lib/cropGeometry';

interface CropBoxOverlayProps {
  box: SharedValue<Rect>;
  startBox: SharedValue<Rect>;
  displayRect: Rect;
}

const HANDLE_SIZE = 28;
const MIN_BOX_SIZE = 60;

export default function CropBoxOverlay({ box, startBox, displayRect }: CropBoxOverlayProps) {
  const movePan = useMemo(() => Gesture.Pan()
    .onStart(() => {
      startBox.value = box.value;
    })
    .onUpdate((e) => {
      box.value = clampBox(
        { ...startBox.value, x: startBox.value.x + e.translationX, y: startBox.value.y + e.translationY },
        displayRect,
      );
    }), [displayRect]);

  const cornerGestures = useMemo(() => {
    const make = (corner: Corner) => Gesture.Pan()
      .onStart(() => {
        startBox.value = box.value;
      })
      .onUpdate((e) => {
        box.value = resizeBoxFromCorner(corner, startBox.value, e.translationX, e.translationY, displayRect, MIN_BOX_SIZE);
      });
    return { tl: make('tl'), tr: make('tr'), bl: make('bl'), br: make('br') };
  }, [displayRect]);

  const boxStyle = useAnimatedStyle(() => ({
    left: box.value.x,
    top: box.value.y,
    width: box.value.width,
    height: box.value.height,
  }));

  const maskTopStyle = useAnimatedStyle(() => ({
    left: displayRect.x,
    top: displayRect.y,
    width: displayRect.width,
    height: Math.max(0, box.value.y - displayRect.y),
  }));
  const maskBottomStyle = useAnimatedStyle(() => ({
    left: displayRect.x,
    top: box.value.y + box.value.height,
    width: displayRect.width,
    height: Math.max(0, displayRect.y + displayRect.height - (box.value.y + box.value.height)),
  }));
  const maskLeftStyle = useAnimatedStyle(() => ({
    left: displayRect.x,
    top: box.value.y,
    width: Math.max(0, box.value.x - displayRect.x),
    height: box.value.height,
  }));
  const maskRightStyle = useAnimatedStyle(() => ({
    left: box.value.x + box.value.width,
    top: box.value.y,
    width: Math.max(0, displayRect.x + displayRect.width - (box.value.x + box.value.width)),
    height: box.value.height,
  }));

  const tlStyle = useAnimatedStyle(() => ({ left: box.value.x - HANDLE_SIZE / 2, top: box.value.y - HANDLE_SIZE / 2 }));
  const trStyle = useAnimatedStyle(() => ({ left: box.value.x + box.value.width - HANDLE_SIZE / 2, top: box.value.y - HANDLE_SIZE / 2 }));
  const blStyle = useAnimatedStyle(() => ({ left: box.value.x - HANDLE_SIZE / 2, top: box.value.y + box.value.height - HANDLE_SIZE / 2 }));
  const brStyle = useAnimatedStyle(() => ({ left: box.value.x + box.value.width - HANDLE_SIZE / 2, top: box.value.y + box.value.height - HANDLE_SIZE / 2 }));

  const handles: { corner: Corner; gesture: ReturnType<typeof Gesture.Pan>; style: ReturnType<typeof useAnimatedStyle> }[] = [
    { corner: 'tl', gesture: cornerGestures.tl, style: tlStyle },
    { corner: 'tr', gesture: cornerGestures.tr, style: trStyle },
    { corner: 'bl', gesture: cornerGestures.bl, style: blStyle },
    { corner: 'br', gesture: cornerGestures.br, style: brStyle },
  ];

  return (
    <Animated.View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View pointerEvents="none" style={[styles.mask, maskTopStyle]} />
      <Animated.View pointerEvents="none" style={[styles.mask, maskBottomStyle]} />
      <Animated.View pointerEvents="none" style={[styles.mask, maskLeftStyle]} />
      <Animated.View pointerEvents="none" style={[styles.mask, maskRightStyle]} />

      <GestureDetector gesture={movePan}>
        <Animated.View style={[styles.box, boxStyle]} />
      </GestureDetector>

      {handles.map(({ corner, gesture, style }) => (
        <GestureDetector key={corner} gesture={gesture}>
          <Animated.View style={[styles.handle, style]} />
        </GestureDetector>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  mask: { position: 'absolute', backgroundColor: 'rgba(26,26,46,0.55)' },
  box: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#A7D7C5',
    borderRadius: 4,
    backgroundColor: 'rgba(167,215,197,0.08)',
  },
  handle: {
    position: 'absolute',
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    borderRadius: HANDLE_SIZE / 2,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#A7D7C5',
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});
