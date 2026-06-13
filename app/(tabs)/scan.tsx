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
import { Camera as CameraIcon, ImagePlus, Zap } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/lib/supabase';
import { StickerDraft } from '@/lib/types';
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
  const [zoom, setZoom] = useState(0);
  const [importedAsset, setImportedAsset] = useState<{ uri: string; width: number; height: number } | null>(null);
  // While set, the ghost-cutout reveal is shown instead of DiscoveryReveal —
  // it crossfades from this cropped photo into the finished cutout, then
  // hands off. Only used for the photo-import/extraction flow.
  const [revealCrop, setRevealCrop] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

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
  const submitImageForSticker = useCallback(async (base64: string) => {
    if (!user) throw new Error('Not signed in');

    const { data, error } = await supabase.functions.invoke('create-sticker', {
      body: { image: `data:image/jpeg;base64,${base64}`, userId: user.id, language },
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
      category: data.category ?? 'Other',
      imagePath: String(data.imagePath ?? ''),
    });
  }, [user, language]);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || processing || !user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setProcessing(true);

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

      await submitImageForSticker(processed.base64);
    } catch (err: any) {
      Alert.alert('Scan failed', err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setProcessing(false);
    }
  }, [processing, user, submitImageForSticker]);

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
      setImportedAsset({ uri: asset.uri, width: asset.width, height: asset.height });
    }
  }, []);

  const handleExtractFromPhoto = useCallback(async ({ base64, uri }: { base64: string; uri: string }) => {
    if (processing) return;
    setProcessing(true);
    try {
      await submitImageForSticker(base64);
      setImportedAsset(null);
      // Hold off on DiscoveryReveal — show the ghost-cutout crossfade first,
      // it hands off to DiscoveryReveal once the animation completes.
      setRevealCrop(uri);
    } catch (err: any) {
      Alert.alert('Extraction failed', err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setProcessing(false);
    }
  }, [processing, submitImageForSticker]);

  const handleAdd = async () => {
    if (!draft || !user) return;
    setSaving(true);
    const { error } = await supabase.from('stickers').insert({
      user_id: user.id,
      language: draft.language,
      word: draft.word,
      translation: draft.translation,
      reading: draft.reading,
      category: draft.category,
      image_path: draft.imagePath,
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
    if (draft) await supabase.storage.from('sticker-images').remove([draft.imagePath]);
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
        <Text style={styles.title}>LingoStickers</Text>
        <Zap size={22} color="#1A1A2E" />
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
        <Text style={styles.hint}>Center the object in the frame</Text>
        <TouchableOpacity
          style={[styles.captureButton, processing && styles.captureButtonDisabled]}
          onPress={handleCapture}
          disabled={processing}
        >
          <View style={styles.captureButtonInner}>
            <CameraIcon size={32} color="#A7D7C5" />
          </View>
        </TouchableOpacity>
        <Text style={styles.subHint}>Pinch to zoom · Tap to capture</Text>

        <TouchableOpacity style={styles.importButton} onPress={handleImportPhoto}>
          <ImagePlus size={18} color="#1A1A2E" />
          <Text style={styles.importButtonText}>Or import from Photos</Text>
        </TouchableOpacity>
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
        saving={saving}
        retranslating={retranslating}
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
  // Off-white "frame" that surrounds the square camera viewport
  container: { flex: 1, backgroundColor: '#F5F0E8' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  title: { color: '#1A1A2E', fontSize: 20, fontWeight: '800' },

  // Centers the square viewport in the remaining space
  cameraArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cameraFrame: {
    borderRadius: FRAME_RADIUS,
    overflow: 'hidden',
    backgroundColor: '#000',
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },

  corner: { position: 'absolute', width: CORNER_SIZE, height: CORNER_SIZE, borderColor: 'rgba(255,255,255,0.95)' },
  cornerTL: { top: CORNER_INSET, left: CORNER_INSET, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderTopLeftRadius: 10 },
  cornerTR: { top: CORNER_INSET, right: CORNER_INSET, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderTopRightRadius: 10 },
  cornerBL: { bottom: CORNER_INSET, left: CORNER_INSET, borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderBottomLeftRadius: 10 },
  cornerBR: { bottom: CORNER_INSET, right: CORNER_INSET, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderBottomRightRadius: 10 },

  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  processingText: { color: '#A7D7C5', fontSize: 14, fontWeight: '700' },

  controls: { alignItems: 'center', paddingTop: 16, paddingBottom: 12, gap: 12 },
  hint: { color: '#1A1A2E', fontSize: 15, fontWeight: '700' },
  subHint: { color: '#9CA3AF', fontSize: 13, fontWeight: '500' },
  captureButton: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#1A1A2E', shadowOpacity: 0.2, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  captureButtonDisabled: { opacity: 0.5 },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  importButtonText: { color: '#1A1A2E', fontSize: 14, fontWeight: '600' },
  captureButtonInner: {
    width: 68, height: 68, borderRadius: 34,
    borderWidth: 3, borderColor: '#A7D7C5',
    alignItems: 'center', justifyContent: 'center',
  },
  permissionContainer: {
    flex: 1, backgroundColor: '#F5F0E8',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32,
  },
  permissionTitle: { fontSize: 22, fontWeight: '800', color: '#1A1A2E', marginBottom: 12, textAlign: 'center' },
  permissionSubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  permissionButton: { backgroundColor: '#A7D7C5', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32 },
  permissionButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
