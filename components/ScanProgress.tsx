import { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Check } from 'lucide-react-native';
import { fonts, radii, spacing } from '@/constants/theme';
import { haptic } from '@/lib/haptics';
import { useMotion } from '@/lib/motion';
import Button from '@/components/ui/Button';
import { useTheme, useThemedStyles, type Theme } from '@/hooks/useTheme';

// ---------------------------------------------------------------------------
// What the app is doing while the user waits (B-core 2).
//
// Three named stages, each saying what it is *for*. Cancel is there from 0s and
// aborts with no alert. Elapsed time is read from the wall clock, not counted in
// ticks, so a scan that was backgrounded mid-stage shows the right note the
// moment the app comes back (timers are suspended in the background; Date.now()
// is not).
//   > 5s   "Taking longer than usual. Still going."
//   > 15s  "This is slow. Your photo is safe."  Keep waiting / Cancel
//   45s    hard timeout, owned by scan.tsx (it shows the error card).
// ---------------------------------------------------------------------------
export type ScanStage = 'cutting' | 'saving' | 'word';

const STAGES: { id: ScanStage; title: string; detail: string }[] = [
  { id: 'cutting', title: 'Cutting out your sticker', detail: 'Finding the object in your photo. This happens on your phone.' },
  { id: 'saving', title: 'Saving it to your collection', detail: 'Uploading the cutout' },
  { id: 'word', title: 'Looking up the word', detail: 'Working out what this is and how to say it' },
];

export const SLOW_AFTER_MS = 5000;
export const STUCK_AFTER_MS = 15000;

interface ScanProgressProps {
  stage: ScanStage;
  /// Set when the device declined and the server is doing the cutout instead.
  usingServerCutout?: boolean;
  onCancel?: () => void;
}

function Marker({ done, active, index }: { done: boolean; active: boolean; index: number }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { reduced } = useMotion();
  const scale = useSharedValue(done ? 1 : 1);
  const wasDone = useRef(done);
  useEffect(() => {
    if (done && !wasDone.current) {
      haptic.select();
      if (!reduced) { scale.value = 0.8; scale.value = withSpring(1, { damping: 12, stiffness: 260 }); }
    }
    wasDone.current = done;
  }, [done, reduced, scale]);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[styles.marker, done && styles.markerDone, active && styles.markerActive, pop]}>
      {done ? (
        <Check size={13} color={colors.white} strokeWidth={3} />
      ) : active ? (
        <ActivityIndicator size="small" color={colors.terraInk} />
      ) : (
        <Text style={styles.markerIdle}>{index + 1}</Text>
      )}
    </Animated.View>
  );
}

export default function ScanProgress({ stage, usingServerCutout, onCancel }: ScanProgressProps) {
  const styles = useThemedStyles(makeStyles);
  const activeIndex = STAGES.findIndex(s => s.id === stage);
  const startedAt = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [waiting, setWaiting] = useState(false); // "Keep waiting" pressed for this stage

  useEffect(() => {
    startedAt.current = Date.now();
    setElapsed(0);
    setWaiting(false);
    const timer = setInterval(() => setElapsed(Date.now() - startedAt.current), 500);
    return () => clearInterval(timer);
  }, [stage]);

  const slow = elapsed > SLOW_AFTER_MS;
  const stuck = elapsed > STUCK_AFTER_MS && !waiting;

  return (
    <View style={styles.card} testID="scan-progress" accessibilityLiveRegion="polite">
      {STAGES.map((item, index) => {
        const done = index < activeIndex;
        const active = index === activeIndex;
        return (
          <View key={item.id} style={styles.row}>
            <Marker done={done} active={active} index={index} />
            <View style={styles.text}>
              <Text
                style={[styles.title, done && styles.titleDone, !done && !active && styles.titleIdle]}
                maxFontSizeMultiplier={1.5}
              >
                {item.title}
              </Text>
              {active && (
                <Text style={styles.detail} maxFontSizeMultiplier={1.5}>
                  {item.id === 'cutting' && usingServerCutout
                    ? 'This one needs the cloud. It takes a few seconds longer.'
                    : item.detail}
                </Text>
              )}
            </View>
          </View>
        );
      })}

      {slow && !stuck && (
        <Text style={styles.note} testID="scan-slow-note" maxFontSizeMultiplier={1.5}>
          Taking longer than usual. Still going.
        </Text>
      )}
      {stuck && (
        <Text style={styles.note} testID="scan-stuck-note" maxFontSizeMultiplier={1.5}>
          This is slow. Your photo is safe.
        </Text>
      )}

      <View style={styles.buttons}>
        {stuck && <Button kind="secondary" label="Keep waiting" onPress={() => setWaiting(true)} style={styles.grow} />}
        {onCancel && (
          <Button
            kind={stuck ? 'secondary' : 'tertiary'}
            label="Cancel"
            onPress={onCancel}
            testID="scan-cancel"
            accessibilityLabel="Cancel scan"
            style={stuck ? styles.grow : undefined}
          />
        )}
      </View>
    </View>
  );
}

/** Dims whatever is behind it (the frozen photo) and floats the card over it. */
export function ScanOverlay({ children }: { children: React.ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.scrim} pointerEvents="none" />
      <View style={styles.overlayBody}>{children}</View>
    </View>
  );
}

const makeStyles = ({ colors, e2, type }: Theme) => StyleSheet.create({
  card: {
    gap: spacing.ms,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    alignSelf: 'stretch',
    ...e2,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.ms },
  marker: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.ctl,
  },
  markerActive: { backgroundColor: colors.terraLight, borderColor: colors.terra },
  markerDone: { backgroundColor: colors.success, borderColor: colors.success },
  markerIdle: { fontSize: 12, fontFamily: fonts.mono, color: colors.inkLight },
  text: { flex: 1, paddingTop: 2 },
  title: { ...type.body, fontFamily: fonts.display, color: colors.inkDark, lineHeight: 22 },
  titleDone: { color: colors.inkLight },
  titleIdle: { color: colors.inkLight },
  detail: { ...type.small, marginTop: 2 },
  note: { ...type.small, color: colors.inkDark, textAlign: 'center' },
  buttons: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  grow: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.scrim },
  overlayBody: { padding: spacing.md },
});
