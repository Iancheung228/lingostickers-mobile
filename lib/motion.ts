import { useEffect, useState } from 'react';
import { AccessibilityInfo, Easing } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

// The only place durations, easing and springs are defined (B-app 11, C-look).
// Reduced Motion: movement 0, opacity-only 120 ms fades, springs become fades;
// pulses, parallax and wobble stop. Screens should take these from useMotion()
// rather than hard-coding numbers or importing withSpring/withTiming constants.
export const dur = { instant: 0, fast: 120, base: 200, slow: 320 } as const;
export const press = { scale: 0.98, in: 80 } as const;
export const flipMs = 220;
export const crossfadeMs = 150;
export const ease = Easing.out(Easing.cubic);
export const spring = { damping: 18, stiffness: 220 } as const;
/** Release spring after a press. */
export const pressSpring = { damping: 18, stiffness: 400 } as const;

/** OS Reduce Motion for plain `Animated`/state code (reanimated has its own hook). */
export function useReduceMotionSetting(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (mounted) setReduced(v); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { mounted = false; sub.remove(); };
  }, []);
  return reduced;
}

export interface Motion {
  reduced: boolean;
  /** A duration: 0 for movement when reduced, else n. Use `fade()` for opacity. */
  ms: (n: number) => number;
  /** Opacity-only duration: capped at 120 ms when reduced. */
  fade: (n?: number) => number;
  /** Spring config, or null when reduced (animate opacity instead). */
  spring: typeof spring | null;
  /** Scale to animate a press to; 1 when reduced. */
  pressScale: number;
}

export function useMotion(): Motion {
  const rm = useReducedMotion();
  const setting = useReduceMotionSetting();
  const reduced = rm || setting;
  return {
    reduced,
    ms: (n) => (reduced ? 0 : n),
    fade: (n = dur.base) => (reduced ? Math.min(n, dur.fast) : n),
    spring: reduced ? null : spring,
    pressScale: reduced ? 1 : press.scale,
  };
}
