import { ReactNode, useEffect } from 'react';
import Animated, {
  cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { calendarArriveEase as E, calendarFlip as A, calendarLandSpring, dur } from '@/lib/motion';

// The month-grid arrival: grow in, turn 360 deg about Y while rising a little,
// settle with a soft squash anchored at the sticker's base (constants and
// timeline in lib/motion.ts). Plays once, on mount, entirely on
// the UI thread; the parent re-keys it per month cascade, so a month change
// cancels a half-played arrival by unmounting it (nothing left mid-spin).
// Reduce Motion: no movement, a 120 ms opacity fade with no stagger.
export default function FlipSticker({
  delayMs, reduced, size, children,
}: { delayMs: number; reduced: boolean; size: number; children: ReactNode }) {
  const opacity = useSharedValue(0);
  const pop = useSharedValue(reduced ? 1 : A.fromScale);
  const spin = useSharedValue(0);
  const y = useSharedValue(0);
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      opacity.value = withTiming(1, { duration: dur.fast });
      return () => cancelAnimation(opacity);
    }
    const d = delayMs;
    opacity.value = withDelay(d, withTiming(1, { duration: A.fadeMs }));
    pop.value = withDelay(d, withTiming(1, { duration: A.riseMs, easing: E.pop }));
    spin.value = withDelay(d, withTiming(360, { duration: A.airMs, easing: E.spin }));
    y.value = withDelay(d, withSequence(
      withTiming(-A.hop, { duration: A.riseMs, easing: E.up }),
      withTiming(0, { duration: A.airMs - A.riseMs, easing: E.down }),
    ));
    const land = d + A.airMs;
    sx.value = withDelay(land, withSequence(withTiming(A.squashX, { duration: A.squashMs }), withSpring(1, calendarLandSpring)));
    sy.value = withDelay(land, withSequence(withTiming(A.squashY, { duration: A.squashMs }), withSpring(1, calendarLandSpring)));
    return () => [opacity, pop, spin, y, sx, sy].forEach(v => cancelAnimation(v));
    // Mount-only: later prop changes must not replay the arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => {
    if (reduced) return { opacity: opacity.value };
    // Squash about the base: scaling about the centre would lift the bottom
    // edge off the ground, so shift down by half the height lost.
    const base = (1 - sy.value) * size * 0.5;
    return {
      opacity: opacity.value,
      transform: [
        { perspective: A.perspective },
        { translateY: y.value + base },
        { rotateY: `${spin.value}deg` },
        { scaleX: pop.value * sx.value },
        { scaleY: pop.value * sy.value },
      ],
    };
  });

  return <Animated.View style={style}>{children}</Animated.View>;
}
