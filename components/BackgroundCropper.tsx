import { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { X, Check, RotateCw } from 'lucide-react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { colors, radii, spacing, fonts, shadows } from '@/constants/theme';

interface PickedAsset {
  uri: string;
  width: number;
  height: number;
}

interface BackgroundCropperProps {
  asset: PickedAsset | null;
  frameWidth: number;
  frameHeight: number;
  maxOutputSide: number;
  onCancel: () => void;
  onConfirm: (localUri: string) => void;
}

const MAX_ZOOM = 4;

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

// Frame is always fully covered by the image — translateX/Y describe the
// image's top-left corner relative to the frame, so the valid range is
// [frameSize - displayedSize, 0] on each axis (both ends collapse to the
// same value once the image exactly fits an axis).
function clampTranslate(value: number, displayedSize: number, frameSize: number) {
  'worklet';
  return clamp(value, Math.min(frameSize - displayedSize, 0), 0);
}

// Full-screen pinch/pan/rotate editor shown after picking a photo, before it
// gets uploaded as a cover photo — lets the user see exactly what will be
// visible in the (small, wide) home panel rather than uploading blind and
// hoping the auto-crop picked a sensible region.
export default function BackgroundCropper({
  asset, frameWidth, frameHeight, maxOutputSide, onCancel, onConfirm,
}: BackgroundCropperProps) {
  const [working, setWorking] = useState<PickedAsset | null>(asset);
  const [rotating, setRotating] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const baseScale = useSharedValue(1);
  const workingWidth = useSharedValue(0);
  const workingHeight = useSharedValue(0);

  // A fresh photo (or a freshly-rotated one) resets zoom/pan back to a
  // centered "cover" fit — rotating deliberately doesn't try to preserve the
  // previous crop, since the frame's relationship to the image content just
  // changed entirely.
  useEffect(() => {
    if (!working) return;
    const bs = Math.max(frameWidth / working.width, frameHeight / working.height);
    baseScale.value = bs;
    workingWidth.value = working.width;
    workingHeight.value = working.height;
    scale.value = 1;
    translateX.value = (frameWidth - working.width * bs) / 2;
    translateY.value = (frameHeight - working.height * bs) / 2;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [working?.uri]);

  useEffect(() => { setWorking(asset); }, [asset]);

  const pan = Gesture.Pan()
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      const effScale = baseScale.value * scale.value;
      const dispW = workingWidth.value * effScale;
      const dispH = workingHeight.value * effScale;
      translateX.value = clampTranslate(savedTranslateX.value + e.translationX, dispW, frameWidth);
      translateY.value = clampTranslate(savedTranslateY.value + e.translationY, dispH, frameHeight);
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = clamp(savedScale.value * e.scale, 1, MAX_ZOOM);
      const effScale = baseScale.value * scale.value;
      const dispW = workingWidth.value * effScale;
      const dispH = workingHeight.value * effScale;
      translateX.value = clampTranslate(translateX.value, dispW, frameWidth);
      translateY.value = clampTranslate(translateY.value, dispH, frameHeight);
    });

  const composed = Gesture.Simultaneous(pan, pinch);

  const imageStyle = useAnimatedStyle(() => {
    const effScale = baseScale.value * scale.value;
    return {
      left: translateX.value,
      top: translateY.value,
      width: workingWidth.value * effScale,
      height: workingHeight.value * effScale,
    };
  });

  const handleRotate = async () => {
    if (!working || rotating) return;
    setRotating(true);
    try {
      const rendered = await ImageManipulator.manipulate(working.uri).rotate(90).renderAsync();
      const saved = await rendered.saveAsync({ compress: 0.9, format: SaveFormat.JPEG });
      setWorking({ uri: saved.uri, width: rendered.width, height: rendered.height });
    } catch (err: any) {
      Alert.alert("Couldn't rotate photo", err?.message ?? 'Something went wrong.');
    } finally {
      setRotating(false);
    }
  };

  const handleConfirm = async () => {
    if (!working || confirming) return;
    setConfirming(true);
    try {
      const effScale = baseScale.value * scale.value;
      const originX = clamp(-translateX.value / effScale, 0, working.width);
      const originY = clamp(-translateY.value / effScale, 0, working.height);
      const cropW = Math.min(frameWidth / effScale, working.width - originX);
      const cropH = Math.min(frameHeight / effScale, working.height - originY);

      let context = ImageManipulator.manipulate(working.uri).crop({
        originX: Math.round(originX),
        originY: Math.round(originY),
        width: Math.round(cropW),
        height: Math.round(cropH),
      });
      if (cropW > maxOutputSide) context = context.resize({ width: maxOutputSide });

      const rendered = await context.renderAsync();
      const saved = await rendered.saveAsync({ compress: 0.75, format: SaveFormat.JPEG });
      onConfirm(saved.uri);
    } catch (err: any) {
      Alert.alert("Couldn't crop photo", err?.message ?? 'Something went wrong.');
    } finally {
      setConfirming(false);
    }
  };

  const busy = rotating || confirming;

  return (
    <Modal visible={!!asset} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={onCancel} disabled={busy} hitSlop={8}>
            <X size={20} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Adjust cover photo</Text>
          <TouchableOpacity style={styles.headerBtn} onPress={handleConfirm} disabled={busy} hitSlop={8}>
            {confirming ? <ActivityIndicator size="small" color={colors.white} /> : <Check size={20} color={colors.white} />}
          </TouchableOpacity>
        </View>

        <View style={styles.frameWrap}>
          <View style={[styles.frame, { width: frameWidth, height: frameHeight }]}>
            {working && (
              <GestureDetector gesture={composed}>
                <Animated.View style={StyleSheet.absoluteFill}>
                  <Animated.Image source={{ uri: working.uri }} style={imageStyle} resizeMode="cover" />
                </Animated.View>
              </GestureDetector>
            )}
            {/* Rule-of-thirds guide — purely a composition aid, not interactive. */}
            <View pointerEvents="none" style={styles.gridOverlay}>
              <View style={[styles.gridLineV, { left: frameWidth / 3 }]} />
              <View style={[styles.gridLineV, { left: (frameWidth / 3) * 2 }]} />
              <View style={[styles.gridLineH, { top: frameHeight / 3 }]} />
              <View style={[styles.gridLineH, { top: (frameHeight / 3) * 2 }]} />
            </View>
            {rotating && (
              <View style={styles.rotatingOverlay}>
                <ActivityIndicator color={colors.white} />
              </View>
            )}
          </View>
          <Text style={styles.hint}>Pinch to zoom · drag to reposition</Text>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.rotateBtn} onPress={handleRotate} disabled={busy} hitSlop={8}>
            <RotateCw size={18} color={colors.inkDark} />
            <Text style={styles.rotateBtnText}>Rotate</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(20,24,32,0.94)', justifyContent: 'space-between' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 15, fontFamily: fonts.cozy, color: colors.white },
  frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: colors.inkDark,
    ...shadows.card,
  },
  gridOverlay: { ...StyleSheet.absoluteFillObject },
  gridLineV: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth * 2, backgroundColor: 'rgba(255,255,255,0.55)' },
  gridLineH: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth * 2, backgroundColor: 'rgba(255,255,255,0.55)' },
  rotatingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,24,32,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { marginTop: spacing.md, fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  footer: { alignItems: 'center', paddingBottom: spacing.xxl, paddingTop: spacing.md },
  rotateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    ...shadows.card,
  },
  rotateBtnText: { fontSize: 13, fontWeight: '700', color: colors.inkDark },
});
