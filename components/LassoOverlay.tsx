import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Point } from '@/lib/cropGeometry';

interface LassoOverlayProps {
  // Called once the user lifts their finger, with the drawn loop's points
  // (in container-local coordinates). Empty/too-short loops are filtered out.
  onComplete: (points: Point[]) => void;
}

const MIN_POINT_DISTANCE = 4;
const MIN_LOOP_POINTS = 6;

function pointsToPathD(points: Point[]): string {
  if (points.length === 0) return '';
  return points.reduce((d, p, i) => d + (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`), '');
}

export default function LassoOverlay({ onComplete }: LassoOverlayProps) {
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

  const finish = useCallback(() => {
    const current = pointsRef.current;
    if (current.length >= MIN_LOOP_POINTS) onComplete(current);
  }, [onComplete]);

  const pan = useMemo(() => Gesture.Pan()
    .onStart((e) => {
      const start = { x: e.x, y: e.y };
      lastPoint.value = start;
      runOnJS(resetPath)(start);
    })
    .onUpdate((e) => {
      const p = { x: e.x, y: e.y };
      const last = lastPoint.value;
      if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= MIN_POINT_DISTANCE) {
        lastPoint.value = p;
        runOnJS(appendPoint)(p);
      }
    })
    .onEnd(() => {
      runOnJS(finish)();
    }), [resetPath, appendPoint, finish]);

  return (
    <GestureDetector gesture={pan}>
      <Svg style={StyleSheet.absoluteFill} pointerEvents="box-only">
        <Path
          d={pointsToPathD(points)}
          stroke="#A7D7C5"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="rgba(167, 215, 197, 0.18)"
        />
      </Svg>
    </GestureDetector>
  );
}
