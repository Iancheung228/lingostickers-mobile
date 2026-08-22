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
import ScanProgress, { ScanStage } from './ScanProgress';
import CropBoxOverlay from './CropBoxOverlay';
import LassoOverlay from './LassoOverlay';
import { Rect, Point, computeContainRect, boxToImageCrop, boundingBoxOfPoints, polygonFillRatio, padBox } from '@/lib/cropGeometry';
import { colors, radii, spacing, fonts } from '@/constants/theme';

interface PhotoExtractorProps {
  imageUri: string | null;
  imageWidth: number;
  imageHeight: number;
  onClose: () => void;
  // `uri` is the rendered crop's local file URI — handed back so the caller
  // can show it during the ghost-cutout reveal transition. `lassoPolygon`,
  // when present, is in the *cropped output image's* own pixel coordinates —
  // the server uses it to force-include everything inside the user's loop
  // regardless of what automatic background removal decides.
  //
  // The `segment*` fields describe a separate, more generously padded render
  // used only for on-device segmentation (see SEGMENT_CONTEXT_PAD_RATIO).
  onExtract: (result: ExtractResult) => Promise<void> | void;
  processing: boolean;
  /// Which stage the scan is on, once one is running.
  stage?: ScanStage | null;
  usingServerCutout?: boolean;
}

export interface ExtractResult {
  base64: string;
  uri: string;
  lassoPolygon?: Point[];
  /** Full-resolution, context-padded crop for the on-device segmenter. */
  segmentUri: string;
  segmentWidth: number;
  segmentHeight: number;
  /** The user's selection, in `segmentUri`'s pixel space. */
  selectionPolygon: Point[];
  selectionKind: 'box' | 'lasso';
  /**
   * The whole photo, uncropped, plus the same selection in its coordinate
   * space. A second chance for the segmenter: Vision hunts for objects that
   * stand out from a background, so a tightly cropped subject — which is most
   * of the frame by definition — can leave it with nothing to notice. The
   * full scene is the context it was designed for.
   */
  fullUri: string;
  fullWidth: number;
  fullHeight: number;
  fullSelectionPolygon: Point[];
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

// Extra margin around the selection for the *segmentation* render only.
//
// On-device segmentation needs breathing room that the upload crop does not,
// for two reasons. Vision looks for "noticeable objects", and an object that
// fills its entire frame has no background left to be noticeable against — a
// tight crop makes Vision more likely to return nothing at all. And the gate's
// containment score ("is this instance mostly inside what the user selected?")
// is only meaningful if an instance is *able* to extend outside the selection:
// crop flush to the box and the tabletop gets truncated to exactly the box
// too, scoring a perfect 1.0 for having grabbed the wrong thing.
//
// Costs nothing in the output — the matte is trimmed to its own content, so
// the padding is discarded once it has done its job.
const SEGMENT_CONTEXT_PAD_RATIO = 0.28;
// Width the segmentation source is rendered at.
//
// Five times U-Net's effective 320px, and comfortably more than the shipped
// PNG needs — but not more than that. The refinement passes hold several
// float planes per channel, so resolution here is paid for in peak memory on
// a device that is also holding a camera session; past roughly this point the
// extra pixels stop showing up in the output and start showing up in the
// memory graph.
const SEGMENT_MAX_WIDTH = 1600;

export default function PhotoExtractor({ imageUri, imageWidth, imageHeight, onClose, onExtract, processing, stage, usingServerCutout }: PhotoExtractorProps) {
  const [mode, setMode] = useState<ToolMode>('box');
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [cropping, setCropping] = useState(false);
  const [lassoReady, setLassoReady] = useState(false);
  const [lassoPoints, setLassoPoints] = useState<Point[]>([]);
  const initializedFor = useRef<string | null>(null);

  const box = useSharedValue<Rect>(ZERO_RECT);
  const startBox = useSharedValue<Rect>(ZERO_RECT);

  const displayRect = useMemo(
    () => computeContainRect(containerSize.width, containerSize.height, imageWidth, imageHeight),
    [containerSize.width, containerSize.height, imageWidth, imageHeight],
  );

  // Seed the box to the whole photo once we know its layout. Re-seeds when a
  // new photo is loaded (tracked by URI) — but NOT when the same photo reopens
  // (e.g. "Retry Extraction" in DiscoveryReveal, which reuses this same
  // mounted instance rather than remounting it, since rendering `null` while
  // hidden doesn't unmount), so a retry deliberately picks up right where the
  // box/lasso was left, instead of resetting.
  //
  // Starting at the full frame rather than an arbitrary 70% means the default
  // never silently clips the subject; narrowing is a deliberate act. The
  // segmenter treats a full-frame box as "no preference expressed" and picks
  // the dominant object rather than unioning everything it finds — see
  // UNSPECIFIC_SELECTION_RATIO in SubjectSegmenter.
  useEffect(() => {
    if (!imageUri || displayRect.width <= 0 || displayRect.height <= 0) return;
    if (initializedFor.current === imageUri) return;

    const initial: Rect = {
      x: displayRect.x,
      y: displayRect.y,
      width: displayRect.width,
      height: displayRect.height,
    };
    box.value = initial;
    startBox.value = initial;
    initializedFor.current = imageUri;
    // A genuinely different photo (not a same-photo reopen) — clear any
    // lasso left over from whatever was previously loaded in this same
    // instance. Without this, a stale `lassoReady=true` would let Extract
    // fire immediately using another photo's leftover polygon.
    setMode('box');
    setLassoPoints([]);
    setLassoReady(false);
  }, [imageUri, displayRect]);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setContainerSize({ width, height });
  }, []);

  const handleModeChange = useCallback((next: ToolMode) => {
    setMode(next);
    if (next === 'lasso') setLassoReady(false);
    else setLassoPoints([]);
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
    setLassoPoints(points);
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
      const prepStarted = Date.now();
      const selectionBox = box.value;
      const crop = boxToImageCrop(selectionBox, displayRect, imageWidth, imageHeight);
      const context = ImageManipulator.manipulate(imageUri).crop(crop);
      const needsResize = crop.width > MAX_UPLOAD_WIDTH;
      const rendered = await (needsResize
        ? context.resize({ width: MAX_UPLOAD_WIDTH }).renderAsync()
        : context.renderAsync());
      const result = await rendered.saveAsync({ compress: 0.9, format: SaveFormat.JPEG, base64: true });
      if (!result.base64) throw new Error('Failed to process image');

      // Projects a point from display coordinates into an arbitrary crop's own
      // pixel space. Used twice below, against two different crops.
      const imageScale = imageWidth / displayRect.width;
      const projectInto = (
        p: Point,
        target: { originX: number; originY: number },
        scale: number,
      ): Point => ({
        x: ((p.x - displayRect.x) * imageScale - target.originX) * scale,
        y: ((p.y - displayRect.y) * imageScale - target.originY) * scale,
      });

      // Reproject the lasso loop into the *upload* crop's pixel space, so the
      // server fallback can still use it as a force-include mask exactly as
      // it does today.
      const usingLasso = mode === 'lasso' && lassoReady && lassoPoints.length >= 3;
      const uploadScale = needsResize ? MAX_UPLOAD_WIDTH / crop.width : 1;
      const lassoPolygon = usingLasso
        ? lassoPoints.map(p => projectInto(p, crop, uploadScale))
        : undefined;

      // A second, context-padded render at full resolution — the source the
      // on-device segmenter works from.
      const segmentBox = padBox(selectionBox, SEGMENT_CONTEXT_PAD_RATIO, displayRect);
      const segmentCrop = boxToImageCrop(segmentBox, displayRect, imageWidth, imageHeight);
      const segmentContext = ImageManipulator.manipulate(imageUri).crop(segmentCrop);
      const segmentNeedsResize = segmentCrop.width > SEGMENT_MAX_WIDTH;
      const segmentRendered = await (segmentNeedsResize
        ? segmentContext.resize({ width: SEGMENT_MAX_WIDTH }).renderAsync()
        : segmentContext.renderAsync());
      const segment = await segmentRendered.saveAsync({ compress: 0.95, format: SaveFormat.JPEG });

      const segmentScale = segmentNeedsResize ? SEGMENT_MAX_WIDTH / segmentCrop.width : 1;
      const segmentWidth = Math.round(segmentCrop.width * segmentScale);
      const segmentHeight = Math.round(segmentCrop.height * segmentScale);

      // The selection itself, in the padded render's space. For the lasso
      // that's the traced loop; for the box it's the box's own four corners —
      // which now sit strictly inside the padded frame, so an instance really
      // can score badly for extending beyond them.
      const selectionSource: Point[] = usingLasso
        ? lassoPoints
        : [
            { x: selectionBox.x, y: selectionBox.y },
            { x: selectionBox.x + selectionBox.width, y: selectionBox.y },
            { x: selectionBox.x + selectionBox.width, y: selectionBox.y + selectionBox.height },
            { x: selectionBox.x, y: selectionBox.y + selectionBox.height },
          ];
      const selectionPolygon = selectionSource.map(p =>
        projectInto(p, segmentCrop, segmentScale),
      );

      console.log(`[scan] crop+render ${Date.now() - prepStarted}ms (upload jpeg + ${segmentWidth}×${segmentHeight} segment jpeg)`);

      // The same selection, expressed against the original photo rather than
      // the crop — the projection is just "no crop offset, no rescale".
      const fullSelectionPolygon = selectionSource.map(p => ({
        x: (p.x - displayRect.x) * imageScale,
        y: (p.y - displayRect.y) * imageScale,
      }));

      await onExtract({
        base64: result.base64,
        uri: result.uri,
        lassoPolygon,
        segmentUri: segment.uri,
        segmentWidth,
        segmentHeight,
        selectionPolygon,
        selectionKind: usingLasso ? 'lasso' : 'box',
        fullUri: imageUri,
        fullWidth: imageWidth,
        fullHeight: imageHeight,
        fullSelectionPolygon,
      });
    } finally {
      setCropping(false);
    }
  }, [imageUri, displayRect, imageWidth, imageHeight, onExtract, cropping, processing, mode, lassoReady, lassoPoints]);

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
            <X size={24} color={colors.inkDark} />
          </TouchableOpacity>
        </View>

        <View style={styles.modeRow}>
          <Text style={styles.modeHint}>
            {mode === 'box'
              ? 'Drag the corners to box in the object'
              : lassoReady
                ? 'Loop locked in — redraw anytime, or tap Extract below'
                : 'Circle the object with your finger'}
          </Text>
          <ToolModeSwitch mode={mode} onChange={handleModeChange} />
        </View>

        <View style={styles.photoArea} onLayout={handleLayout}>
          <Image
            source={{ uri: imageUri }}
            style={styles.photo}
            resizeMode="contain"
            onLoadStart={() => console.log('[PhotoExtractor] load start', imageUri)}
            onLoad={(e) => console.log('[PhotoExtractor] loaded', e.nativeEvent.source)}
            onError={(e) => console.log('[PhotoExtractor] error', imageUri, JSON.stringify(e.nativeEvent))}
          />
          {displayRect.width > 0 && mode === 'box' && (
            <CropBoxOverlay box={box} startBox={startBox} displayRect={displayRect} />
          )}
          {displayRect.width > 0 && mode === 'lasso' && (
            <LassoOverlay bounds={displayRect} onComplete={handleLassoComplete} />
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.extractButton, (busy || !canExtract) && styles.extractButtonDisabled]}
            onPress={handleExtract}
            disabled={busy || !canExtract}
          >
            {busy ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Scissors size={20} color={colors.white} />
                <Text style={styles.extractButtonText}>Extract Sticker</Text>
              </>
            )}
          </TouchableOpacity>
          {/* `cropping` covers the brief local crop/resize too, but `processing`
              (the actual network call, up to ~20s) is the one worth telling
              the user about instead of leaving a bare spinner for that long. */}
          {processing && (
            <View style={styles.progressWrap}>
              <ScanProgress stage={stage ?? 'cutting'} usingServerCutout={usingServerCutout} />
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sky },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.inkDark },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeRow: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
    alignItems: 'center',
  },
  modeHint: { color: colors.inkMid, fontSize: 13, fontWeight: '500' },
  photoArea: { flex: 1, padding: 16 },
  photo: { width: '100%', height: '100%' },
  actions: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4 },
  extractButton: {
    backgroundColor: colors.terra,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: colors.terra,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  extractButtonDisabled: { opacity: 0.6 },
  progressWrap: { marginTop: 12 },
  extractButtonText: { color: colors.white, fontSize: 16, fontWeight: '800', letterSpacing: 1 },
});
