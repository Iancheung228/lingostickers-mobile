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
import { useSharedValue, runOnJS } from 'react-native-reanimated';
import { ImagePlus, Zap } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/hooks/useAuth';
import { colors, shadows, radii, spacing } from '@/constants/theme';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/lib/supabase';
import { StickerDraft } from '@/lib/types';
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
  const [draft, setDraft] = useState<StickerDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [retranslating, setRetranslating] = useState(false);
  const [retranslatingSentence, setRetranslatingSentence] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [importedAsset, setImportedAsset] = useState<{ uri: string; width: number; height: number; assetId?: string } | null>(null);
  // While set, the ghost-cutout reveal is shown instead of DiscoveryReveal —
  // it crossfades from this cropped photo into the finished cutout, then
  // hands off. Only used for the photo-import/extraction flow.
  const [revealCrop, setRevealCrop] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  // Fire-and-forget when/where lookups kicked off at the start of each
  // capture/import — awaited only after submitImageForSticker resolves, so
  // they never delay DiscoveryReveal.
  const locationPromiseRef = useRef<Promise<CapturedLocation | null> | null>(null);
  const metadataPromiseRef = useRef<ReturnType<typeof getImportedPhotoMetadata> | null>(null);

  // Square camera viewport sized to the screen width (with off-white margin),
  // capped so it doesn't dominate on tablets.
  const { width: winW } = useWindowDimensions();
  const camSize = Math.min(winW - FRAME_MARGIN * 2, 440);

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

  // Sends a processed JPEG to the create-sticker edge function and stores the
  // result as a draft for DiscoveryReveal. Shared by both the live-capture and
  // photo-import flows — throws on failure so each caller can report it in its
  // own voice ("Scan failed" vs "Extraction failed").
  const submitImageForSticker = useCallback(async (base64: string, memoryBase64: string | null | undefined, discoveredAt: string) => {
    if (!user) throw new Error('Not signed in');

    const { data, error } = await supabase.functions.invoke('create-sticker', {
      body: {
        image: `data:image/jpeg;base64,${base64}`,
        userId: user.id,
        language,
        ...(memoryBase64 ? { memoryImage: `data:image/jpeg;base64,${memoryBase64}` } : {}),
      },
    });

    if (error) {
      const body = await (error as any).context?.json?.().catch(() => null);
      throw new Error(body?.error ?? error.message);
    }
    if (data.error) throw new Error(data.error);
    console.log('[scan] edge fn debug:', data._debug_bgStatus);

    if (data.bgIssue) {
      Alert.alert('Heads up', data.bgIssue.message);
    }

    setDraft({
      language: data.language === 'ja' ? 'ja' : 'fr',
      word: String(data.word ?? ''),
      translation: String(data.translation ?? ''),
      reading: String(data.reading ?? ''),
      sentence: String(data.sentence ?? ''),
      sentenceTranslation: String(data.sentenceTranslation ?? ''),
      category: data.category ?? 'Other',
      imagePath: String(data.imagePath ?? ''),
      memoryPhotoPath: data.memoryPhotoPath ?? null,
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

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || processing || !user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setProcessing(true);

    // This photo is "now, here" — capture both immediately. GPS cold-fix can
    // take several seconds, so kick it off but don't await it yet.
    const discoveredAt = new Date().toISOString();
    locationPromiseRef.current = captureLocation();

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!photo) throw new Error('Failed to capture photo');

      // Crop to the centered square shown inside the viewfinder so only the
      // framed object is recognized. The square preview center-crops ("cover")
      // the sensor image, so the visible region is a centered square of side
      // min(width,height) in the captured photo. Crop to that, then downscale.
      const side = Math.min(photo.width, photo.height);
      const originX = Math.round((photo.width - side) / 2);
      const originY = Math.round((photo.height - side) / 2);

      const rendered = await ImageManipulator.manipulate(photo.uri)
        .crop({ originX, originY, width: side, height: side })
        .resize({ width: 800 })
        .renderAsync();
      const processed = await rendered.saveAsync({
        compress: 0.8,
        format: SaveFormat.JPEG,
        base64: true,
      });

      if (!processed.base64) throw new Error('Failed to process image');

      // The full, uncropped frame becomes the "memory photo" to flip to.
      const memoryBase64 = await prepareMemoryPhoto(photo.uri, photo.width, photo.height);

      await submitImageForSticker(processed.base64, memoryBase64, discoveredAt);

      const location = await locationPromiseRef.current;
      if (location) {
        setDraft((prev) => prev ? {
          ...prev,
          latitude: location.latitude,
          longitude: location.longitude,
          locationLabel: location.locationLabel,
        } : prev);
      }
    } catch (err: any) {
      Alert.alert('Scan failed', err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setProcessing(false);
    }
  }, [processing, user, submitImageForSticker, prepareMemoryPhoto]);

  const handleImportPhoto = useCallback(async () => {
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
      setImportedAsset({ uri: asset.uri, width: asset.width, height: asset.height, assetId: asset.assetId ?? undefined });
    }
  }, []);

  const handleExtractFromPhoto = useCallback(async ({ base64, uri }: { base64: string; uri: string }) => {
    if (processing || !importedAsset) return;
    setProcessing(true);

    // This is an OLD photo — the memory happened whenever/wherever it was
    // actually taken, not "now"/"here". Look up its own creation date/GPS
    // (fire-and-forget; falls back to "now"/no-location if unavailable).
    const fallbackDiscoveredAt = new Date().toISOString();
    metadataPromiseRef.current = getImportedPhotoMetadata(importedAsset.assetId);

    try {
      // The full imported photo (before extraction) becomes the "memory
      // photo" to flip to.
      const memoryBase64 = await prepareMemoryPhoto(importedAsset.uri, importedAsset.width, importedAsset.height);

      await submitImageForSticker(base64, memoryBase64, fallbackDiscoveredAt);
      setImportedAsset(null);
      // Hold off on DiscoveryReveal — show the ghost-cutout crossfade first,
      // it hands off to DiscoveryReveal once the animation completes.
      setRevealCrop(uri);

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
      Alert.alert('Extraction failed', err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setProcessing(false);
    }
  }, [processing, importedAsset, submitImageForSticker, prepareMemoryPhoto]);

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
      category: draft.category,
      image_path: draft.imagePath,
      memory_photo_path: draft.memoryPhotoPath,
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
  };

  const handleDiscard = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (draft) {
      const paths = [draft.imagePath];
      if (draft.memoryPhotoPath) paths.push(draft.memoryPhotoPath);
      await supabase.storage.from('sticker-images').remove(paths);
    }
    setDraft(null);
  };

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
        <GestureDetector gesture={pinchGesture}>
          <View style={[styles.cameraFrame, { width: camSize, height: camSize }]}>
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" zoom={zoom} />

            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />

            {processing && (
              <View style={styles.processingOverlay}>
                <ActivityIndicator size="large" color="#A7D7C5" />
                <Text style={styles.processingText}>Creating sticker...</Text>
              </View>
            )}
          </View>
        </GestureDetector>
      </View>

      <View style={styles.controls}>
        <Text style={styles.hint}>Pinch to zoom · Tap to capture</Text>
        <View style={styles.captureRow}>
          {/* Gallery */}
          <TouchableOpacity style={styles.sideBtn} onPress={handleImportPhoto}>
            <ImagePlus size={22} color={colors.inkMid} />
            <Text style={styles.sideBtnLabel}>Gallery</Text>
          </TouchableOpacity>

          {/* Red shutter */}
          <TouchableOpacity
            style={[styles.captureButton, processing && styles.captureButtonDisabled]}
            onPress={handleCapture}
            disabled={processing}
          >
            <View style={styles.captureRing}>
              <View style={styles.captureCore} />
            </View>
          </TouchableOpacity>

          {/* Flash placeholder (no-op — kept for layout symmetry) */}
          <View style={styles.sideBtn}>
            <Zap size={22} color={colors.inkMid} />
            <Text style={styles.sideBtnLabel}>Flash</Text>
          </View>
        </View>
      </View>

      <PhotoExtractor
        imageUri={importedAsset?.uri ?? null}
        imageWidth={importedAsset?.width ?? 0}
        imageHeight={importedAsset?.height ?? 0}
        onClose={() => setImportedAsset(null)}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sky },

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
    backgroundColor: '#000',
    ...shadows.card,
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },

  corner: { position: 'absolute', width: CORNER_SIZE, height: CORNER_SIZE, borderColor: 'rgba(255,255,255,0.95)' },
  cornerTL: { top: CORNER_INSET, left: CORNER_INSET, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderTopLeftRadius: 10 },
  cornerTR: { top: CORNER_INSET, right: CORNER_INSET, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderTopRightRadius: 10 },
  cornerBL: { bottom: CORNER_INSET, left: CORNER_INSET, borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderBottomLeftRadius: 10 },
  cornerBR: { bottom: CORNER_INSET, right: CORNER_INSET, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderBottomRightRadius: 10 },

  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  processingText: { color: colors.skyDeep, fontSize: 14, fontWeight: '700' },

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
    gap: 4,
    width: 56,
  },
  sideBtnLabel: { fontSize: 11, fontWeight: '600', color: colors.inkLight },

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
