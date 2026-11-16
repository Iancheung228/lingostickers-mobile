import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMotion } from '@/lib/motion';
import {
  Modal, View, Text, Image, TouchableOpacity, StyleSheet, SafeAreaView,
  LayoutChangeEvent,
} from 'react-native';
import { X, Scissors } from 'lucide-react-native';
import { useSharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import ToolModeSwitch, { ToolMode } from './ToolModeSwitch';
import ScanProgress, { ScanOverlay, ScanStage } from './ScanProgress';
import ScanErrorCard from './ScanErrorCard';
import Button from '@/components/ui/Button';
import BatchProgress from '@/components/BatchProgress';
import type { BatchProgress as BatchProgressData } from '@/lib/batchQueue';
import { useCoachMark } from '@/lib/coachMarks';
import type { ScanAction, ScanErrorKind } from '@/lib/scanError';
import CropBoxOverlay from './CropBoxOverlay';
import LassoOverlay from './LassoOverlay';
import { Rect, Point, computeContainRect, boxToImageCrop, boundingBoxOfPoints, polygonFillRatio, padBox } from '@/lib/cropGeometry';
import { debugLog } from '@/lib/debug';
import { BATCH_MAX } from '@/lib/batchScan';
import { useTheme, useThemedStyles, type Theme } from '@/hooks/useTheme';

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
  /** Stops the in-flight scan; the X does this instead of closing while one runs. */
  onCancelProcessing?: () => void;
  /// Which stage the scan is on, once one is running.
  stage?: ScanStage | null;
  usingServerCutout?: boolean;
  /// A failed scan, shown over the photo with its recoveries. The photo and the
  /// selection stay put underneath.
  error?: ScanErrorKind | null;
  onErrorAction?: (action: ScanAction) => void;
  /** Batch create: "Photo 2 of 3" replaces the title, and the button says what happens next. */
  batch?: { label: string; actionLabel: string; progress: BatchProgressData };
  /**
   * Lasso mode: how many loops may be drawn on this photo (one sticker each).
   * Default 1: drawing again replaces the loop, as it always has.
   */
  maxLoops?: number;
  /** Called instead of onExtract when 2+ loops were drawn. */
  onExtractMany?: (results: ExtractResult[]) => Promise<void> | void;
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

/**
 * Builds the ExtractResult this screen would produce for an untouched,
 * full-frame box — the selection a user expresses by opening the extractor
 * and tapping Extract without moving anything.
 *
 * The live-capture path uses this to skip the box/lasso step altogether:
 * aiming the camera at something already *is* the selection, so asking the
 * user to confirm a box around the whole frame afterwards only adds a step.
 * The segmenter reads a full-frame selection as "no preference expressed"
 * and picks the dominant object rather than unioning everything it finds —
 * see UNSPECIFIC_SELECTION_RATIO in SubjectSegmenter.
 *
 * Deliberately lives here, beside handleExtract, so the two paths share one
 * definition of the upload and segmentation render sizes instead of drifting
 * apart the first time either is tuned.
 */
export async function renderWholePhotoExtract(
  uri: string,
  width: number,
  height: number,
): Promise<ExtractResult> {
  const corners = (w: number, h: number): Point[] => [
    { x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h },
  ];

  const uploadContext = ImageManipulator.manipulate(uri);
  const uploadRendered = await (width > MAX_UPLOAD_WIDTH
    ? uploadContext.resize({ width: MAX_UPLOAD_WIDTH }).renderAsync()
    : uploadContext.renderAsync());
  const upload = await uploadRendered.saveAsync({
    compress: 0.9, format: SaveFormat.JPEG, base64: true,
  });
  if (!upload.base64) throw new Error('Failed to process image');

  // No context padding to add here — the selection is already the whole
  // frame, so there is nothing outside it to pad with.
  const segmentNeedsResize = width > SEGMENT_MAX_WIDTH;
  const segmentContext = ImageManipulator.manipulate(uri);
  const segmentRendered = await (segmentNeedsResize
    ? segmentContext.resize({ width: SEGMENT_MAX_WIDTH }).renderAsync()
    : segmentContext.renderAsync());
  const segment = await segmentRendered.saveAsync({ compress: 0.95, format: SaveFormat.JPEG });

  const segmentScale = segmentNeedsResize ? SEGMENT_MAX_WIDTH / width : 1;
  const segmentWidth = Math.round(width * segmentScale);
  const segmentHeight = Math.round(height * segmentScale);

  return {
    base64: upload.base64,
    uri: upload.uri,
    segmentUri: segment.uri,
    segmentWidth,
    segmentHeight,
    selectionPolygon: corners(segmentWidth, segmentHeight),
    selectionKind: 'box',
    fullUri: uri,
    fullWidth: width,
    fullHeight: height,
    fullSelectionPolygon: corners(width, height),
  };
}

export default function PhotoExtractor({ imageUri, imageWidth, imageHeight, onClose, onExtract, processing, onCancelProcessing, stage, usingServerCutout, error, onErrorAction, batch, maxLoops = 1, onExtractMany }: PhotoExtractorProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { reduced } = useMotion();
  const teach = useCoachMark('pick-object', !!imageUri);
  const [mode, setMode] = useState<ToolMode>('box');
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [cropping, setCropping] = useState(false);
  // Loops drawn so far, in display coordinates. One loop is today's lasso.
  const [loops, setLoops] = useState<Point[][]>([]);
  const lassoReady = loops.length > 0;
  const loopCap = onExtractMany ? Math.max(1, maxLoops) : 1;
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
    setLoops([]);
  }, [imageUri, displayRect]);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setContainerSize({ width, height });
  }, []);

  const handleModeChange = useCallback((next: ToolMode) => {
    setMode(next);
    setLoops([]);
  }, []);

  // A completed loop's crop region: its bounding box padded by an amount that
  // adapts to how loosely the loop fills its own bbox (tighter loops get more
  // slack so the object is never clipped, looser/irregular loops get less since
  // their bbox is already generous).
  const boxForLoop = useCallback((points: Point[]): Rect => {
    const raw = boundingBoxOfPoints(points);
    const fillRatio = polygonFillRatio(points, raw);
    const scale = Math.min(
      LASSO_PADDING_SCALE_RANGE[1],
      Math.max(LASSO_PADDING_SCALE_RANGE[0], fillRatio / LASSO_REFERENCE_FILL_RATIO),
    );
    return padBox(raw, LASSO_BASE_PADDING_RATIO * scale, displayRect);
  }, [displayRect]);

  // Each loop is kept and numbered; with a cap of one the new loop replaces the
  // old (the original single-lasso behaviour).
  const handleLassoComplete = useCallback((points: Point[]) => {
    if (displayRect.width <= 0 || displayRect.height <= 0) return;
    setLoops((prev) => (loopCap === 1 ? [points] : prev.length >= loopCap ? prev : [...prev, points]));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [displayRect, loopCap]);

  const handleRemoveLoop = useCallback((index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoops((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Renders one selection (a box, or a lasso loop with its padded box) into
  // the two crops and the polygons the scan pipeline wants.
  const renderSelection = useCallback(async (selectionBox: Rect, lassoLoop: Point[] | null): Promise<ExtractResult> => {
    if (!imageUri) throw new Error('No photo');
    {
      const prepStarted = Date.now();
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
      const usingLasso = !!lassoLoop && lassoLoop.length >= 3;
      const uploadScale = needsResize ? MAX_UPLOAD_WIDTH / crop.width : 1;
      const lassoPolygon = usingLasso
        ? lassoLoop!.map(p => projectInto(p, crop, uploadScale))
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
        ? lassoLoop!
        : [
            { x: selectionBox.x, y: selectionBox.y },
            { x: selectionBox.x + selectionBox.width, y: selectionBox.y },
            { x: selectionBox.x + selectionBox.width, y: selectionBox.y + selectionBox.height },
            { x: selectionBox.x, y: selectionBox.y + selectionBox.height },
          ];
      const selectionPolygon = selectionSource.map(p =>
        projectInto(p, segmentCrop, segmentScale),
      );

      debugLog(`[scan] crop+render ${Date.now() - prepStarted}ms (upload jpeg + ${segmentWidth}×${segmentHeight} segment jpeg)`);

      // The same selection, expressed against the original photo rather than
      // the crop — the projection is just "no crop offset, no rescale".
      const fullSelectionPolygon = selectionSource.map(p => ({
        x: (p.x - displayRect.x) * imageScale,
        y: (p.y - displayRect.y) * imageScale,
      }));

      return {
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
      };
    }
  }, [imageUri, displayRect, imageWidth, imageHeight]);

  const handleExtract = useCallback(async () => {
    if (!imageUri || cropping || processing) return;
    if (mode === 'lasso' && !lassoReady) return;
    if (displayRect.width <= 0 || displayRect.height <= 0) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCropping(true);
    try {
      if (mode === 'lasso' && loops.length >= 2 && onExtractMany) {
        // One sticker per loop, each with its own padded crop.
        const results: ExtractResult[] = [];
        for (const loop of loops) results.push(await renderSelection(boxForLoop(loop), loop));
        await onExtractMany(results);
      } else if (mode === 'lasso') {
        await onExtract(await renderSelection(boxForLoop(loops[0]), loops[0]));
      } else {
        await onExtract(await renderSelection(box.value, null));
      }
    } finally {
      setCropping(false);
    }
  }, [imageUri, displayRect, onExtract, onExtractMany, cropping, processing, mode, lassoReady, loops, renderSelection, boxForLoop]);

  if (!imageUri) return null;
  const busy = cropping || processing;
  const canExtract = mode === 'box' || lassoReady;
  const loopCount = mode === 'lasso' ? loops.length : 0;
  const atCap = loopCap > 1 && loopCount >= loopCap;
  // "Make sticker" / "Make 2 stickers"; a batch's label keeps its suffix.
  const baseLabel = batch ? batch.actionLabel : 'Make sticker';
  const makeLabel = loopCount >= 2 ? baseLabel.replace('Make sticker', `Make ${loopCount} stickers`) : baseLabel;

  return (
    <Modal visible animationType={reduced ? 'none' : 'slide'} presentationStyle="fullScreen" onRequestClose={busy ? undefined : onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTitleCol}>
            <Text style={styles.headerTitle} accessibilityRole="header" accessibilityLabel={batch ? undefined : 'Crop your sticker'} testID="extractor-title">{batch ? batch.label : 'Pick the object'}</Text>
            {batch && <View style={styles.progressWrap}><BatchProgress progress={batch.progress} phase="cut" /></View>}
          </View>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              // While a scan is running the X stops it and leaves the photo
              // and selection in place; it used to be silently disabled.
              if (processing) onCancelProcessing?.(); else onClose();
            }}
            style={styles.closeButton}
            hitSlop={8}
            // `cropping` stays true until onExtract resolves — i.e. through the
            // whole scan — so it can't gate the X once processing has begun.
            disabled={processing ? !onCancelProcessing : cropping}
            accessibilityRole="button"
            accessibilityLabel={processing ? 'Stop this scan' : 'Close without extracting a sticker'}
          >
            <X size={24} color={colors.inkDark} />
          </TouchableOpacity>
        </View>

        <View style={styles.modeRow}>
          <Text style={styles.modeHint}>
            {mode === 'box'
              ? 'Drag the corners to box in the object'
              : atCap
                ? `${BATCH_MAX} cards max per batch`
                : lassoReady && loopCap > 1
                  ? 'Draw another loop for another sticker, or tap Make sticker.'
                  : lassoReady
                    ? 'Loop locked in. Redraw anytime, or tap Make sticker.'
                    : loopCap > 1
                      ? 'Draw around each object you want as a sticker.'
                      : 'Draw around it, or tap Lasso for tricky shapes.'}
          </Text>
          <ToolModeSwitch mode={mode} onChange={handleModeChange} />
        </View>

        <View style={styles.photoArea} onLayout={handleLayout}>
          <Image
            source={{ uri: imageUri }}
            style={styles.photo}
            resizeMode="contain"
            onLoadStart={() => debugLog('[PhotoExtractor] load start', imageUri)}
            onLoad={(e) => debugLog('[PhotoExtractor] loaded', e.nativeEvent.source)}
            onError={(e) => debugLog('[PhotoExtractor] error', imageUri, JSON.stringify(e.nativeEvent))}
          />
          {displayRect.width > 0 && mode === 'box' && (
            <CropBoxOverlay box={box} startBox={startBox} displayRect={displayRect} />
          )}
          {displayRect.width > 0 && mode === 'lasso' && (
            <LassoOverlay bounds={displayRect} loops={loops} onComplete={handleLassoComplete} onRemove={handleRemoveLoop} full={atCap} />
          )}
          {processing && !error && (
            <ScanOverlay>
              <ScanProgress stage={stage ?? 'cutting'} usingServerCutout={usingServerCutout} onCancel={onCancelProcessing} />
            </ScanOverlay>
          )}
          {!!error && !processing && onErrorAction && (
            <ScanOverlay>
              <ScanErrorCard kind={error} onAction={onErrorAction} />
            </ScanOverlay>
          )}
        </View>

        <View style={styles.actions}>
          {teach.visible && <Text style={styles.teach}>You can change the outline any time before you tap Make sticker.</Text>}
          <Button
            label={makeLabel}
            testID="extract-sticker"
            icon={<Scissors size={20} color={busy || !canExtract ? colors.inkLight : colors.white} strokeWidth={1.75} />}
            disabled={!canExtract || !!error}
            loading={busy}
            onPress={() => { teach.dismiss(); handleExtract(); }}
          />
          {!canExtract && <Text style={styles.teach}>Draw around the object first</Text>}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const makeStyles = ({ colors, type, e1 }: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sky },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  headerTitle: { ...type.h2 },
  headerTitleCol: { flexShrink: 1, alignItems: 'flex-start' },
  progressWrap: { marginTop: 4 },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...e1,
  },
  modeRow: { paddingHorizontal: 20, paddingBottom: 12, gap: 12, alignItems: 'center' },
  modeHint: { ...type.small },
  photoArea: { flex: 1, padding: 16, overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  actions: { paddingHorizontal: 20, paddingBottom: 16, paddingTop: 4, gap: 8 },
  teach: { ...type.small, textAlign: 'center' },
});
