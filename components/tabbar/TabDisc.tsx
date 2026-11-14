import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  interpolateColor, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import { TAB } from '@/constants/tabBar';
import { dur } from '@/lib/motion';
import { CameraGlyph } from './TabIcon';

const OUT_SPRING = { damping: 14, stiffness: 400 } as const;
const RING = 1.5;

/**
 * The Scan disc. Idle: terra with a white camera and a thin cream ring.
 * Active (on the Scan screen): inverted to cream with a terra camera, so it
 * doesn't read as a second shutter. Pressed: darker and scaled to 0.94.
 * Drawn only; the parent Pressable owns the touch and passes `pressed`.
 */
export default function TabDisc({ active, pressed, reduced }: { active: boolean; pressed: boolean; reduced: boolean }) {
  const act = useSharedValue(active ? 1 : 0);
  const down = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    act.value = withTiming(active ? 1 : 0, { duration: dur.fast });
  }, [active, act]);

  useEffect(() => {
    down.value = pressed ? 1 : 0;
    if (reduced) { scale.value = 1; return; }
    scale.value = pressed ? withTiming(0.94, { duration: 80 }) : withSpring(1, OUT_SPRING);
  }, [pressed, reduced, down, scale]);

  const outer = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: reduced && down.value ? 0.85 : 1,
    shadowOffset: { width: 0, height: down.value ? 1 : TAB.shadowDisc.dy },
  }));
  const ring = useAnimatedStyle(() => ({
    borderColor: down.value || act.value > 0.5 ? 'transparent' : TAB.discRing,
  }));
  const face = useAnimatedStyle(() => ({
    backgroundColor: down.value && act.value < 0.5
      ? TAB.discPressed
      : interpolateColor(act.value, [0, 1], [TAB.disc, TAB.discActive]),
    borderColor: interpolateColor(act.value, [0, 1], [TAB.discStroke, TAB.disc]),
    borderWidth: act.value > 0.5 ? 2 : 1,
  }));
  const white = useAnimatedStyle(() => ({ opacity: 1 - act.value }));
  const terra = useAnimatedStyle(() => ({ opacity: act.value }));

  return (
    <Animated.View style={[styles.outer, outer]} pointerEvents="none">
      <Animated.View style={[styles.ring, ring]}>
        <Animated.View style={[styles.face, face]}>
          <Animated.View style={[styles.glyph, white]}><CameraGlyph color="#FFFFFF" /></Animated.View>
          <Animated.View style={[styles.glyph, terra]}><CameraGlyph color={TAB.disc} /></Animated.View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const S = TAB.discSize;
const styles = StyleSheet.create({
  outer: {
    width: S + RING * 2,
    height: S + RING * 2,
    borderRadius: S,
    shadowColor: TAB.shadowDisc.color,
    shadowOpacity: TAB.shadowDisc.opacity,
    shadowRadius: TAB.shadowDisc.radius,
  },
  ring: { flex: 1, borderRadius: S, borderWidth: RING, alignItems: 'center', justifyContent: 'center' },
  face: { width: S, height: S, borderRadius: S / 2, alignItems: 'center', justifyContent: 'center' },
  glyph: { position: 'absolute' },
});

// Exported for layout: the disc's drawn size including its ring.
export const DISC_OUTER = S + RING * 2;
