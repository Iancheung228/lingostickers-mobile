import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, View, Text, StyleSheet, SafeAreaView, Pressable } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withDelay, withTiming, runOnJS, Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/constants/theme';

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
// The flourish is decoration over work that has already succeeded — the
// cutout is in storage before this screen is mounted. So it is given a
// deadline: if the signed URL hasn't arrived by now, the animation is
// abandoned and the flow continues to DiscoveryReveal, which fetches the
// image itself anyway. Without this, a URL that never resolves left the user
// on "Cutting it out…" with no button, no gesture and no way back.
const URL_DEADLINE_MS = 6000;

// "Ghost-cutout reveal": the cropped photo dissolves and drifts outward like
// a ghost stepping out of its shell, while the finished cutout crossfades in
// underneath — then hands off to DiscoveryReveal.
export default function GhostCutoutReveal({ croppedUri, imagePath, onComplete }: GhostCutoutRevealProps) {
  const [cutoutUrl, setCutoutUrl] = useState<string | null>(null);
  const progress = useSharedValue(0);

  // Three things can finish this screen — the animation ending, the deadline
  // expiring, and a tap — and they can race. Handing off twice would push
  // DiscoveryReveal on twice.
  const handedOff = useRef(false);
  const finish = useCallback(() => {
    if (handedOff.current) return;
    handedOff.current = true;
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    let cancelled = false;
    supabase.storage.from('sticker-images').createSignedUrl(imagePath, 3600).then(({ data }) => {
      if (!cancelled && data) setCutoutUrl(data.signedUrl);
    });
    return () => { cancelled = true; };
  }, [imagePath]);

  useEffect(() => {
    const timer = setTimeout(finish, URL_DEADLINE_MS);
    return () => clearTimeout(timer);
  }, [finish]);

  useEffect(() => {
    if (!cutoutUrl) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    progress.value = withDelay(
      HOLD_MS,
      withTiming(1, { duration: FADE_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(finish)();
      }),
    );
  }, [cutoutUrl, finish]);

  const ghostStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ scale: 1 + progress.value * GHOST_SCALE_DELTA }],
  }));
  const cutoutStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  // Back skips the flourish rather than doing nothing: this screen is a
  // transition that hands off to DiscoveryReveal when it finishes, so
  // completing early is the honest response to "get on with it".
  return (
    <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={finish}>
      {/* Tapping skips ahead. A waiting screen with nothing to press is the
          one place where "get on with it" has nowhere to go — and this one is
          only ever showing a flourish over work that is already done. */}
      <Pressable
        style={styles.container}
        onPress={finish}
        accessibilityRole="button"
        accessibilityLabel="Skip the animation"
      >
      <SafeAreaView style={styles.container}>
        <View style={styles.stage}>
          <Animated.Image source={{ uri: croppedUri }} style={[styles.image, ghostStyle]} resizeMode="contain" />
          {cutoutUrl && (
            <Animated.Image source={{ uri: cutoutUrl }} style={[styles.image, styles.overlay, cutoutStyle]} resizeMode="contain" />
          )}
        </View>
        <Text style={styles.label}>{cutoutUrl ? 'Lifting your sticker free…' : 'Cutting it out…'}</Text>
      </SafeAreaView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sky, alignItems: 'center', justifyContent: 'center' },
  stage: { width: 280, height: 280, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  overlay: { position: 'absolute' },
  label: { marginTop: 28, color: colors.inkMid, fontSize: 14, fontFamily: fonts.display,},
});
