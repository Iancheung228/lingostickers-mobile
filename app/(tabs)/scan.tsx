import { useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, SafeAreaView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useSharedValue, runOnJS } from 'react-native-reanimated';
import { Camera as CameraIcon, Zap } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { StickerDraft } from '@/lib/types';
import DiscoveryReveal from '@/components/DiscoveryReveal';

export default function ScanScreen() {
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [processing, setProcessing] = useState(false);
  const [draft, setDraft] = useState<StickerDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState(0);
  const cameraRef = useRef<CameraView>(null);

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

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || processing || !user) return;
    setProcessing(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!photo) throw new Error('Failed to capture photo');

      const resized = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 800 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      if (!resized.base64) throw new Error('Failed to process image');

      const { data, error } = await supabase.functions.invoke('create-sticker', {
        body: { image: `data:image/jpeg;base64,${resized.base64}`, userId: user.id },
      });

      if (error) {
        const body = await (error as any).context?.json?.().catch(() => null);
        throw new Error(body?.error ?? error.message);
      }
      if (data.error) throw new Error(data.error);
      console.log('[scan] edge fn debug:', data._debug_bgStatus);

      setDraft({
        name: String(data.name ?? ''),
        translation: String(data.translation ?? ''),
        pronunciation: String(data.pronunciation ?? ''),
        category: data.category ?? 'Other',
        imagePath: String(data.imagePath ?? ''),
      });
    } catch (err: any) {
      Alert.alert('Scan failed', err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setProcessing(false);
    }
  }, [processing, user]);

  const handleAdd = async () => {
    if (!draft || !user) return;
    setSaving(true);
    const { error } = await supabase.from('stickers').insert({
      user_id: user.id,
      name: draft.name,
      translation: draft.translation,
      pronunciation: draft.pronunciation,
      category: draft.category,
      image_path: draft.imagePath,
    });
    setSaving(false);
    if (error) { Alert.alert('Save failed', error.message); return; }
    setDraft(null);
  };

  const handleDiscard = async () => {
    if (draft) await supabase.storage.from('sticker-images').remove([draft.imagePath]);
    setDraft(null);
  };

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
    <View style={styles.container}>
      <GestureDetector gesture={pinchGesture}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" zoom={zoom}>
          <SafeAreaView style={styles.overlay}>
            <View style={styles.topBar}>
              <Text style={styles.topBarTitle}>LingoStickers</Text>
              <Zap size={22} color="#fff" />
            </View>

            <View style={styles.viewfinderGuide}>
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

            <View style={styles.bottomBar}>
              <Text style={styles.hint}>Pinch to zoom · Tap to capture</Text>
              <TouchableOpacity
                style={[styles.captureButton, processing && styles.captureButtonDisabled]}
                onPress={handleCapture}
                disabled={processing}
              >
                <View style={styles.captureButtonInner}>
                  <CameraIcon size={36} color="#A7D7C5" />
                </View>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </CameraView>
      </GestureDetector>

      <DiscoveryReveal
        draft={draft}
        onAdd={handleAdd}
        onDiscard={handleDiscard}
        saving={saving}
      />
    </View>
  );
}

const CORNER_SIZE = 28;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'space-between' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  topBarTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  viewfinderGuide: {
    alignSelf: 'center',
    width: 240,
    height: 240,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: { position: 'absolute', width: CORNER_SIZE, height: CORNER_SIZE, borderColor: 'rgba(167,215,197,0.8)' },
  cornerTL: { top: 0, left: 0, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderBottomRightRadius: 8 },
  processingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  processingText: { color: '#A7D7C5', fontSize: 14, fontWeight: '700' },
  bottomBar: { alignItems: 'center', paddingBottom: 24, gap: 16 },
  hint: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '500' },
  captureButton: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  captureButtonDisabled: { opacity: 0.5 },
  captureButtonInner: {
    width: 68, height: 68, borderRadius: 34,
    borderWidth: 3, borderColor: '#F5F0E8',
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
