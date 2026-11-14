import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Linking, AppState, Image, Pressable,
  LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, runOnJS, withTiming, withDelay,
} from 'react-native-reanimated';
import { ImagePlus, Zap, ZapOff, Keyboard as KeyboardIcon } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { colors, e1, e2, radii, spacing, type, fonts } from '@/constants/theme';
import { TAB_BAR_CLEARANCE } from '@/constants/tabBar';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/lib/supabase';
import { StickerDraft } from '@/lib/types';
import { Point } from '@/lib/cropGeometry';
import { captureLocation, CapturedLocation } from '@/lib/location';
import { getImportedPhotoMetadata } from '@/lib/photoMetadata';
import { withThumbPath } from '@/lib/thumbnails';
import { attemptLocalCutout, uploadCutout, cutoutPath, CUTOUT_DRY_RUN, type UploadOutcome } from '@/lib/cutout';
import { trackEvent } from '@/lib/analytics';
import DiscoveryReveal from '@/components/DiscoveryReveal';
import { useToast } from '@/components/ToastProvider';
import { useRequireOnline } from '@/hooks/useRequireOnline';
import TypeWordSheet, { type CarriedCutout } from '@/components/TypeWordSheet';
import ScanErrorCard from '@/components/ScanErrorCard';
import Button from '@/components/ui/Button';
import { haptic } from '@/lib/haptics';
import { useMotion } from '@/lib/motion';
import { useCoachMark } from '@/lib/coachMarks';
import { friendlyError, isNetworkError } from '@/lib/friendlyError';
import { ScanFailure, classifyScanFailure, keepsCutout, type ScanAction, type ScanErrorKind } from '@/lib/scanError';
import PhotoExtractor, { ExtractResult, renderWholePhotoExtract } from '@/components/PhotoExtractor';
import ScanProgress, { ScanOverlay, ScanStage } from '@/components/ScanProgress';
import GhostCutoutReveal from '@/components/GhostCutoutReveal';
import { debugLog, debugWarn } from '@/lib/debug';
import { alertPermissionDenied } from '@/lib/permissions';
import { useAiConsent } from '@/lib/aiConsent';
import { AiConsentGate } from '@/components/AiConsentGate';
import { SceneChip, addSceneCards, newSceneId } from '@/lib/sceneCards';

// The photo a scan is working from, and — for live captures only — the moment
// and raw sensor frame the shutter caught. Named so the direct-capture path can
// hand both to handleExtractFromPhoto explicitly; see the note there.
type CaptureAsset = { uri: string; width: number; height: number; assetId?: string };
type CameraCapture = { discoveredAt: string; rawUri: string; rawWidth: number; rawHeight: number };

export default function ScanScreen() {
  const { user } = useAuth();
  const { accepted: aiConsented, accept: acceptAiConsent } = useAiConsent(user?.id);
  const { profile } = useProfile();
  const language = profile?.target_language ?? 'fr';
  const [permission, requestPermission, getPermission] = useCameraPermissions();

  // Sending someone to Settings only helps if we notice when they come back.
  // Nothing else here re-reads the permission: `useFocusEffect` won't fire
  // (the scan tab never lost focus — the Settings app was on top of it), and
  // the hook only checks on mount. Without this the screen keeps showing
  // "Open Settings" after the switch has already been flipped, which reads
  // as the button having failed.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') getPermission();
    });
    return () => sub.remove();
  }, [getPermission]);
  const [processing, setProcessing] = useState(false);
  // Which stage of the scan is running, and whether step one had to fall back
  // to the server — both purely so the wait can explain itself.
  const [stage, setStage] = useState<ScanStage>('cutting');
  const [usingServerCutout, setUsingServerCutout] = useState(false);
  // Guards the shutter against double-taps during the brief local
  // take+crop+render step, kept separate from `processing` (which tracks the
  // segmentation and network work that follows it).
  const [capturing, setCapturing] = useState(false);
  const toast = useToast();
  const { online, gate } = useRequireOnline();
  const { reduced } = useMotion();
  // A failed scan, as one of B-core 2's six rows. Null while all is well.
  const [scanError, setScanError] = useState<ScanErrorKind | null>(null);
  // The photo just taken, held on screen over the live camera while it is
  // scanned (the camera path never opens the extractor).
  const [frozenUri, setFrozenUri] = useState<string | null>(null);
  // A cutout the scan made and uploaded before the word lookup failed. Kept so
  // "Type the word instead" can finish the card with it; removed otherwise.
  const carriedRef = useRef<CarriedCutout | null>(null);
  const [typeCutout, setTypeCutout] = useState<CarriedCutout | null>(null);
  // What the last scan was run with, so Try again re-runs exactly that.
  const lastExtractRef = useRef<{ extract: ExtractResult; source?: { asset: CaptureAsset; camera: CameraCapture } } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // A discarded draft is held in memory for the Undo toast; its files are only
  // deleted once that window closes.
  const pendingDiscardRef = useRef<{
    draft: StickerDraft; sceneBase64: string | null; chips: SceneChip[];
    asset: CaptureAsset | null; camera: CameraCapture | null; timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const [draft, setDraft] = useState<StickerDraft | null>(null);
  // The small scene copy sent with the scan, kept for scene prompts on the
  // reveal, and the extra words picked there. Both belong to the draft.
  const [sceneBase64, setSceneBase64] = useState<string | null>(null);
  const [sceneChips, setSceneChips] = useState<SceneChip[]>([]);
  const [saving, setSaving] = useState(false);
  const [retranslating, setRetranslating] = useState(false);
  const [retranslatingSentence, setRetranslatingSentence] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [torchOn, setTorchOn] = useState(false);
  // 'off' = continuous autofocus (expo-camera's default, despite the name).
  // Tapping the viewfinder briefly flips this to 'on' — "focus once and
  // lock" — to force a fresh focus pulse, then reverts automatically.
  // expo-camera has no coordinate-targeted focus API, so this is the
  // closest approximation of tap-to-focus it supports.
  const [autofocusMode, setAutofocusMode] = useState<'on' | 'off'>('off');
  const focusPulseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The photo the current scan is working from — set by either a live
  // capture or a gallery import, and kept alive past a *successful* scan
  // (not cleared until the resulting draft is finally Added or Discarded)
  // so "Retry Extraction" can reopen the box/lasso on the same source photo.
  const [importedAsset, setImportedAsset] = useState<CaptureAsset | null>(null);
  // Set only when importedAsset came from the live shutter (not the
  // gallery) — carries the "now"/GPS captured at the moment of the shutter
  // press, plus the true full, uncropped sensor frame for the memory photo
  // (separate from the 3:4-cropped image the scan itself works from), so
  // retrying the extraction afterward never pushes the discovery's timestamp
  // later than when it actually happened.
  const [cameraCaptureContext, setCameraCaptureContext] = useState<CameraCapture | null>(null);
  // Whether PhotoExtractor is actually on screen — decoupled from
  // importedAsset itself, since the source photo now outlives a single
  // extraction attempt (see "Retry Extraction" in DiscoveryReveal).
  const [extractorVisible, setExtractorVisible] = useState(false);
  // While set, the ghost-cutout reveal is shown instead of DiscoveryReveal —
  // it crossfades from this cropped photo into the finished cutout, then
  // hands off. Set on every successful scan, live capture or import alike.
  const [revealCrop, setRevealCrop] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  // Fire-and-forget when/where lookups kicked off at the start of each
  // capture/import — awaited only after submitImageForSticker resolves, so
  // they never delay DiscoveryReveal. Reused as-is across a retry
  // (re-awaiting an already-resolved promise is instant, and the moment/place
  // didn't change).
  const locationPromiseRef = useRef<Promise<CapturedLocation | null> | null>(null);
  const metadataPromiseRef = useRef<ReturnType<typeof getImportedPhotoMetadata> | null>(null);
  // The draft being replaced by an in-progress "Retry Extraction" — restored
  // if the user backs out of PhotoExtractor without finishing the retry, and
  // cleaned up (its now-orphaned storage files removed) once the retry
  // actually succeeds. Null outside of a retry.
  const draftBeforeRetryRef = useRef<StickerDraft | null>(null);
  // The in-flight create-sticker call, so the extractor's X can stop a scan
  // that is taking too long, and so a scan can give up on its own.
  const scanAbortRef = useRef<{ controller: AbortController; byUser: boolean; timedOut: boolean; startedAt: number } | null>(null);
  // Dry-run only: the device's cutout for the scan in flight, shown in the
  // reveal instead of the saved image. Cleared each scan so a failed device
  // cutout never shows the previous scan's preview.
  const previewCutoutRef = useRef<string | null>(null);
  // How long the vocabulary call itself took, as reported by the edge
  // function. Separates 'the network was slow' from 'the model was rate-limited',
  // which is the difference between a payload problem and a quota problem.
  const lastVocabMsRef = useRef<number | null>(null);

  const extractorVisibleRef = useRef(false);
  extractorVisibleRef.current = extractorVisible;

  // Storage removal for files no card will ever point at.
  const removeCutout = useCallback((imagePath: string | null, thumbPath?: string | null) => {
    if (!imagePath) return;
    supabase.storage.from('sticker-images').remove(withThumbPath(imagePath)).then(({ error }) => {
      if (error) debugWarn('Failed to clean up unused cutout', error);
    });
  }, []);
  const releaseCarried = useCallback(() => {
    const c = carriedRef.current;
    carriedRef.current = null;
    if (c) removeCutout(c.imagePath, c.thumbPath);
  }, [removeCutout]);
  // The Undo window for a discarded draft is over: delete its files for good.
  const flushPendingDiscard = useCallback(() => {
    const p = pendingDiscardRef.current;
    if (!p) return;
    clearTimeout(p.timer);
    pendingDiscardRef.current = null;
    const paths = withThumbPath(p.draft.imagePath);
    if (p.draft.memoryPhotoPath) paths.push(p.draft.memoryPhotoPath);
    supabase.storage.from('sticker-images').remove(paths).then(({ error }) => {
      if (error) debugWarn('Failed to remove a discarded scan', error);
    });
  }, []);

  // Backgrounding (B-core 0): an in-flight scan continues. Timers don't run
  // while suspended, so on return the clock is re-read: a scan past its limit is
  // stopped at once instead of waiting for a timer that already lapsed. A
  // discard's Undo window closes when the app leaves the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') { flushPendingDiscard(); return; }
      const scan = scanAbortRef.current;
      if (scan && Date.now() - scan.startedAt > SCAN_TIMEOUT_MS && !scan.controller.signal.aborted) {
        scan.timedOut = true;
        scan.controller.abort();
      }
    });
    return () => { sub.remove(); flushPendingDiscard(); };
  }, [flushPendingDiscard]);

  // Rectangular (3:4 portrait) camera viewport sized to the screen width
  // (with off-white margin), capped so it doesn't dominate on tablets and
  // scaled down to fit the available vertical space on shorter screens.
  // Measured from the space actually left between the title and the controls,
  // not a fraction of the window, so nothing can collide with the frame.
  const [area, setArea] = useState({ width: 0, height: 0 });
  const onAreaLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea((a) => (a.width === width && a.height === height ? a : { width, height }));
  }, []);
  const camWRaw = Math.min(area.width - FRAME_MARGIN * 2, 400);
  const camHRaw = camWRaw / ASPECT_RATIO;
  const maxCamH = Math.max(area.height - 8, 0);
  const camScale = camHRaw > maxCamH ? maxCamH / camHRaw : 1;
  const camW = camWRaw * camScale;
  const camH = camHRaw * camScale;

  // First-run coach mark under the frame (B-core 1): shown once, gone at 4s or
  // on the first touch, and never over anything.
  const hint = useCoachMark('scan-hint', true);
  const dismissHint = useCallback(() => hint.dismiss(), [hint.dismiss]);
  useEffect(() => {
    if (!hint.visible) return;
    const t = setTimeout(hint.dismiss, 4000);
    return () => clearTimeout(t);
  }, [hint.visible, hint.dismiss]);

  // Pinch-to-zoom — savedZoom anchors the zoom level at the start of each pinch
  const savedZoom = useSharedValue(0);
  const currentZoom = useSharedValue(0);

  const pinchGesture = useMemo(() => Gesture.Pinch()
    .onStart(() => {
      savedZoom.value = currentZoom.value;
      runOnJS(dismissHint)();
    })
    .onUpdate((e) => {
      const next = Math.max(0, Math.min(1, savedZoom.value + (e.scale - 1) * 0.5));
      currentZoom.value = next;
      runOnJS(setZoom)(next);
    }), []);

  // Tap-to-focus reticle — position (top-left of the frame, in points) plus
  // opacity/scale for the appear-then-fade animation.
  const reticleX = useSharedValue(0);
  const reticleY = useSharedValue(0);
  const reticleOpacity = useSharedValue(0);
  const reticleScale = useSharedValue(1);
  // Capture flash and shutter press scale.
  const flash = useSharedValue(0);
  const flashColor = useSharedValue(1); // 1 = white flash, 0 = dim (Reduce Motion)
  const shutterScale = useSharedValue(1);
  const flashStyle = useAnimatedStyle(() => ({
    opacity: flash.value,
    backgroundColor: flashColor.value === 1 ? colors.white : colors.black,
  }));
  const shutterStyle = useAnimatedStyle(() => ({ transform: [{ scale: shutterScale.value }] }));

  const handleFocusTap = useCallback((x: number, y: number) => {
    haptic.select();
    hint.dismiss();
    reticleX.value = x;
    reticleY.value = y;
    reticleScale.value = 1.25;
    reticleScale.value = withTiming(1, { duration: 220 });
    reticleOpacity.value = withTiming(1, { duration: 80 });
    reticleOpacity.value = withDelay(650, withTiming(0, { duration: 200 }));

    // Pulse into "focus once and lock" then back to continuous autofocus,
    // so the lens actually re-settles where the user tapped (as close as
    // expo-camera's non-coordinate autofocus API allows).
    setAutofocusMode('on');
    if (focusPulseTimeout.current) clearTimeout(focusPulseTimeout.current);
    focusPulseTimeout.current = setTimeout(() => setAutofocusMode('off'), 900);
  }, []);

  const tapGesture = useMemo(() => Gesture.Tap()
    .maxDuration(250)
    .onEnd((e) => {
      runOnJS(handleFocusTap)(e.x, e.y);
    }), [handleFocusTap]);

  const focusGesture = useMemo(() => Gesture.Race(pinchGesture, tapGesture), [pinchGesture, tapGesture]);

  const reticleStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: reticleX.value - RETICLE_SIZE / 2 },
      { translateY: reticleY.value - RETICLE_SIZE / 2 },
      { scale: reticleScale.value },
    ],
    opacity: reticleOpacity.value,
  }));

  // Sends a processed JPEG to the create-sticker edge function and stores the
  // result as a draft for DiscoveryReveal. Shared by both the live-capture and
  // photo-import flows — throws on failure so each caller can report it in its
  // own voice ("Scan failed" vs "Extraction failed").
  const submitImageForSticker = useCallback(async ({
    base64,
    memoryBase64,
    contextBase64,
    discoveredAt,
    lassoPolygon,
    precutImagePath,
    precutThumbPath,
    signal,
  }: {
    signal?: AbortSignal;
    base64: string;
    memoryBase64: string | null | undefined;
    // A small copy of the same scene, for the vision model. See
    // prepareContextPhoto.
    contextBase64?: string | null;
    discoveredAt: string;
    lassoPolygon?: Point[];
    // Set when the device already cut this one out and uploaded it. The
    // function then skips background removal entirely and only does
    // vocabulary.
    precutImagePath?: string | null;
    // The thumbnail uploaded beside the device cutout, if it made one.
    precutThumbPath?: string | null;
  }) => {
    if (!user) throw new Error('Not signed in');

    const invoked = supabase.functions.invoke('create-sticker', {
      body: {
        image: `data:image/jpeg;base64,${base64}`,
        userId: user.id,
        language,
        ...(memoryBase64 ? { memoryImage: `data:image/jpeg;base64,${memoryBase64}` } : {}),
        ...(contextBase64 ? { contextImage: `data:image/jpeg;base64,${contextBase64}` } : {}),
        ...(lassoPolygon ? { lassoPolygon } : {}),
        ...(precutImagePath ? { precutImagePath } : {}),
      },
      signal,
    });
    // The signal alone doesn't stop the request on the device (verified on the
    // Simulator 2026-10-31: a stopped scan still produced its card), so race
    // it: Stop or the time limit frees the screen at once, and a result that
    // lands afterwards is dropped — with the files the server saved for it.
    let stopped: Promise<never> | null = null;
    if (signal) {
      stopped = new Promise<never>((_, reject) => {
        const onAbort = () => reject(new Error('Scan stopped'));
        if (signal.aborted) onAbort(); else signal.addEventListener('abort', onAbort);
      });
      invoked.then(({ data: late }) => {
        if (!signal.aborted || !late?.imagePath) return;
        const paths = [late.imagePath, late.memoryPhotoPath].filter(Boolean) as string[];
        supabase.storage.from('sticker-images').remove(paths).then(({ error: cleanupError }) => {
          if (cleanupError) debugWarn('Failed to clean up a stopped scan', cleanupError);
        });
      });
    }
    const { data, error } = await (stopped ? Promise.race([invoked, stopped]) : invoked);

    if (error) {
      const status = (error as any).context?.status;
      // No HTTP status: the request never got an answer (offline, dropped). Keep
      // the original so it classifies as offline, not as a slow service.
      if (!status) throw error;
      const body = await (error as any).context?.json?.().catch(() => null);
      // 429 = the per-user daily quota is spent (see the create-sticker edge
      // function). Not a failure of the scan, so it gets its own alert title
      // rather than the alarming "Scan failed".
      if (status === 429) {
        throw new ScanFailure(body?.error ?? 'Daily limit reached. Try again tomorrow.', { status });
      }
      // No parseable JSON body means the response wasn't a normal app-level
      // error (those always return {error: "..."} — see create-sticker's
      // catch block) — it's the edge runtime itself getting cut off
      // mid-request (observed in the function logs as a "EarlyDrop"
      // shutdown while idle, waiting on the vision/background-removal
      // calls). The SDK's own message for that is the unhelpful generic
      // "Edge Function returned a non-2xx status code" — swap in something
      // the user can actually act on.
      throw new ScanFailure(body?.error ?? 'This took too long and was cut off.', { status });
    }
    if (data.error) throw new ScanFailure(String(data.error));
    // The model answered but named nothing: that is its own row, not a failure
    // to reach it (B-core 2).
    if (!String(data.word ?? '').trim()) throw new ScanFailure('Nothing recognised', { kind: 'nothing' });
    // `_debug_groqMs` is the pre-Gemini name; edge functions deploy
    // separately from app builds, so accept both for one release.
    const vocabMs = data._debug_vocabMs ?? data._debug_groqMs;
    lastVocabMsRef.current = typeof vocabMs === 'number' ? vocabMs : null;
    debugLog('[scan] edge fn debug:', data._debug_bgStatus, `vocab ${lastVocabMsRef.current}ms`);

    setDraft({
      language: data.language === 'ja' || data.language === 'yue' ? data.language : 'fr',
      word: String(data.word ?? ''),
      translation: String(data.translation ?? ''),
      reading: String(data.reading ?? ''),
      sentence: String(data.sentence ?? ''),
      sentenceTranslation: String(data.sentenceTranslation ?? ''),
      sentenceInsight: data.sentenceInsight ?? null,
      // Validated against the sentence server-side before it got here; the
      // card re-checks it at render time anyway (see lib/gloss.ts), so a
      // malformed value degrades to no breakdown rather than a wrong one.
      sentenceGloss: data.sentenceGloss ?? null,
      grammarKey: data.grammarKey ?? null,
      partOfSpeech: data.partOfSpeech ?? null,
      category: data.category ?? 'Other',
      imagePath: String(data.imagePath ?? ''),
      // Only trusted when the server kept the device's cutout; a server-made
      // cutout has a different name and no thumbnail.
      thumbPath: precutThumbPath && precutImagePath && data.imagePath === precutImagePath ? precutThumbPath : null,
      memoryPhotoPath: data.memoryPhotoPath ?? null,
      memoryPhotoColor: data.memoryPhotoColor ?? null,
      // Shown as an inline banner on DiscoveryReveal rather than an
      // Alert.alert fired here — this resolves before GhostCutoutReveal's
      // crossfade even starts, and a system dialog popping up mid-animation
      // would interrupt that choreographed reveal.
      bgIssue: data.bgIssue ?? null,
      // Which engine produced this cutout. Drives the "Redo cutout" offer:
      // there's no point offering a cloud re-cut on a sticker the cloud
      // already made.
      bgSource: data.bgSource === 'device' ? 'device' : 'server',
      localCutoutUri: previewCutoutRef.current,
      discoveredAt,
      latitude: null,
      longitude: null,
      locationLabel: null,
    });
  }, [user, language]);

  // Resizes the full, uncropped photo down to a manageable size (long side
  // capped at 1280px, never upscaled) so it can be stored alongside the
  // sticker as the "memory photo" to flip to.
  // A small copy of the wider scene, for the vision model only.
  //
  // The vision model is sent the scene so the example sentence can describe
  // where the object actually was. It does NOT need this to be small for
  // token reasons — measured 2026-09-09, both Gemini and Groq bill a flat
  // per-image rate that is identical at 640px and 1280px. It stays small
  // because the phone uploads it: 1280px is ~5x the bytes over cellular, and
  // that is latency the user waits through on every scan.
  const prepareContextPhoto = useCallback(async (uri: string, width: number, height: number) => {
    const longSide = Math.max(width, height);
    let context = ImageManipulator.manipulate(uri);
    if (longSide > 640) {
      const scale = 640 / longSide;
      context = context.resize({ width: Math.round(width * scale) });
    }
    const rendered = await context.renderAsync();
    const result = await rendered.saveAsync({ compress: 0.6, format: SaveFormat.JPEG, base64: true });
    return result.base64 ?? null;
  }, []);

  const prepareMemoryPhoto = useCallback(async (uri: string, width: number, height: number) => {
    let context = ImageManipulator.manipulate(uri);
    const longSide = Math.max(width, height);
    if (longSide > 1280) {
      const scale = 1280 / longSide;
      context = context.resize({ width: Math.round(width * scale) });
    }
    const rendered = await context.renderAsync();
    const result = await rendered.saveAsync({
      compress: 0.7,
      format: SaveFormat.JPEG,
      base64: true,
    });
    return result.base64 ?? null;
  }, []);

  const handleExtractFromPhoto = useCallback(async (extractArg: ExtractResult,
    // The live-capture path calls this in the same tick it stages its source,
    // before those setState calls have flushed — so it hands the source in
    // directly rather than letting this closure read a stale one (or, on the
    // very first scan of a session, none at all).
    sourceOverride?: { asset: CaptureAsset; camera: CameraCapture },
  ) => {
    const {
      base64, uri, lassoPolygon, segmentUri, segmentWidth, segmentHeight, selectionPolygon,
      selectionKind, fullUri, fullWidth, fullHeight, fullSelectionPolygon,
    } = extractArg;
    const asset = sourceOverride?.asset ?? importedAsset;
    const camera = sourceOverride?.camera ?? cameraCaptureContext;
    if (processing || !asset) return;
    // Anything held from a previous attempt is finished with: a retry uploads its own.
    lastExtractRef.current = { extract: extractArg, source: sourceOverride };
    releaseCarried();
    flushPendingDiscard();
    setScanError(null);
    setStage('cutting');
    setUsingServerCutout(false);
    setProcessing(true);

    // Camera-sourced: reuse the exact moment/place captured at shutter-press
    // (see cameraCaptureContext) — never "now", or fiddling with the
    // box/lasso (or retrying later) would keep pushing the discovery's
    // timestamp forward. Library-sourced: this is an OLD photo, so look up
    // its own creation date/GPS instead (fire-and-forget; falls back to
    // "now"/no-location if unavailable) — reused as-is on a retry rather
    // than re-fetched.
    const fallbackDiscoveredAt = camera?.discoveredAt ?? new Date().toISOString();
    if (!camera && !metadataPromiseRef.current) {
      metadataPromiseRef.current = getImportedPhotoMetadata(asset.assetId);
    }

    // Set once the cutout is done and the word lookup starts, so a failure
    // after that point isn't reported as a failed extraction — the cutout
    // worked; it's the word that didn't come back.
    let lookingUpWord = false;
    // Hoisted so the catch can decide whether the uploaded cutout is kept for
    // "Type the word instead" or removed.
    let precutImagePath: string | null = null;
    let precutThumbPath: string | null = null;
    const scanAbort = { controller: new AbortController(), byUser: false, timedOut: false, startedAt: Date.now() };
    scanAbortRef.current = scanAbort;
    // Hard timeout (B-core 2): the error card, never a silent wait. The server
    // gives each model attempt 12s with retries and a failover; past 45s,
    // waiting longer has never produced a card.
    const giveUp = setTimeout(() => { scanAbort.timedOut = true; scanAbort.controller.abort(); }, SCAN_TIMEOUT_MS);

    try {
      // Checked here rather than left to submitImageForSticker, because the
      // upload below runs first and would otherwise write to `undefined/…`.
      if (!user) throw new Error('Not signed in');

      // The full, uncropped frame becomes the "memory photo" to flip to —
      // the true raw sensor capture for a live photo, or the whole picked
      // photo (before extraction) for a library import.
      // Time each leg from inside, not around the Promise.all — the wrapper
      // only ever reports the slower of the two, which made parallelising them
      // look like a regression.
      const timed = <T,>(work: Promise<T>): Promise<{ value: T; ms: number }> => {
        const startedAt = Date.now();
        return work.then((value) => ({ value, ms: Date.now() - startedAt }));
      };

      const sceneUri = camera?.rawUri ?? asset.uri;
      const sceneWidth = camera?.rawWidth ?? asset.width;
      const sceneHeight = camera?.rawHeight ?? asset.height;
      const memoryPromise = prepareMemoryPhoto(sceneUri, sceneWidth, sceneHeight);
      const contextPromise = prepareContextPhoto(sceneUri, sceneWidth, sceneHeight);

      // Try the device first. Apple Vision returns the foreground objects it
      // found, and the user's own selection picks which of them we keep —
      // so the selection is the question the model was asked, not a
      // correction applied to its answer afterwards.
      //
      // Anything short of a confident result (no objects found, nothing
      // agreeing with the selection, a degenerate matte, an older iOS) falls
      // through to the server exactly as before. The user sees no difference
      // beyond the wait.
      let upload: UploadOutcome | null = null;
      previewCutoutRef.current = null;

      const [memoryLeg, contextBase64, cutoutLeg] = await Promise.all([
        timed(memoryPromise),
        contextPromise,
        timed(attemptLocalCutout({
          uri: segmentUri,
          polygon: selectionPolygon,
          sourceWidth: segmentWidth,
          sourceHeight: segmentHeight,
          kind: selectionKind,
          fullUri,
          fullWidth,
          fullHeight,
          fullPolygon: fullSelectionPolygon,
        })),
      ]);
      const memoryBase64 = memoryLeg.value;
      const local = cutoutLeg.value;
      const memoryMs = memoryLeg.ms;
      const cutoutMs = cutoutLeg.ms;

      // Step one is over either way; what differs is who did it, and whether
      // the user is about to wait seconds instead of milliseconds.
      setUsingServerCutout(!local.ok);
      setStage(local.ok ? 'saving' : 'word');

      if (local.ok && CUTOUT_DRY_RUN) {
        // Measuring, not adopting. The sticker still comes from the server and
        // nothing is uploaded — but the device's version is kept on disk and
        // shown in the reveal, so the new pipeline can actually be looked at
        // without deploying anything.
        previewCutoutRef.current = local.uri;
      } else if (local.ok) {
        try {
          upload = await uploadCutout(local.uri, cutoutPath(user.id));
          precutImagePath = upload.path;
          precutThumbPath = upload.thumbPath;
        } catch (uploadErr: any) {
          // The cutout itself was fine; only getting it to storage failed.
          // Fall back to the server rather than fail the scan.
          //
          // Deliberately still sequential. The path is known in advance, so
          // this upload *could* run alongside create-sticker and save ~650ms —
          // but then the sticker row would already reference a file that might
          // never arrive, and recovering from that costs either a discarded
          // scan or a second billed vocabulary call. #3 removes the wait
          // properly instead, by rendering the cutout from local disk the
          // moment it exists and letting the upload finish in the background.
          debugWarn('[scan] cutout upload failed, falling back to server', uploadErr?.message);
          trackEvent('cutout_upload_failed', { reason: String(uploadErr?.message ?? 'unknown') });
        }
      }

      setStage('word');
      lookingUpWord = true;
      setSceneBase64(contextBase64 ?? null);
      setSceneChips([]);
      const submitStarted = Date.now();
      try {
        await submitImageForSticker({
          base64,
          memoryBase64,
          contextBase64,
          discoveredAt: fallbackDiscoveredAt,
          lassoPolygon,
          precutImagePath,
          precutThumbPath,
          signal: scanAbort.controller.signal,
        });
        const serverMs = Date.now() - submitStarted;
        debugLog(
          `[scan] memory-photo ${memoryMs}ms ‖ cutout ${cutoutMs}ms · create-sticker ${serverMs}ms` +
            ` (vocab ${lastVocabMsRef.current ?? '?'}ms)` +
            (CUTOUT_DRY_RUN ? ' (includes rembg — dry run runs both pipelines)' : ''),
        );
      } catch (submitErr) {
        // The cutout is already in storage but no sticker points at it. The
        // outer catch decides: keep it for "Type the word instead", or collect
        // it (the daily quota is claimed *after* this upload has happened).
        throw submitErr;
      }

      // A successful (re)extraction replaces whatever draft a "Retry
      // Extraction" was standing in for — clean up its now-orphaned storage
      // files rather than leaving them behind.
      const staleDraft = draftBeforeRetryRef.current;
      draftBeforeRetryRef.current = null;
      if (staleDraft) {
        const stalePaths = [...withThumbPath(staleDraft.imagePath), ...(staleDraft.memoryPhotoPath ? [staleDraft.memoryPhotoPath] : [])];
        supabase.storage.from('sticker-images').remove(stalePaths).then(({ error }) => {
          if (error) debugWarn('Failed to clean up previous extraction attempt', error);
        });
      }

      setExtractorVisible(false);
      setFrozenUri(null);
      // Hold off on DiscoveryReveal — show the ghost-cutout crossfade first,
      // it hands off to DiscoveryReveal once the animation completes.
      setRevealCrop(uri);

      if (camera) {
        const location = await locationPromiseRef.current;
        if (location) {
          setDraft((prev) => prev ? {
            ...prev,
            latitude: location.latitude,
            longitude: location.longitude,
            locationLabel: location.locationLabel,
          } : prev);
        }
        return;
      }

      const meta = await metadataPromiseRef.current;
      if (meta?.discoveredAt || meta?.location) {
        setDraft((prev) => prev ? {
          ...prev,
          ...(meta.discoveredAt ? { discoveredAt: meta.discoveredAt } : {}),
          ...(meta.location ? {
            latitude: meta.location.latitude,
            longitude: meta.location.longitude,
            locationLabel: meta.location.locationLabel,
          } : {}),
        } : prev);
      }
    } catch (err: any) {
      // Stopped with Cancel or the X: they know, and the photo is still there.
      // The camera path has no picker to return to, so it goes back to the camera.
      if (scanAbort.byUser) {
        removeCutout(precutImagePath, precutThumbPath);
        if (!extractorVisibleRef.current) setFrozenUri(null);
        return;
      }
      const kind = classifyScanFailure(err, { lookingUpWord, timedOut: scanAbort.timedOut });
      debugWarn('[scan] failed', kind, err?.status, err?.message);
      if (precutImagePath) {
        if (keepsCutout(kind)) {
          carriedRef.current = { imagePath: precutImagePath, thumbPath: precutThumbPath };
        } else {
          removeCutout(precutImagePath, precutThumbPath);
        }
      }
      setScanError(kind);
    } finally {
      clearTimeout(giveUp);
      if (scanAbortRef.current === scanAbort) scanAbortRef.current = null;
      setProcessing(false);
    }
  }, [processing, importedAsset, cameraCaptureContext, submitImageForSticker, prepareMemoryPhoto, user, releaseCarried, flushPendingDiscard, removeCutout]);

  // Captures a photo and scans it immediately — no box/lasso step.
  //
  // Aiming the camera at something already *is* the selection; making the
  // user confirm a box around the frame they just framed is a second answer
  // to a question they already answered. So a live capture goes straight to
  // segmentation with a full-frame selection, which the segmenter reads as
  // "no preference expressed" and resolves by picking the dominant object.
  //
  // The box/lasso tools aren't gone — they stay one tap away behind "Retry
  // Extraction" on the reveal, for the cluttered-desk case where the device
  // grabs the wrong thing. Skipped by default, not removed. The gallery
  // import still opens them up front, since an old photo was framed for
  // something other than this.
  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || capturing || processing || !user) return;
    if (!gate('Scanning needs a connection.')) return;
    haptic.press();
    // White flash 0 > .7 > 0 in 160 ms (Reduce Motion: a 120 ms dim instead).
    flashColor.value = reduced ? 0 : 1;
    flash.value = withTiming(reduced ? 0.45 : 0.7, { duration: reduced ? 60 : 60 }, () => {
      flash.value = withTiming(0, { duration: reduced ? 60 : 100 });
    });
    setScanError(null);
    releaseCarried();
    flushPendingDiscard();
    setCapturing(true);

    // This photo is "now, here". GPS cold-fix can take several seconds, so
    // kick it off but don't await it yet.
    const discoveredAt = new Date().toISOString();
    locationPromiseRef.current = captureLocation();

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (!photo) throw new Error('Failed to capture photo');
      // Freeze on the frame that was caught while the crop and scan run.
      setFrozenUri(photo.uri);

      // Crop to the centered 3:4 rectangle shown inside the viewfinder, so
      // what was framed is what gets scanned — matching what the rectangular
      // preview center-crops ("cover") to show. No resize/compress here;
      // renderWholePhotoExtract does that for both the upload copy and the
      // segmentation copy, at their own sizes.
      const photoRatio = photo.width / photo.height;
      let cropWidth: number, cropHeight: number, originX: number, originY: number;
      if (photoRatio > ASPECT_RATIO) {
        cropHeight = photo.height;
        cropWidth = Math.round(cropHeight * ASPECT_RATIO);
        originX = Math.round((photo.width - cropWidth) / 2);
        originY = 0;
      } else {
        cropWidth = photo.width;
        cropHeight = Math.round(cropWidth / ASPECT_RATIO);
        originX = 0;
        originY = Math.round((photo.height - cropHeight) / 2);
      }

      const rendered = await ImageManipulator.manipulate(photo.uri)
        .crop({ originX, originY, width: cropWidth, height: cropHeight })
        .renderAsync();
      const cropped = await rendered.saveAsync({ compress: 0.92, format: SaveFormat.JPEG });

      // The true full, uncropped sensor frame (not the 3:4 pre-crop above)
      // becomes the "memory photo" to flip to.
      const camera: CameraCapture = {
        discoveredAt, rawUri: photo.uri, rawWidth: photo.width, rawHeight: photo.height,
      };
      const asset: CaptureAsset = { uri: cropped.uri, width: cropWidth, height: cropHeight };

      // Staged even though the extractor isn't being opened: this is what
      // "Retry Extraction" reopens on if the automatic cutout picks wrong.
      setCameraCaptureContext(camera);
      setImportedAsset(asset);

      const extract = await renderWholePhotoExtract(asset.uri, asset.width, asset.height);
      // Hand the source in explicitly — the two setState calls above have not
      // flushed yet, so the closure below would otherwise read the previous
      // scan's asset.
      setCapturing(false);
      await handleExtractFromPhoto(extract, { asset, camera });
    } catch (err: any) {
      // Taking or cropping the photo failed before anything was scanned.
      setFrozenUri(null);
      haptic.error();
      toast.show({ kind: 'error', message: await friendlyError(err, "Couldn't take that photo. Try again."), aboveTabBar: true });
    } finally {
      setCapturing(false);
    }
  }, [capturing, processing, user, handleExtractFromPhoto, reduced, releaseCarried, flushPendingDiscard, toast]);

  const handleToggleTorch = useCallback(() => {
    haptic.tap();
    setTorchOn((prev) => !prev);
  }, []);

  const handleImportPhoto = useCallback(async () => {
    if (processing) return;
    if (!gate('Scanning needs a connection.')) return;
    haptic.tap();
    const { granted, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      alertPermissionDenied(
        'Photos Access Needed',
        'Tabi Stickers needs access to your photo library to import a picture.',
        canAskAgain
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    const asset = !result.canceled ? result.assets[0] : null;
    if (asset) {
      metadataPromiseRef.current = null;
      setScanError(null);
      releaseCarried();
      flushPendingDiscard();
      setCameraCaptureContext(null);
      setImportedAsset({ uri: asset.uri, width: asset.width, height: asset.height, assetId: asset.assetId ?? undefined });
      setExtractorVisible(true);
    }
  }, [processing, releaseCarried, flushPendingDiscard]);


  // Confirmation shown on the camera after the reveal sheet closes.
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [typeWordOpen, setTypeWordOpen] = useState(false);
  // After Add: a toast with View, and the new card is on Home (B-core 3).
  // View opens the new card (one) or Home scrolled to the newest cards (several).
  const announceAdded = useCallback((count: number, cardId?: string) => {
    toast.show({
      kind: 'success',
      message: count === 1 ? 'Added 1 card' : `Added ${count} cards`,
      action: {
        label: 'View',
        onPress: () => router.navigate(
          count === 1 && cardId
            ? { pathname: '/(tabs)/collection', params: { open: cardId } }
            : { pathname: '/(tabs)/collection', params: { fresh: String(Date.now()) } },
        ),
      },
      aboveTabBar: true,
    });
  }, [toast, router]);

  const handleAdd = async () => {
    if (!draft || !user || saving) return;
    setSaving(true);
    setSaveError(null);
    // origin_author_id is deliberately NOT sent: a BEFORE INSERT trigger
    // (042) stamps it from auth.uid(), so a card can never claim an author
    // it did not have. Read it back rather than assuming it.
    const extras = sceneBase64 ? sceneChips : [];
    const sceneId = extras.length ? newSceneId() : null;
    const { data: inserted, error } = await supabase.from('stickers').insert({
      user_id: user.id,
      scene_id: sceneId,
      language: draft.language,
      word: draft.word,
      translation: draft.translation,
      reading: draft.reading,
      sentence: draft.sentence,
      sentence_translation: draft.sentenceTranslation,
      sentence_insight: draft.sentenceInsight,
      sentence_gloss: draft.sentenceGloss,
      grammar_key: draft.grammarKey,
      part_of_speech: draft.partOfSpeech,
      category: draft.category,
      image_path: draft.imagePath,
      thumb_path: draft.thumbPath,
      memory_photo_path: draft.memoryPhotoPath,
      memory_photo_color: draft.memoryPhotoColor,
      discovered_at: draft.discoveredAt,
      latitude: draft.latitude,
      longitude: draft.longitude,
      location_label: draft.locationLabel,
    }).select('id').single();
    setSaving(false);
    if (error) {
      // The draft stays; the message sits above the button (B-core 3).
      haptic.error();
      setSaveError(isNetworkError(new Error(error.message))
        ? "You're offline. Your card is kept here."
        : "Couldn't save. Try again.");
      return;
    }
    haptic.success();
    setDraft(null);
    setSceneChips([]);
    setSceneBase64(null);
    // Committed for good — the source photo retained for a possible "Retry
    // Extraction" is no longer needed.
    setImportedAsset(null);
    setCameraCaptureContext(null);
    announceAdded(1 + extras.length, inserted?.id);

    // The extra words are written in the background: each needs a sentence
    // (a few seconds), and the learner has already seen and chosen them, so
    // nothing here is worth holding the screen for. Only a failure speaks up.
    if (extras.length && sceneId && sceneBase64) {
      addSceneCards({
        userId: user.id,
        language: draft.language,
        sceneBase64,
        sceneId,
        chips: extras,
        discoveredAt: draft.discoveredAt,
      }).then(({ failed }) => {
        if (failed) {
          toast.show({
            kind: 'error',
            message: failed === extras.length
              ? "Couldn't add the extra words. Your scanned word was saved."
              : `Couldn't add ${failed} of the extra words. Your scanned word was saved.`,
            aboveTabBar: true,
          });
        }
      });
    }
  };

  // Discard has no confirm (B-core 3). The draft is held in memory and its files
  // are deleted only when the Undo window closes (see flushPendingDiscard).
  const UNDO_WINDOW_MS = 8000;
  const handleDiscard = () => {
    if (!draft) return;
    flushPendingDiscard();
    const held = {
      draft, sceneBase64, chips: sceneChips, asset: importedAsset, camera: cameraCaptureContext,
      timer: setTimeout(flushPendingDiscard, UNDO_WINDOW_MS),
    };
    pendingDiscardRef.current = held;
    haptic.tap();
    setDraft(null);
    setSceneChips([]);
    setSceneBase64(null);
    setImportedAsset(null);
    setCameraCaptureContext(null);
    setSaveError(null);
    toast.show({
      kind: 'undo',
      message: 'Discarded',
      action: { label: 'Undo', onPress: undoDiscard },
      aboveTabBar: true,
    });
  };
  const undoDiscard = () => {
    const held = pendingDiscardRef.current;
    if (!held) {
      toast.show({ kind: 'error', message: "Couldn't bring that back.", aboveTabBar: true });
      return;
    }
    clearTimeout(held.timer);
    pendingDiscardRef.current = null;
    setDraft(held.draft);
    setSceneBase64(held.sceneBase64);
    setSceneChips(held.chips);
    setImportedAsset(held.asset);
    setCameraCaptureContext(held.camera);
  };

  // Reopens the box/lasso step on the exact same source photo instead of
  // discarding and starting over from scratch. draftBeforeRetryRef is the
  // safety net: if the user backs out of PhotoExtractor without finishing
  // the retry (see the PhotoExtractor onClose handler below), this draft is
  // restored rather than lost.
  const handleRetryExtraction = useCallback(() => {
    if (!draft || !importedAsset) return;
    haptic.tap();
    draftBeforeRetryRef.current = draft;
    setDraft(null);
    setExtractorVisible(true);
  }, [draft, importedAsset]);

  // User wasn't happy with the detected English word — re-derive the
  // word/reading/category for their corrected word via the LLM, keeping
  // the same image and language. Throws so DiscoveryReveal can revert its
  // local edit state on failure.
  const handleEditWord = useCallback(async (newWord: string) => {
    setRetranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke('translate-word', {
        body: { englishWord: newWord, language },
      });

      // Thrown as-is: DiscoveryReveal runs it through friendlyError (lesson 3).
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setDraft((prev) => prev ? {
        ...prev,
        word: String(data.word ?? prev.word),
        translation: String(data.translation ?? newWord),
        reading: String(data.reading ?? prev.reading),
        category: data.category ?? prev.category,
      } : prev);
    } finally {
      setRetranslating(false);
    }
  }, [language]);

  // User edited the English sentence describing the scene — translate it
  // into the target language via the LLM, keeping their English as-is.
  // Throws so DiscoveryReveal can revert its local edit state on failure.
  const handleEditSentence = useCallback(async (newSentence: string) => {
    setRetranslatingSentence(true);
    try {
      const { data, error } = await supabase.functions.invoke('translate-sentence', {
        body: { englishSentence: newSentence, language },
      });

      // Thrown as-is: DiscoveryReveal runs it through friendlyError (lesson 3).
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setDraft((prev) => prev ? {
        ...prev,
        sentence: String(data.sentence ?? prev.sentence),
        sentenceTranslation: newSentence,
        // translate-sentence spreads the LLM's raw JSON keys through
        // unchanged (unlike create-sticker, which remaps to camelCase) —
        // so this reads the snake_case keys on purpose.
        sentenceInsight: data.sentence_insight ?? prev.sentenceInsight,
        // Both of these describe the sentence, and the sentence has just been
        // replaced — so they are taken from the new response or dropped, never
        // carried over from the old one. The grammar key goes for good: the
        // learner chose this sentence's content, so it no longer demonstrates
        // whatever structure the syllabus had picked for the scan.
        sentenceGloss: data.gloss ?? null,
        grammarKey: null,
      } : prev);
    } finally {
      setRetranslatingSentence(false);
    }
  }, [language]);

  // ---- Recoveries from an inline scan error (B-core 2) ---------------------
  const runLast = useCallback(() => {
    const last = lastExtractRef.current;
    if (!last) return;
    handleExtractFromPhoto(last.extract, last.source);
  }, [handleExtractFromPhoto]);

  // Back to the live camera with nothing held.
  const backToCamera = useCallback(() => {
    releaseCarried();
    setScanError(null);
    setFrozenUri(null);
    setExtractorVisible(false);
    setImportedAsset(null);
    setCameraCaptureContext(null);
    lastExtractRef.current = null;
  }, [releaseCarried]);

  const handleScanErrorAction = useCallback(async (action: ScanAction) => {
    haptic.tap();
    switch (action) {
      case 'retry':
        runLast();
        break;
      case 'pickAgain':
        releaseCarried();
        setScanError(null);
        setFrozenUri(null);
        setExtractorVisible(true);
        break;
      case 'wholePhoto': {
        if (!importedAsset) break;
        try {
          const extract = await renderWholePhotoExtract(importedAsset.uri, importedAsset.width, importedAsset.height);
          const camera = cameraCaptureContext;
          handleExtractFromPhoto(extract, camera ? { asset: importedAsset, camera } : undefined);
        } catch (err) {
          toast.show({ kind: 'error', message: await friendlyError(err, "Couldn't use the whole photo. Try again."), aboveTabBar: true });
        }
        break;
      }
      case 'typeWord':
        setTypeCutout(carriedRef.current);
        setTypeWordOpen(true);
        break;
      case 'retake':
      case 'ok':
        backToCamera();
        break;
    }
  }, [runLast, releaseCarried, importedAsset, cameraCaptureContext, handleExtractFromPhoto, toast, backToCamera]);

  const openTypeWord = useCallback(() => {
    if (!gate('Adding a word needs a connection.')) return;
    haptic.tap();
    setTypeCutout(null);
    setTypeWordOpen(true);
  }, []);

  const closeTypeWord = useCallback(() => {
    setTypeWordOpen(false);
    // Closed without adding: the carried cutout stays only while the error card
    // that offered it is still on screen.
    if (!scanError) { releaseCarried(); setTypeCutout(null); }
  }, [scanError, releaseCarried]);

  const cancelScan = useCallback(() => {
    const scan = scanAbortRef.current;
    if (!scan) return;
    haptic.tap();
    scan.byUser = true;
    scan.controller.abort();
  }, []);

  if (!permission) return <View style={styles.container} />;

  // Guideline 5.1.2(i): the photo goes to third-party AI, so consent comes
  // before anything that could capture one. `undefined` means the stored answer
  // has not been read yet; showing the sheet then would flash it at people who
  // already agreed. It is a sheet over whatever sits underneath (the camera, or
  // the camera-access page), and nothing underneath is reachable until it's answered.
  const consentSheet = user && aiConsented === false ? (
    <AiConsentGate
      onAccept={acceptAiConsent}
      onNotNow={() => router.navigate('/(tabs)/collection')}
      agree_testID="scan-consent-agree"
      privacy_testID="scan-consent-privacy"
    />
  ) : null;

  if (!permission.granted) {
    // Once canAskAgain is false, requestPermission() resolves to denied
    // without ever showing a dialog — so a "Grant Permission" button here
    // would be dead, on the one screen that produces every sticker in the
    // app. Settings is the only way back; send them there instead.
    const blocked = !permission.canAskAgain;
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionTitle} accessibilityRole="header">Camera Access Needed</Text>
        <Text style={styles.permissionSubtitle}>
          {blocked
            ? 'Camera is off. Turn it on in Settings to scan objects and create stickers.'
            : 'Tabi Stickers needs your camera to turn what you see into a card.'}
        </Text>
        <Button
          label={blocked ? 'Open Settings' : 'Continue'}
          accessibilityLabel={blocked ? 'Open Settings' : 'Grant camera permission'}
          onPress={blocked ? () => Linking.openSettings() : requestPermission}
          style={styles.permissionButton}
        />
        {consentSheet}
      </View>
    );
  }

  const scanning = processing && !extractorVisible;
  const busyShutter = processing || capturing || !!scanError;
  const showFrozen = !!frozenUri && !extractorVisible;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }]}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.3}>What did you find?</Text>
      </View>

      <View style={styles.cameraArea} onLayout={onAreaLayout}>
        {area.width > 0 && (
        <GestureDetector gesture={focusGesture}>
          <View style={[styles.cameraFrame, { width: camW, height: camH }]}>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              zoom={zoom}
              enableTorch={torchOn}
              autofocus={autofocusMode}
            />

            <View style={styles.gridOverlay} pointerEvents="none">
              <View style={[styles.gridLineV, { left: '33.333%' }]} />
              <View style={[styles.gridLineV, { left: '66.666%' }]} />
              <View style={[styles.gridLineH, { top: '33.333%' }]} />
              <View style={[styles.gridLineH, { top: '66.666%' }]} />
            </View>

            <Animated.View style={[styles.reticle, reticleStyle]} pointerEvents="none" />

            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />

            {zoom > 0.02 && (
              <View style={styles.zoomPill} pointerEvents="none">
                <Text style={styles.zoomPillText}>{Math.round(zoom * 100)}%</Text>
              </View>
            )}

            {/* Flash toggle: a 44pt control in the frame's corner, so the three
                buttons under the frame are the three ways to start a card. */}
            <Pressable
              style={styles.torch}
              onPress={handleToggleTorch}
              accessibilityRole="button"
              accessibilityLabel={torchOn ? 'Turn the flash off' : 'Turn the flash on'}
              accessibilityState={{ selected: torchOn }}
            >
              {torchOn
                ? <Zap size={20} strokeWidth={1.75} color={colors.white} fill={colors.white} />
                : <ZapOff size={20} strokeWidth={1.75} color={colors.white} />}
            </Pressable>

            {/* Coach mark: once, at the frame's foot, inside it so it can never
                overlap the title or the buttons. */}
            {hint.visible && !showFrozen && (
              <View style={styles.hintPill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Text style={styles.hintText}>Tap to focus. Pinch to zoom.</Text>
              </View>
            )}

            {showFrozen && <Image source={{ uri: frozenUri! }} style={StyleSheet.absoluteFill} resizeMode="cover" />}

            <Animated.View style={[StyleSheet.absoluteFill, flashStyle]} pointerEvents="none" />

            {scanning && !scanError && (
              <ScanOverlay>
                <ScanProgress stage={stage} usingServerCutout={usingServerCutout} onCancel={cancelScan} />
              </ScanOverlay>
            )}
            {!!scanError && !extractorVisible && !processing && (
              <ScanOverlay>
                <ScanErrorCard kind={scanError} onAction={handleScanErrorAction} />
              </ScanOverlay>
            )}
          </View>
        </GestureDetector>
        )}
      </View>

      <View style={styles.controls}>
        <View style={styles.captureRow}>
          <TouchableOpacity
            style={styles.sideBtn}
            onPress={handleImportPhoto}
            accessibilityRole="button"
            accessibilityLabel="Import a photo from your library"
            accessibilityState={{ disabled: busyShutter || !online }}
            disabled={busyShutter}
            activeOpacity={0.7}
          >
            <View style={[styles.sideBtnCircle, (busyShutter || !online) && styles.dim]}>
              <ImagePlus size={24} strokeWidth={1.75} color={colors.inkDark} />
            </View>
            <Text style={styles.sideBtnLabel} maxFontSizeMultiplier={1.3}>Gallery</Text>
          </TouchableOpacity>

          <Animated.View style={shutterStyle}>
            <Pressable
              testID="scan-shutter"
              style={[styles.shutter, (busyShutter || !online) && styles.dim]}
              onPress={handleCapture}
              onPressIn={() => { if (!reduced) shutterScale.value = withTiming(0.9, { duration: 80 }); }}
              onPressOut={() => { shutterScale.value = withTiming(1, { duration: 120 }); }}
              accessibilityRole="button"
              accessibilityLabel="Take photo"
              accessibilityState={{ disabled: busyShutter || !online, busy: processing || capturing }}
              disabled={busyShutter}
            >
              <View style={styles.shutterCore} />
            </Pressable>
          </Animated.View>

          <TouchableOpacity
            testID="scan-type-word"
            style={styles.sideBtn}
            onPress={openTypeWord}
            disabled={processing || capturing}
            accessibilityRole="button"
            accessibilityLabel="Type a word"
            accessibilityState={{ disabled: processing || capturing || !online }}
            activeOpacity={0.7}
          >
            <View style={[styles.sideBtnCircle, (processing || capturing || !online) && styles.dim]}>
              <KeyboardIcon size={24} strokeWidth={1.75} color={colors.inkDark} />
            </View>
            <Text style={styles.sideBtnLabel} maxFontSizeMultiplier={1.3}>Type a word</Text>
          </TouchableOpacity>
        </View>
      </View>

      <PhotoExtractor
        imageUri={extractorVisible ? (importedAsset?.uri ?? null) : null}
        imageWidth={importedAsset?.width ?? 0}
        imageHeight={importedAsset?.height ?? 0}
        onClose={() => {
          setExtractorVisible(false);
          releaseCarried();
          setScanError(null);
          if (draftBeforeRetryRef.current) {
            // Cancelling a "Retry Extraction" restores the previous
            // successful draft rather than discarding it outright — only a
            // fresh capture/import with no prior result gets fully abandoned
            // in the else branch below.
            setDraft(draftBeforeRetryRef.current);
            draftBeforeRetryRef.current = null;
          } else {
            setImportedAsset(null);
            setCameraCaptureContext(null);
          }
        }}
        onExtract={handleExtractFromPhoto}
        onCancelProcessing={cancelScan}
        processing={processing}
        stage={stage}
        usingServerCutout={usingServerCutout}
        error={scanError}
        onErrorAction={handleScanErrorAction}
      />

      {revealCrop && draft && (
        <GhostCutoutReveal
          croppedUri={revealCrop}
          imagePath={draft.imagePath}
          onComplete={() => setRevealCrop(null)}
        />
      )}

      <DiscoveryReveal
        draft={revealCrop ? null : draft}
        onAdd={handleAdd}
        saveError={saveError}
        onDiscard={handleDiscard}
        onRetryExtraction={handleRetryExtraction}
        onEditWord={handleEditWord}
        onEditSentence={handleEditSentence}
        saving={saving}
        retranslating={retranslating}
        retranslatingSentence={retranslatingSentence}
        sceneBase64={sceneBase64}
        sceneSelected={sceneChips}
        onSceneSelected={setSceneChips}
      />

      {user && (
        <TypeWordSheet
          visible={typeWordOpen}
          language={language}
          userId={user.id}
          cutout={typeCutout}
          onClose={closeTypeWord}
          onAdded={(newId) => {
            setTypeWordOpen(false);
            // The typed card finished the scan that failed: nothing is held any more.
            carriedRef.current = null;
            setTypeCutout(null);
            if (scanError) backToCamera();
            announceAdded(1, newId);
          }}
        />
      )}

      {consentSheet}
    </View>
  );
}

const CORNER_SIZE = 30;
const CORNER_THICKNESS = 3;
const CORNER_INSET = 14;
const FRAME_RADIUS = 28;
const FRAME_MARGIN = 16;
// Viewfinder + capture-crop aspect ratio, expressed as width/height (3:4 portrait).
const ASPECT_RATIO = 3 / 4;
const SCAN_TIMEOUT_MS = 45_000;
const RETICLE_SIZE = 72;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sky },

  // The title sits in the top safe area, above the frame's own margin, so the
  // two can't touch (baseline 06b).
  header: { paddingHorizontal: 20, paddingTop: spacing.sm, paddingBottom: spacing.sm, minHeight: 52, justifyContent: 'center' },
  title: { ...type.title },

  cameraArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cameraFrame: {
    borderRadius: FRAME_RADIUS,
    overflow: 'hidden',
    backgroundColor: colors.black,
    ...e2,
  },

  gridOverlay: { ...StyleSheet.absoluteFillObject },
  gridLineV: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.35)' },
  gridLineH: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.35)' },

  reticle: {
    position: 'absolute',
    width: RETICLE_SIZE,
    height: RETICLE_SIZE,
    borderRadius: RETICLE_SIZE / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
  },

  corner: { position: 'absolute', width: CORNER_SIZE, height: CORNER_SIZE, borderColor: 'rgba(255,255,255,0.95)' },
  cornerTL: { top: CORNER_INSET, left: CORNER_INSET, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderTopLeftRadius: 10 },
  cornerTR: { top: CORNER_INSET, right: CORNER_INSET, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderTopRightRadius: 10 },
  cornerBL: { bottom: CORNER_INSET, left: CORNER_INSET, borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderBottomLeftRadius: 10 },
  cornerBR: { bottom: CORNER_INSET, right: CORNER_INSET, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderBottomRightRadius: 10 },

  zoomPill: {
    position: 'absolute',
    top: CORNER_INSET + CORNER_SIZE + 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  zoomPillText: { color: colors.white, fontSize: 12, fontFamily: fonts.mono },

  torch: {
    position: 'absolute',
    top: CORNER_INSET + CORNER_SIZE + 4,
    right: CORNER_INSET - 4,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(51,41,42,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  hintPill: {
    position: 'absolute',
    bottom: CORNER_INSET + CORNER_SIZE + 6,
    alignSelf: 'center',
    backgroundColor: 'rgba(51,41,42,0.72)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
  },
  hintText: { color: colors.white, fontSize: 14, lineHeight: 20, fontFamily: fonts.text },

  controls: { alignItems: 'center', paddingTop: spacing.md, paddingBottom: spacing.sm },
  captureRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: spacing.md },
  sideBtn: { alignItems: 'center', gap: 6, width: 96, paddingTop: 10 },
  sideBtnCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
    ...e1,
  },
  sideBtnLabel: { fontSize: 14, lineHeight: 18, fontFamily: fonts.display, color: colors.inkDark, textAlign: 'center' },
  dim: { opacity: 0.45 },

  // 72pt shutter: a white ring with a rose core. Rose solid is reserved for the
  // camera (C-look 1).
  shutter: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
    ...e2,
  },
  shutterCore: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.terra },

  permissionContainer: {
    flex: 1,
    backgroundColor: colors.sky,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: TAB_BAR_CLEARANCE,
  },
  permissionTitle: { ...type.h2, marginBottom: spacing.sm, textAlign: 'center' },
  permissionSubtitle: { ...type.body, textAlign: 'center', marginBottom: spacing.lg, maxWidth: 320 },
  permissionButton: { alignSelf: 'stretch' },
});
