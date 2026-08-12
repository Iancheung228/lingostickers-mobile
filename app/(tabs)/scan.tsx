import { useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, runOnJS, withTiming, withDelay,
} from 'react-native-reanimated';
import { ImagePlus, Zap, ZapOff } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/hooks/useAuth';
import { colors, shadows, radii, spacing } from '@/constants/theme';
import { TAB_BAR_CLEARANCE } from '@/constants/tabBar';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/lib/supabase';
import { StickerDraft } from '@/lib/types';
import { Point } from '@/lib/cropGeometry';
import { captureLocation, CapturedLocation } from '@/lib/location';
import { getImportedPhotoMetadata } from '@/lib/photoMetadata';
import DiscoveryReveal from '@/components/DiscoveryReveal';
import PhotoExtractor from '@/components/PhotoExtractor';
import GhostCutoutReveal from '@/components/GhostCutoutReveal';

export default function ScanScreen() {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const language = profile?.target_language ?? 'fr';
  const [permission, requestPermission] = useCameraPermissions();
  const [processing, setProcessing] = useState(false);
  // Guards the shutter against double-taps during the brief local
  // take+crop step, kept separate from `processing` (which now only tracks
  // the actual network extraction call, gated behind PhotoExtractor).
  const [capturing, setCapturing] = useState(false);
  const [draft, setDraft] = useState<StickerDraft | null>(null);
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
  // The photo currently staged for box/lasso extraction — set by either a
  // live capture or a gallery import, and kept alive past a *successful*
  // extraction (not cleared until the resulting draft is finally Added or
  // Discarded) so "Retry Extraction" can reopen the same source photo.
  const [importedAsset, setImportedAsset] = useState<{ uri: string; width: number; height: number; assetId?: string } | null>(null);
  // Set only when importedAsset came from the live shutter (not the
  // gallery) — carries the "now"/GPS captured at the moment of the shutter
  // press, plus the true full, uncropped sensor frame for the memory photo
  // (separate from the 3:4-cropped image actually handed to PhotoExtractor),
  // so adjusting the box/lasso afterward (or retrying) never pushes the
  // discovery's timestamp later than when it actually happened.
  const [cameraCaptureContext, setCameraCaptureContext] = useState<{
    discoveredAt: string; rawUri: string; rawWidth: number; rawHeight: number;
  } | null>(null);
  // Whether PhotoExtractor is actually on screen — decoupled from
  // importedAsset itself, since the source photo now outlives a single
  // extraction attempt (see "Retry Extraction" in DiscoveryReveal).
  const [extractorVisible, setExtractorVisible] = useState(false);
  // While set, the ghost-cutout reveal is shown instead of DiscoveryReveal —
  // it crossfades from this cropped photo into the finished cutout, then
  // hands off. Only used for the photo-import/extraction flow.
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

  // Rectangular (3:4 portrait) camera viewport sized to the screen width
  // (with off-white margin), capped so it doesn't dominate on tablets and
  // scaled down to fit the available vertical space on shorter screens.
  const { width: winW, height: winH } = useWindowDimensions();
  const camWRaw = Math.min(winW - FRAME_MARGIN * 2, 400);
  const camHRaw = camWRaw / ASPECT_RATIO;
  const maxCamH = winH * 0.58;
  const camScale = camHRaw > maxCamH ? maxCamH / camHRaw : 1;
  const camW = camWRaw * camScale;
  const camH = camHRaw * camScale;

  // Pinch-to-zoom — savedZoom anchors the zoom level at the start of each pinch
  const savedZoom = useSharedValue(0);
  const currentZoom = useSharedValue(0);

  const pinchGesture = useMemo(() => Gesture.Pinch()
    .onStart(() => {
      savedZoom.value = currentZoom.value;
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

  const handleFocusTap = useCallback((x: number, y: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
  const submitImageForSticker = useCallback(async (base64: string, memoryBase64: string | null | undefined, discoveredAt: string, lassoPolygon?: Point[]) => {
    if (!user) throw new Error('Not signed in');

    const { data, error } = await supabase.functions.invoke('create-sticker', {
      body: {
        image: `data:image/jpeg;base64,${base64}`,
        userId: user.id,
        language,
        ...(memoryBase64 ? { memoryImage: `data:image/jpeg;base64,${memoryBase64}` } : {}),
        ...(lassoPolygon ? { lassoPolygon } : {}),
      },
    });

    if (error) {
      const status = (error as any).context?.status;
      const body = await (error as any).context?.json?.().catch(() => null);
      // 429 = the per-user daily quota is spent (see the create-sticker edge
      // function). Not a failure of the scan, so it gets its own alert title
      // rather than the alarming "Scan failed".
      if (status === 429) {
        const limitErr: any = new Error(body?.error ?? 'Daily limit reached. Try again tomorrow.');
        limitErr.isRateLimit = true;
        throw limitErr;
      }
      // No parseable JSON body means the response wasn't a normal app-level
      // error (those always return {error: "..."} — see create-sticker's
      // catch block) — it's the edge runtime itself getting cut off
      // mid-request (observed in the function logs as a "EarlyDrop"
      // shutdown while idle, waiting on the vision/background-removal
      // calls). The SDK's own message for that is the unhelpful generic
      // "Edge Function returned a non-2xx status code" — swap in something
      // the user can actually act on.
      throw new Error(body?.error ?? 'This took too long and was cut off. Please try again.');
    }
    if (data.error) throw new Error(data.error);
    console.log('[scan] edge fn debug:', data._debug_bgStatus);

    setDraft({
      language: data.language === 'ja' || data.language === 'yue' ? data.language : 'fr',
      word: String(data.word ?? ''),
      translation: String(data.translation ?? ''),
      reading: String(data.reading ?? ''),
      sentence: String(data.sentence ?? ''),
      sentenceTranslation: String(data.sentenceTranslation ?? ''),
      sentenceInsight: data.sentenceInsight ?? null,
      category: data.category ?? 'Other',
      imagePath: String(data.imagePath ?? ''),
      memoryPhotoPath: data.memoryPhotoPath ?? null,
      memoryPhotoColor: data.memoryPhotoColor ?? null,
      // Shown as an inline banner on DiscoveryReveal rather than an
      // Alert.alert fired here — this resolves before GhostCutoutReveal's
      // crossfade even starts, and a system dialog popping up mid-animation
      // would interrupt that choreographed reveal.
      bgIssue: data.bgIssue ?? null,
      discoveredAt,
      latitude: null,
      longitude: null,
      locationLabel: null,
    });
  }, [user, language]);

  // Resizes the full, uncropped photo down to a manageable size (long side
  // capped at 1280px, never upscaled) so it can be stored alongside the
  // sticker as the "memory photo" to flip to.
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

  // Captures a photo and stages it for box/lasso extraction — matching the
  // gallery-import flow instead of submitting straight to the server, so
  // live captures get the same chance to lasso-hint a hard subject that
  // imports already had. Fast/local only (take + pre-crop); the actual
  // network call happens later, from handleExtractFromPhoto, once the user
  // confirms a box/lasso.
  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || capturing || !user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCapturing(true);

    // This photo is "now, here" — capture both immediately, before the user
    // spends any time adjusting the box/lasso. GPS cold-fix can take several
    // seconds, so kick it off but don't await it yet.
    const discoveredAt = new Date().toISOString();
    locationPromiseRef.current = captureLocation();

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (!photo) throw new Error('Failed to capture photo');

      // Crop to the centered 3:4 rectangle shown inside the viewfinder, so
      // what was framed is what gets refined next — matching what the
      // rectangular preview center-crops ("cover") to show. This is only the
      // *starting point* for PhotoExtractor now, not the final upload, so no
      // resize/compress here (PhotoExtractor's own resize handles that after
      // the box/lasso is set, same as the import path).
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
      // becomes the "memory photo" to flip to — stashed here since
      // handleExtractFromPhoto runs later and photo.uri won't still be
      // reachable from there.
      setCameraCaptureContext({ discoveredAt, rawUri: photo.uri, rawWidth: photo.width, rawHeight: photo.height });
      setImportedAsset({ uri: cropped.uri, width: cropWidth, height: cropHeight });
      setExtractorVisible(true);
    } catch (err: any) {
      Alert.alert('Scan failed', err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setCapturing(false);
    }
  }, [capturing, user]);

  const handleToggleTorch = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTorchOn((prev) => !prev);
  }, []);

  const handleImportPhoto = useCallback(async () => {
    if (processing) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Photos Access Needed', 'LingoStickers needs access to your photo library to import a picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    const asset = !result.canceled ? result.assets[0] : null;
    if (asset) {
      metadataPromiseRef.current = null;
      setCameraCaptureContext(null);
      setImportedAsset({ uri: asset.uri, width: asset.width, height: asset.height, assetId: asset.assetId ?? undefined });
      setExtractorVisible(true);
    }
  }, [processing]);

  const handleExtractFromPhoto = useCallback(async ({ base64, uri, lassoPolygon }: { base64: string; uri: string; lassoPolygon?: Point[] }) => {
    if (processing || !importedAsset) return;
    setProcessing(true);

    // Camera-sourced: reuse the exact moment/place captured at shutter-press
    // (see cameraCaptureContext) — never "now", or fiddling with the
    // box/lasso (or retrying later) would keep pushing the discovery's
    // timestamp forward. Library-sourced: this is an OLD photo, so look up
    // its own creation date/GPS instead (fire-and-forget; falls back to
    // "now"/no-location if unavailable) — reused as-is on a retry rather
    // than re-fetched.
    const fallbackDiscoveredAt = cameraCaptureContext?.discoveredAt ?? new Date().toISOString();
    if (!cameraCaptureContext && !metadataPromiseRef.current) {
      metadataPromiseRef.current = getImportedPhotoMetadata(importedAsset.assetId);
    }

    try {
      // The full, uncropped frame becomes the "memory photo" to flip to —
      // the true raw sensor capture for a live photo, or the whole picked
      // photo (before extraction) for a library import.
      const memoryBase64 = cameraCaptureContext
        ? await prepareMemoryPhoto(cameraCaptureContext.rawUri, cameraCaptureContext.rawWidth, cameraCaptureContext.rawHeight)
        : await prepareMemoryPhoto(importedAsset.uri, importedAsset.width, importedAsset.height);

      await submitImageForSticker(base64, memoryBase64, fallbackDiscoveredAt, lassoPolygon);

      // A successful (re)extraction replaces whatever draft a "Retry
      // Extraction" was standing in for — clean up its now-orphaned storage
      // files rather than leaving them behind.
      const staleDraft = draftBeforeRetryRef.current;
      draftBeforeRetryRef.current = null;
      if (staleDraft) {
        const stalePaths = [staleDraft.imagePath, ...(staleDraft.memoryPhotoPath ? [staleDraft.memoryPhotoPath] : [])];
        supabase.storage.from('sticker-images').remove(stalePaths).then(({ error }) => {
          if (error) console.warn('Failed to clean up previous extraction attempt', error);
        });
      }

      setExtractorVisible(false);
      // Hold off on DiscoveryReveal — show the ghost-cutout crossfade first,
      // it hands off to DiscoveryReveal once the animation completes.
      setRevealCrop(uri);

      if (cameraCaptureContext) {
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
      const title = err?.isRateLimit
        ? 'Daily limit reached'
        : cameraCaptureContext ? 'Scan failed' : 'Extraction failed';
      Alert.alert(title, err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setProcessing(false);
    }
  }, [processing, importedAsset, cameraCaptureContext, submitImageForSticker, prepareMemoryPhoto]);

  const handleAdd = async () => {
    if (!draft || !user) return;
    setSaving(true);
    const { error } = await supabase.from('stickers').insert({
      user_id: user.id,
      language: draft.language,
      word: draft.word,
      translation: draft.translation,
      reading: draft.reading,
      sentence: draft.sentence,
      sentence_translation: draft.sentenceTranslation,
      sentence_insight: draft.sentenceInsight,
      category: draft.category,
      image_path: draft.imagePath,
      memory_photo_path: draft.memoryPhotoPath,
      memory_photo_color: draft.memoryPhotoColor,
      discovered_at: draft.discoveredAt,
      latitude: draft.latitude,
      longitude: draft.longitude,
      location_label: draft.locationLabel,
    });
    setSaving(false);
    if (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Save failed', error.message);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDraft(null);
    // Committed for good — the source photo retained for a possible "Retry
    // Extraction" is no longer needed.
    setImportedAsset(null);
    setCameraCaptureContext(null);
  };

  // Deletes the just-created sticker's storage files for good — gated
  // behind a confirm since there's no undo once this fires, and the result
  // being thrown away just took ~10-20s (and real API cost) to produce.
  const handleDiscard = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Discard this discovery?',
      "You'll lose the word and photo you just found — this can't be undone.",
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Discard', style: 'destructive',
          onPress: async () => {
            if (draft) {
              const paths = [draft.imagePath];
              if (draft.memoryPhotoPath) paths.push(draft.memoryPhotoPath);
              await supabase.storage.from('sticker-images').remove(paths);
            }
            setDraft(null);
            setImportedAsset(null);
            setCameraCaptureContext(null);
          },
        },
      ],
    );
  };

  // Reopens the box/lasso step on the exact same source photo instead of
  // discarding and starting over from scratch. draftBeforeRetryRef is the
  // safety net: if the user backs out of PhotoExtractor without finishing
  // the retry (see the PhotoExtractor onClose handler below), this draft is
  // restored rather than lost.
  const handleRetryExtraction = useCallback(() => {
    if (!draft || !importedAsset) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

      if (error) {
        const body = await (error as any).context?.json?.().catch(() => null);
        throw new Error(body?.error ?? error.message);
      }
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

      if (error) {
        const body = await (error as any).context?.json?.().catch(() => null);
        throw new Error(body?.error ?? error.message);
      }
      if (data.error) throw new Error(data.error);

      setDraft((prev) => prev ? {
        ...prev,
        sentence: String(data.sentence ?? prev.sentence),
        sentenceTranslation: newSentence,
        // translate-sentence spreads the LLM's raw JSON keys through
        // unchanged (unlike create-sticker, which remaps to camelCase) —
        // so this reads the snake_case key on purpose.
        sentenceInsight: data.sentence_insight ?? prev.sentenceInsight,
      } : prev);
    } finally {
      setRetranslatingSentence(false);
    }
  }, [language]);

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>Camera Access Needed</Text>
        <Text style={styles.permissionSubtitle}>
          LingoStickers needs your camera to identify objects and create stickers.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.prompt}>What did you find?</Text>
        <Text style={styles.promptSub}>Take a photo to learn!</Text>
      </View>

      <View style={styles.cameraArea}>
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

            {capturing && (
              <View style={styles.processingOverlay}>
                <ActivityIndicator size="large" color={colors.terra} />
              </View>
            )}
          </View>
        </GestureDetector>
      </View>

      <View style={styles.controls}>
        <Text style={styles.hint}>Pinch to zoom · Tap frame to focus</Text>
        <View style={styles.captureRow}>
          {/* Gallery */}
          <TouchableOpacity
            style={styles.sideBtn}
            onPress={handleImportPhoto}
            disabled={processing || capturing}
            activeOpacity={0.7}
          >
            <View style={[styles.sideBtnCircle, (processing || capturing) && styles.sideBtnCircleDisabled]}>
              <ImagePlus size={22} color={colors.inkMid} />
            </View>
            <Text style={styles.sideBtnLabel}>Gallery</Text>
          </TouchableOpacity>

          {/* Red shutter */}
          <TouchableOpacity
            style={[styles.captureButton, (processing || capturing) && styles.captureButtonDisabled]}
            onPress={handleCapture}
            disabled={processing || capturing}
          >
            <View style={styles.captureRing}>
              <View style={styles.captureCore} />
            </View>
          </TouchableOpacity>

          {/* Flash / torch toggle */}
          <TouchableOpacity
            style={styles.sideBtn}
            onPress={handleToggleTorch}
            activeOpacity={0.7}
          >
            <View style={[styles.sideBtnCircle, torchOn && styles.sideBtnCircleActive]}>
              {torchOn
                ? <Zap size={22} color={colors.sageDark} fill={colors.sageDark} />
                : <ZapOff size={22} color={colors.inkMid} />}
            </View>
            <Text style={[styles.sideBtnLabel, torchOn && styles.sideBtnLabelActive]}>
              {torchOn ? 'Flash On' : 'Flash Off'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <PhotoExtractor
        imageUri={extractorVisible ? (importedAsset?.uri ?? null) : null}
        imageWidth={importedAsset?.width ?? 0}
        imageHeight={importedAsset?.height ?? 0}
        onClose={() => {
          setExtractorVisible(false);
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
        processing={processing}
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
        onDiscard={handleDiscard}
        onRetryExtraction={handleRetryExtraction}
        onEditWord={handleEditWord}
        onEditSentence={handleEditSentence}
        saving={saving}
        retranslating={retranslating}
        retranslatingSentence={retranslatingSentence}
      />
    </SafeAreaView>
  );
}

const CORNER_SIZE = 30;
const CORNER_THICKNESS = 3;
const CORNER_INSET = 14;
const FRAME_RADIUS = 28;
const FRAME_MARGIN = 16;
// Viewfinder + capture-crop aspect ratio, expressed as width/height (3:4 portrait).
const ASPECT_RATIO = 3 / 4;
const RETICLE_SIZE = 72;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sky, paddingBottom: TAB_BAR_CLEARANCE },

  header: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  prompt: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.inkDark,
    letterSpacing: -0.3,
    fontStyle: 'italic',
  },
  promptSub: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.terra,
    marginTop: 2,
  },

  cameraArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cameraFrame: {
    borderRadius: FRAME_RADIUS,
    overflow: 'hidden',
    backgroundColor: colors.black,
    ...shadows.card,
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
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
  zoomPillText: { color: colors.white, fontSize: 12, fontWeight: '700' },

  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },

  controls: {
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  hint: { color: colors.inkLight, fontSize: 13, fontWeight: '500' },

  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxl,
  },
  sideBtn: {
    alignItems: 'center',
    gap: 6,
    width: 64,
  },
  sideBtnCircle: {
    width: 52,
    height: 52,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  sideBtnCircleActive: {
    backgroundColor: colors.sageLight,
  },
  sideBtnCircleDisabled: { opacity: 0.45 },
  sideBtnLabel: { fontSize: 11, fontWeight: '600', color: colors.inkLight },
  sideBtnLabelActive: { color: colors.sageDark },

  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.button,
  },
  captureButtonDisabled: { opacity: 0.45 },
  captureRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.error,
  },
  captureCore: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.error,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
  },

  permissionContainer: {
    flex: 1,
    backgroundColor: colors.sky,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: TAB_BAR_CLEARANCE,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.inkDark,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  permissionSubtitle: {
    fontSize: 14,
    color: colors.inkLight,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  permissionButton: {
    backgroundColor: colors.terra,
    borderRadius: radii.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    ...shadows.button,
  },
  permissionButtonText: { color: colors.card, fontSize: 16, fontWeight: '700' },
});
