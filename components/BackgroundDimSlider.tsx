import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Contrast } from 'lucide-react-native';
import { colors, radii, shadows } from '@/constants/theme';

interface BackgroundDimSliderProps {
  // Last-committed percent (0-maxPct) — re-synced from outside whenever it
  // changes (e.g. on load, or after onCommit's write resolves).
  value: number;
  maxPct: number;
  // Fired continuously (throttled to whole percentage points) while
  // dragging, so the canvas tint can preview live — no network write here.
  onPreviewChange: (pct: number) => void;
  // Fired once, on release — this is the one that actually persists.
  onCommit: (pct: number) => void;
}

const TRACK_WIDTH = 68;
const THUMB_SIZE = 16;
const PILL_HEIGHT = 26;
// A haptic "tick" every 5% crossed, not every 1% — a fast drag across the
// full range firing 70 individual pulses would feel like a buzz, not a dial.
const HAPTIC_STEP_PCT = 5;

export default function BackgroundDimSlider({ value, maxPct, onPreviewChange, onCommit }: BackgroundDimSliderProps) {
  const clampedValue = Math.min(maxPct, Math.max(0, value));
  const pct = useSharedValue(clampedValue);
  const lastHapticStep = useSharedValue(Math.round(clampedValue / HAPTIC_STEP_PCT));
  const [displayPct, setDisplayPct] = useState(clampedValue);
  const lastReportedRef = useRef(clampedValue);

  // Re-syncs whenever the committed value changes from outside — a no-op
  // while this same slider is the one driving it (already equal), but keeps
  // it correct after an initial load or a failed commit reverting the value.
  useEffect(() => {
    pct.value = clampedValue;
    setDisplayPct(clampedValue);
    lastReportedRef.current = clampedValue;
  }, [clampedValue]);

  const reportPreview = useCallback((next: number) => {
    if (next === lastReportedRef.current) return;
    lastReportedRef.current = next;
    setDisplayPct(next);
    onPreviewChange(next);
  }, [onPreviewChange]);

  const tick = useCallback(() => { Haptics.selectionAsync(); }, []);
  const commit = useCallback((next: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCommit(next);
  }, [onCommit]);

  const pan = useMemo(() => Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      const next = Math.min(maxPct, Math.max(0, Math.round((e.x / TRACK_WIDTH) * maxPct)));
      pct.value = next;
      runOnJS(reportPreview)(next);
    })
    .onUpdate((e) => {
      const next = Math.min(maxPct, Math.max(0, Math.round((e.x / TRACK_WIDTH) * maxPct)));
      pct.value = next;
      const step = Math.round(next / HAPTIC_STEP_PCT);
      if (step !== lastHapticStep.value) {
        lastHapticStep.value = step;
        runOnJS(tick)();
      }
      runOnJS(reportPreview)(next);
    })
    .onEnd(() => {
      runOnJS(commit)(pct.value);
    }), [maxPct, reportPreview, tick, commit]);

  const fillStyle = useAnimatedStyle(() => ({ width: (pct.value / maxPct) * TRACK_WIDTH }));
  const thumbStyle = useAnimatedStyle(() => ({ left: (pct.value / maxPct) * TRACK_WIDTH - THUMB_SIZE / 2 }));

  return (
    <View style={styles.pill}>
      <Contrast size={12} color={colors.inkDark} />
      <GestureDetector gesture={pan}>
        <View style={styles.track} hitSlop={{ top: 10, bottom: 10 }}>
          <View style={styles.rail} />
          <Animated.View style={[styles.fill, fillStyle]} />
          <Animated.View style={[styles.thumb, thumbStyle]} />
        </View>
      </GestureDetector>
      <Text style={styles.pctText}>{displayPct}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: PILL_HEIGHT,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 8,
    ...shadows.card,
  },
  track: {
    width: TRACK_WIDTH,
    height: PILL_HEIGHT,
    justifyContent: 'center',
  },
  rail: {
    position: 'absolute',
    left: 0,
    width: TRACK_WIDTH,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.borderLight,
  },
  fill: {
    position: 'absolute',
    left: 0,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.terra,
  },
  thumb: {
    position: 'absolute',
    top: (PILL_HEIGHT - THUMB_SIZE) / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.terra,
    ...shadows.card,
  },
  pctText: { fontSize: 10, fontWeight: '700', color: colors.inkDark, minWidth: 24 },
});
