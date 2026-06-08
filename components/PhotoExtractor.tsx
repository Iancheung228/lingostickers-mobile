import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal, View, Text, Image, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, LayoutChangeEvent,
} from 'react-native';
import { X, Scissors } from 'lucide-react-native';
import { useSharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import ToolModeSwitch, { ToolMode } from './ToolModeSwitch';
import CropBoxOverlay from './CropBoxOverlay';
import LassoOverlay from './LassoOverlay';
import { Rect, Point, computeContainRect, boxToImageCrop, boundingBoxOfPoints, polygonFillRatio, padBox } from '@/lib/cropGeometry';

interface PhotoExtractorProps {
  imageUri: string | null;
  imageWidth: number;
  imageHeight: number;
  onClose: () => void;
  // `uri` is the rendered crop's local file URI — handed back so the caller
  // can show it during the ghost-cutout reveal transition.
  onExtract: (result: { base64: string; uri: string }) => Promise<void> | void;
  processing: boolean;
}

const ZERO_RECT: Rect = { x: 0, y: 0, width: 0, height: 0 };
const MAX_UPLOAD_WIDTH = 800;
// Margin added around a freehand loop's bounding box, scaled by how "loose"
// the loop is relative to its own bbox (see polygonFillRatio). A rough,
// irregular loop already leaves dead-corner background inside its bbox, so it
// gets less extra margin (down to LASSO_PADDING_SCALE_RANGE[0] * base); a loop
// that hugs its bbox tightly gets more (up to [1] * base) so the object is
// never clipped. This keeps the crop sent to remove.bg from drowning the
// subject in background — which was leaving straight-edged background
// fragments (table corners, walls) in the final cutout.
const LASSO_BASE_PADDING_RATIO = 0.08;
const LASSO_REFERENCE_FILL_RATIO = 0.6;
const LASSO_PADDING_SCALE_RANGE: [number, number] = [0.5, 1.5];

export default function PhotoExtractor({ imageUri, imageWidth, imageHeight, onClose, onExtract, processing }: PhotoExtractorProps) {
  const [mode, setMode] = useState<ToolMode>('box');
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [cropping, setCropping] = useState(false);
  const [lassoReady, setLassoReady] = useState(false);
  const initializedFor = useRef<string | null>(null);

  const box = useSharedValue<Rect>(ZERO_RECT);
  const startBox = useSharedValue<Rect>(ZERO_RECT);

  const displayRect = useMemo(
    () => computeContainRect(containerSize.width, containerSize.height, imageWidth, imageHeight),
    [containerSize.width, containerSize.height, imageWidth, imageHeight],
  );

  // Seed the box centered at ~70% of the displayed image once we know its
  // layout. Re-seeds when a new photo is loaded (tracked by URI).
  useEffect(() => {
    if (!imageUri || displayRect.width <= 0 || displayRect.height <= 0) return;
    if (initializedFor.current === imageUri) return;

    const w = displayRect.width * 0.7;
    const h = displayRect.height * 0.7;
    const initial: Rect = {
      x: displayRect.x + (displayRect.width - w) / 2,
      y: displayRect.y + (displayRect.height - h) / 2,
      width: w,
      height: h,
    };
    box.value = initial;
    startBox.value = initial;
    initializedFor.current = imageUri;
  }, [imageUri, displayRect]);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setContainerSize({ width, height });
  }, []);

  const handleModeChange = useCallback((next: ToolMode) => {
    setMode(next);
    if (next === 'lasso') setLassoReady(false);
  }, []);

  // A completed loop becomes the crop region: pad its bounding box — by an
  // amount that adapts to how loosely the loop fills its own bbox (tighter
  // loops get more slack so the object is never clipped, looser/irregular
  // loops get less since their bbox is already generous) — and store it in
  // `box`, the same shared value the box tool reads from, so extraction stays
  // unified.
  const handleLassoComplete = useCallback((points: Point[]) => {
    if (displayRect.width <= 0 || displayRect.height <= 0) return;
    const raw = boundingBoxOfPoints(points);
    const fillRatio = polygonFillRatio(points, raw);
    const scale = Math.min(
      LASSO_PADDING_SCALE_RANGE[1],
      Math.max(LASSO_PADDING_SCALE_RANGE[0], fillRatio / LASSO_REFERENCE_FILL_RATIO),
    );
    box.value = padBox(raw, LASSO_BASE_PADDING_RATIO * scale, displayRect);
    setLassoReady(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [displayRect]);

  const handleExtract = useCallback(async () => {
    if (!imageUri || cropping || processing) return;
    if (mode === 'lasso' && !lassoReady) return;
    if (displayRect.width <= 0 || displayRect.height <= 0) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCropping(true);
    try {
      const crop = boxToImageCrop(box.value, displayRect, imageWidth, imageHeight);
      const context = ImageManipulator.manipulate(imageUri).crop(crop);
      const rendered = await (crop.width > MAX_UPLOAD_WIDTH
        ? context.resize({ width: MAX_UPLOAD_WIDTH }).renderAsync()
        : context.renderAsync());
      const result = await rendered.saveAsync({ compress: 0.9, format: SaveFormat.JPEG, base64: true });
      if (!result.base64) throw new Error('Failed to process image');
      await onExtract({ base64: result.base64, uri: result.uri });
    } finally {
      setCropping(false);
    }
  }, [imageUri, displayRect, imageWidth, imageHeight, onExtract, cropping, processing, mode, lassoReady]);

  if (!imageUri) return null;
  const busy = cropping || processing;
  const canExtract = mode === 'box' || lassoReady;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Extract Sticker</Text>
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onClose(); }}
            style={styles.closeButton}
            disabled={busy}
          >
            <X size={24} color="#1A1A2E" />
          </TouchableOpacity>
        </View>

        <View style={styles.modeRow}>
          <Text style={styles.modeHint}>
            {mode === 'box'
              ? 'Drag the corners to box in the object'
              : lassoReady
                ? 'Looks good — redraw anytime, or extract below'
                : 'Circle the object with your finger'}
          </Text>
          <ToolModeSwitch mode={mode} onChange={handleModeChange} />
        </View>

        <View style={styles.photoArea} onLayout={handleLayout}>
          <Image source={{ uri: imageUri }} style={styles.photo} resizeMode="contain" />
          {displayRect.width > 0 && mode === 'box' && (
            <CropBoxOverlay box={box} startBox={startBox} displayRect={displayRect} />
          )}
          {displayRect.width > 0 && mode === 'lasso' && (
            <LassoOverlay onComplete={handleLassoComplete} />
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.extractButton, (busy || !canExtract) && styles.extractButtonDisabled]}
            onPress={handleExtract}
            disabled={busy || !canExtract}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Scissors size={20} color="#fff" />
                <Text style={styles.extractButtonText}>Extract Sticker</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F0E8' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A2E' },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeRow: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
    alignItems: 'center',
  },
  modeHint: { color: '#6B7280', fontSize: 13, fontWeight: '500' },
  photoArea: { flex: 1, padding: 16 },
  photo: { width: '100%', height: '100%' },
  actions: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4 },
  extractButton: {
    backgroundColor: '#A7D7C5',
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#A7D7C5',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  extractButtonDisabled: { opacity: 0.6 },
  extractButtonText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 1 },
});
