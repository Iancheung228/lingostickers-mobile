import { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, SafeAreaView } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withDelay, withTiming, runOnJS, Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';

interface GhostCutoutRevealProps {
  // The rectangular crop that was sent off for extraction — shown first so
  // the transition reads as "this photo becomes that sticker."
  croppedUri: string;
  // Storage path of the finished cutout — resolved to a signed URL once the
  // crossfade is ready to start.
  imagePath: string;
  onComplete: () => void;
}

const HOLD_MS = 350;
const FADE_MS = 650;
const GHOST_SCALE_DELTA = 0.08;

// "Ghost-cutout reveal": the cropped photo dissolves and drifts outward like
// a ghost stepping out of its shell, while the finished cutout crossfades in
// underneath — then hands off to DiscoveryReveal.
export default function GhostCutoutReveal({ croppedUri, imagePath, onComplete }: GhostCutoutRevealProps) {
  const [cutoutUrl, setCutoutUrl] = useState<string | null>(null);
  const progress = useSharedValue(0);

  useEffect(() => {
    let cancelled = false;
    supabase.storage.from('sticker-images').createSignedUrl(imagePath, 3600).then(({ data }) => {
      if (!cancelled && data) setCutoutUrl(data.signedUrl);
    });
    return () => { cancelled = true; };
  }, [imagePath]);

  useEffect(() => {
    if (!cutoutUrl) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    progress.value = withDelay(
      HOLD_MS,
      withTiming(1, { duration: FADE_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(onComplete)();
      }),
    );
  }, [cutoutUrl]);

  const ghostStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ scale: 1 + progress.value * GHOST_SCALE_DELTA }],
  }));
  const cutoutStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  return (
    <Modal visible animationType="fade" presentationStyle="fullScreen">
      <SafeAreaView style={styles.container}>
        <View style={styles.stage}>
          <Animated.Image source={{ uri: croppedUri }} style={[styles.image, ghostStyle]} resizeMode="contain" />
          {cutoutUrl && (
            <Animated.Image source={{ uri: cutoutUrl }} style={[styles.image, styles.overlay, cutoutStyle]} resizeMode="contain" />
          )}
        </View>
        <Text style={styles.label}>{cutoutUrl ? 'Lifting your sticker free…' : 'Cutting it out…'}</Text>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F0E8', alignItems: 'center', justifyContent: 'center' },
  stage: { width: 280, height: 280, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  overlay: { position: 'absolute' },
  label: { marginTop: 28, color: '#6B7280', fontSize: 14, fontWeight: '600' },
});
