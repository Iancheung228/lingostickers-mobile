import { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors, radii, spacing, fonts } from '@/constants/theme';

// ---------------------------------------------------------------------------
// What the app is doing while the user waits.
//
// A single spinner labelled "working…" makes every wait feel identical, so a
// slow one reads as a hang rather than as slow work. The pipeline has real,
// nameable stages now, and naming them turns "why is this stuck" into "it's on
// the last step" — which is the difference between a broken app and a busy one.
//
// Each stage also says what it is *for*, not just what it is doing. "Finding
// the word" without "so your sticker gets its translation" is jargon; the
// point of the wait is more reassuring than the mechanism.
// ---------------------------------------------------------------------------
export type ScanStage = 'cutting' | 'saving' | 'word';

const STAGES: { id: ScanStage; title: string; detail: string }[] = [
  {
    id: 'cutting',
    title: 'Cutting out your sticker',
    detail: 'Finding the object in your photo — this happens on your phone',
  },
  {
    id: 'saving',
    title: 'Saving it to your collection',
    detail: 'Uploading the cutout',
  },
  {
    id: 'word',
    title: 'Looking up the word',
    detail: 'Working out what this is and how to say it',
  },
];

/// How long a stage may run before the copy acknowledges it. Set above the
/// normal duration of the slowest stage, so this only ever fires when
/// something genuinely is unusual.
const SLOW_AFTER_MS = 6000;

interface ScanProgressProps {
  stage: ScanStage;
  /// Set when the device declined and the server is doing the cutout instead —
  /// the single most common reason step one takes seconds rather than
  /// milliseconds, and worth saying out loud rather than leaving as a mystery.
  usingServerCutout?: boolean;
}

export default function ScanProgress({ stage, usingServerCutout }: ScanProgressProps) {
  const activeIndex = STAGES.findIndex(s => s.id === stage);
  const [slow, setSlow] = useState(false);
  const stageStartedAt = useRef(Date.now());

  useEffect(() => {
    stageStartedAt.current = Date.now();
    setSlow(false);
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [stage]);

  return (
    <View style={styles.container}>
      {STAGES.map((item, index) => {
        const done = index < activeIndex;
        const active = index === activeIndex;
        return (
          <View key={item.id} style={styles.row}>
            <View style={[styles.marker, done && styles.markerDone, active && styles.markerActive]}>
              {done ? (
                <Check size={11} color={colors.white} strokeWidth={3} />
              ) : active ? (
                <ActivityIndicator size="small" color={colors.inkDark} />
              ) : (
                <Text style={styles.markerIdle}>{index + 1}</Text>
              )}
            </View>

            <View style={styles.text}>
              <Text
                style={[styles.title, done && styles.titleDone, !done && !active && styles.titleIdle]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              {active && (
                <Text style={styles.detail}>
                  {item.id === 'cutting' && usingServerCutout
                    ? 'This one needs the cloud — it takes a few seconds longer'
                    : item.detail}
                </Text>
              )}
            </View>
          </View>
        );
      })}

      {slow && (
        <Text style={styles.slowNote}>
          {stage === 'word'
            ? 'The word service is busy right now — still going.'
            : 'Taking longer than usual — still going.'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.cardAlt,
    borderRadius: radii.lg,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  marker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.skyNight,
  },
  markerActive: { backgroundColor: colors.terraLight, borderColor: colors.terra },
  markerDone: { backgroundColor: colors.sageDark, borderColor: colors.sageDark },
  markerIdle: { fontSize: 11, fontFamily: fonts.display, color: colors.inkFaint },
  text: { flex: 1, paddingTop: 2 },
  title: { fontSize: 13, fontFamily: fonts.display, color: colors.inkDark },
  titleDone: { color: colors.inkLight },
  titleIdle: { color: colors.inkFaint },
  detail: { fontSize: 11, fontFamily: fonts.text, color: colors.inkLight, marginTop: 2, lineHeight: 15 },
  slowNote: { fontSize: 11, fontFamily: fonts.display, color: colors.sageDark, textAlign: 'center', marginTop: 2, },
});
