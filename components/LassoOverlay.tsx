import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { X, Scissors } from 'lucide-react-native';
import { Point, Rect, clampPointToRect } from '@/lib/cropGeometry';
import { useTheme, useThemedStyles, type Theme } from '@/hooks/useTheme';

interface LassoOverlayProps {
  // The image's own display rect (container-local coords) — points are
  // clamped to this so a fat-finger drag past the photo's edge sticks to
  // the border instead of drifting into the letterboxed margin around it.
  bounds: Rect;
  // Loops already drawn (container-local coords). They stay on the photo,
  // outlined and numbered; the parent owns the list.
  loops: Point[][];
  // Called once the user lifts their finger, with the drawn loop's points
  // (in container-local coordinates). Empty/too-short loops are filtered out.
  onComplete: (points: Point[]) => void;
  // The numbered badge on a loop removes it.
  onRemove: (index: number) => void;
  // No more loops can be drawn (the batch is full); drawing is switched off.
  full?: boolean;
}

const MIN_POINT_DISTANCE = 4;
const MIN_LOOP_POINTS = 6;
const BADGE_W = 52;
const BADGE_H = 32;
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

export default function LassoOverlay({ bounds, loops, onComplete, onRemove, full }: LassoOverlayProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [points, setPoints] = useState<Point[]>([]);
  const lastPoint = useSharedValue<Point | null>(null);
  // Mirrors `points` so `finish` can read the final loop synchronously,
  // without calling back into the parent from inside a setState updater
  // (React flags that as "update during render of a different component").
  const pointsRef = useRef<Point[]>([]);
  const resetPath = useCallback((p: Point) => {
    pointsRef.current = [p];
    setPoints(pointsRef.current);
  }, []);
  const appendPoint = useCallback((p: Point) => {
    pointsRef.current = [...pointsRef.current, p];
    setPoints(pointsRef.current);
  }, []);

  // Lifting the finger hands the loop to the parent, which keeps it on the
  // photo (outlined, numbered) and lets the learner draw another. The actual
  // send still waits on the Make sticker button.
  const finish = useCallback(() => {
    const current = pointsRef.current;
    pointsRef.current = [];
    setPoints([]);
    if (current.length < MIN_LOOP_POINTS) return;
    onComplete(current);
  }, [onComplete]);

  const pan = useMemo(() => Gesture.Pan()
    .enabled(!full)
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
    }), [resetPath, appendPoint, finish, bounds, full]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <GestureDetector gesture={pan}>
        <Svg style={StyleSheet.absoluteFill} pointerEvents="box-only">
          {loops.map((loop, i) => (
            <Path
              key={i}
              d={pointsToPathD(loop, true)}
              stroke={colors.sageDark}
              fill={colors.sageDark}
              fillOpacity={0.2}
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          <Path
            d={pointsToPathD(points, false)}
            stroke={colors.terra}
            fill={colors.terra}
            fillOpacity={0.18}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </GestureDetector>

      {/* Scissors riding the tip of the cut.
          Only while drawing. */}
      {points.length >= 2 && (
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

      {loops.map((loop, i) => {
        const c = centroidOf(loop);
        return (
          <Pressable
            key={i}
            testID={`lasso-remove-${i}`}
            onPress={() => onRemove(i)}
            hitSlop={{ top: 6, bottom: 6, left: 0, right: 0 }}
            accessibilityRole="button"
            accessibilityLabel={`Cutout ${i + 1} of ${loops.length}. Remove`}
            style={[styles.badge, { left: c.x - BADGE_W / 2, top: c.y - BADGE_H / 2 }]}
          >
            <Text style={styles.badgeNum}>{i + 1}</Text>
            <X size={14} color={colors.white} strokeWidth={3} />
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = ({ colors, shadows }: Theme) => StyleSheet.create({
  scissors: {
    position: 'absolute',
    width: SCISSORS_SIZE,
    height: SCISSORS_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    // A soft halo so the blades stay legible over a dark or busy photo without
    // needing a solid chip behind them, which would hide the line being cut.
    shadowColor: colors.white,
    shadowOpacity: 0.9,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 0 },
  },
  badge: {
    position: 'absolute',
    width: BADGE_W,
    height: BADGE_H,
    borderRadius: BADGE_H / 2,
    backgroundColor: colors.sageDark,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  badgeNum: { color: colors.white, fontSize: 15, lineHeight: 18, fontWeight: '700' },
});
