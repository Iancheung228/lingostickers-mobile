import { useCallback, useMemo, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS, useAnimatedProps, useAnimatedStyle, useSharedValue,
  withDelay, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Check, Scissors } from 'lucide-react-native';
import { Point, Rect, clampPointToRect } from '@/lib/cropGeometry';
import { colors, shadows } from '@/constants/theme';

interface LassoOverlayProps {
  // The image's own display rect (container-local coords) — points are
  // clamped to this so a fat-finger drag past the photo's edge sticks to
  // the border instead of drifting into the letterboxed margin around it.
  bounds: Rect;
  // Called once the user lifts their finger, with the drawn loop's points
  // (in container-local coordinates). Empty/too-short loops are filtered out.
  onComplete: (points: Point[]) => void;
}

const MIN_POINT_DISTANCE = 4;
const MIN_LOOP_POINTS = 6;
const BADGE_SIZE = 30;
const SCISSORS_SIZE = 22;

// How many points back to look when working out which way the cut is heading.
// Consecutive points are only MIN_POINT_DISTANCE apart, so the angle between
// any two neighbours is mostly finger jitter; a few points of lookback gives a
// heading that turns with the stroke instead of twitching along it.
const HEADING_LOOKBACK = 4;

// Lucide's scissors sit with their blades toward the upper right, so this much
// is subtracted to bring them level before the stroke's own heading is applied.
const SCISSORS_REST_ANGLE = -45;

// Direction of travel at the tip, in degrees, or null while there is too
// little of a stroke to have one.
function headingAt(points: Point[]): number | null {
  if (points.length < 2) return null;
  const tip = points[points.length - 1];
  const behind = points[Math.max(0, points.length - 1 - HEADING_LOOKBACK)];
  const dx = tip.x - behind.x;
  const dy = tip.y - behind.y;
  if (Math.hypot(dx, dy) < 0.5) return null;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

// `closed` draws an explicit closing segment back to the start point once
// the loop is done, so the outline itself reads as a sealed shape — while
// drawing, the raw open path (SVG fills it implicitly, but the stroke
// shouldn't pretend to be closed until it actually is).
function pointsToPathD(points: Point[], closed: boolean): string {
  if (points.length === 0) return '';
  const d = points.reduce((acc, p, i) => acc + (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`), '');
  return closed ? `${d} Z` : d;
}

function centroidOf(points: Point[]): Point {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

export default function LassoOverlay({ bounds, onComplete }: LassoOverlayProps) {
  const [points, setPoints] = useState<Point[]>([]);
  const [settled, setSettled] = useState(false);
  const [badgeCenter, setBadgeCenter] = useState<Point | null>(null);
  const lastPoint = useSharedValue<Point | null>(null);
  // Mirrors `points` so `finish` can read the final loop synchronously,
  // without calling back into the parent from inside a setState updater
  // (React flags that as "update during render of a different component").
  const pointsRef = useRef<Point[]>([]);
  // Drives the "locked in" pulse on the loop itself (stroke/fill) and the
  // checkmark badge that follows it — see finish() below.
  const settle = useSharedValue(0);
  const badgeScale = useSharedValue(0);

  const resetPath = useCallback((p: Point) => {
    pointsRef.current = [p];
    setPoints(pointsRef.current);
    setSettled(false);
    setBadgeCenter(null);
    settle.value = 0;
    badgeScale.value = 0;
  }, []);
  const appendPoint = useCallback((p: Point) => {
    pointsRef.current = [...pointsRef.current, p];
    setPoints(pointsRef.current);
  }, []);

  // Lifting the finger doesn't just freeze the drawing in place — it settles
  // into the exact shape that'll be sent to the server (see PhotoExtractor's
  // reprojection), with a quick confirming pulse plus a checkmark badge, so
  // the moment reads as "this loop is locked in," not just "the line stopped
  // moving." The actual send still waits on the user tapping Extract below —
  // this is the visual accept, not the send itself.
  const finish = useCallback(() => {
    const current = pointsRef.current;
    if (current.length < MIN_LOOP_POINTS) return;
    setSettled(true);
    setBadgeCenter(centroidOf(current));
    settle.value = withSequence(
      withTiming(1, { duration: 120 }),
      withSpring(0.82, { damping: 8, stiffness: 200 }),
      withSpring(1, { damping: 14, stiffness: 180 }),
    );
    badgeScale.value = withDelay(90, withSpring(1, { damping: 11, stiffness: 200 }));
    onComplete(current);
  }, [onComplete]);

  const pan = useMemo(() => Gesture.Pan()
    .onStart((e) => {
      const start = clampPointToRect({ x: e.x, y: e.y }, bounds);
      lastPoint.value = start;
      runOnJS(resetPath)(start);
    })
    .onUpdate((e) => {
      const p = clampPointToRect({ x: e.x, y: e.y }, bounds);
      const last = lastPoint.value;
      if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= MIN_POINT_DISTANCE) {
        lastPoint.value = p;
        runOnJS(appendPoint)(p);
      }
    })
    .onEnd(() => {
      runOnJS(finish)();
    }), [resetPath, appendPoint, finish, bounds]);

  const pathAnimatedProps = useAnimatedProps(() => ({
    strokeWidth: 2.5 + settle.value * 1.5,
    fillOpacity: 0.18 + settle.value * 0.14,
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: badgeScale.value,
    transform: [{ scale: badgeScale.value }],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <GestureDetector gesture={pan}>
        <Svg style={StyleSheet.absoluteFill} pointerEvents="box-only">
          <AnimatedPath
            d={pointsToPathD(points, settled)}
            stroke={settled ? colors.sageDark : colors.terra}
            fill={settled ? colors.sageDark : colors.terra}
            strokeLinecap="round"
            strokeLinejoin="round"
            animatedProps={pathAnimatedProps}
          />
        </Svg>
      </GestureDetector>

      {/* Scissors riding the tip of the cut.
          Only while drawing — once the loop settles the checkmark badge takes
          over, and two markers at once would muddle "still cutting" with
          "done". */}
      {!settled && points.length >= 2 && (
        <View
          pointerEvents="none"
          style={[
            styles.scissors,
            {
              left: points[points.length - 1].x - SCISSORS_SIZE / 2,
              top: points[points.length - 1].y - SCISSORS_SIZE / 2,
              transform: [
                { rotate: `${(headingAt(points) ?? 0) - SCISSORS_REST_ANGLE}deg` },
              ],
            },
          ]}
        >
          <Scissors size={SCISSORS_SIZE} color={colors.inkDark} strokeWidth={2.25} />
        </View>
      )}

      {badgeCenter && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.badge,
            badgeStyle,
            { left: badgeCenter.x - BADGE_SIZE / 2, top: badgeCenter.y - BADGE_SIZE / 2 },
          ]}
        >
          <Check size={16} color={colors.card} strokeWidth={3} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scissors: {
    position: 'absolute',
    width: SCISSORS_SIZE,
    height: SCISSORS_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    // A soft halo so the blades stay legible over a dark or busy photo without
    // needing a solid chip behind them, which would hide the line being cut.
    shadowColor: colors.card,
    shadowOpacity: 0.9,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 0 },
  },
  badge: {
    position: 'absolute',
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: colors.sageDark,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
});
