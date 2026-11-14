import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { Easing, useReducedMotion } from 'react-native-reanimated';

// The only place durations, easing and springs are defined (B-app 11, C-look).
// Reduced Motion: movement 0, opacity-only 120 ms fades, springs become fades;
// pulses, parallax and wobble stop. Screens should take these from useMotion()
// rather than hard-coding numbers or importing withSpring/withTiming constants.
export const dur = { instant: 0, fast: 120, base: 200, slow: 320 } as const;
export const press = { scale: 0.98, in: 80 } as const;
export const flipMs = 220;
export const crossfadeMs = 150;
/**
 * Calendar sticker arrival (owner Nov 14: "a champion has arrived", then
 * "slower and calmer"): each sticker grows in from 70%, turns a full 360 deg
 * about Y while rising a few pt, and settles with a soft squash (anchored at
 * its base) that eases back without wobbling. The month fills as a diagonal
 * wave from the top-left: each cell waits `col` column steps plus `row` row
 * steps (a row waits 4 columns). One sticker takes ~1.1 s; a 5-row month
 * settles in ~2.9 s. The grid is usable throughout. Reduce Motion: a 120 ms
 * fade, nothing else.
 */
export const calendarFlip = {
  col: 80, row: 320, perspective: 600,
  fadeMs: 220, riseMs: 380, airMs: 820, fromScale: 0.7,
  hop: 7, squashMs: 110, squashX: 1.05, squashY: 0.95,
} as const;
export const calendarArriveEase = {
  pop: Easing.out(Easing.back(1.1)),
  spin: Easing.inOut(Easing.sin),
  up: Easing.out(Easing.sin),
  down: Easing.inOut(Easing.sin),
};
/** Landing: critically damped, so the squash eases back once with no wobble. */
export const calendarLandSpring = { damping: 20, stiffness: 180, mass: 0.8 } as const;
/** Wave delay for a month cell; the 1st of the month starts at once. */
export const calendarFlipDelay = (row: number, col: number, firstCol: number) =>
  Math.max(0, row * calendarFlip.row + (col - firstCol) * calendarFlip.col);
// Reanimated's Easing (a worklet), not React Native's: withTiming on the UI thread rejects the latter.
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
