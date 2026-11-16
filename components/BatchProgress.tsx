import { View, Text, StyleSheet } from 'react-native';
import { fonts } from '@/constants/theme';
import { useThemedStyles, type Theme } from '@/hooks/useTheme';
import type { BatchProgress as Progress } from '@/lib/batchQueue';

// The strip across batch create's two phases: `Cut ●●○  Review ○○○`. Filled
// dots are done, the ringed one is where the learner is now. It is one
// accessibility element so VoiceOver reads a sentence, not six dots.
interface Props {
  progress: Progress;
  phase: 'cut' | 'review';
}

function Dots({ count, done, current, styles }: { count: number; done: number; current: number | null; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={[styles.dot, i < done ? styles.dotDone : i === current ? styles.dotNow : null]}
        />
      ))}
    </View>
  );
}

export default function BatchProgress({ progress, phase }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { total, cut, reviewed } = progress;
  const label = phase === 'cut'
    ? (progress.photoCount
      ? `Cutting photo ${(progress.photoIndex ?? 0) + 1} of ${progress.photoCount}`
      : `Cutting photo ${Math.min(cut + 1, total)} of ${total}`)
    : `Reviewing card ${Math.min(reviewed + 1, total)} of ${total}`;
  return (
    <View style={styles.strip} accessible accessibilityRole="progressbar" accessibilityLabel={label} testID="batch-progress">
      <Text style={[styles.word, phase === 'cut' && styles.wordNow]} maxFontSizeMultiplier={1.3}>Cut</Text>
      <Dots count={total} done={cut} current={phase === 'cut' ? cut : null} styles={styles} />
      <View style={styles.gap} />
      <Text style={[styles.word, phase === 'review' && styles.wordNow]} maxFontSizeMultiplier={1.3}>Review</Text>
      <Dots count={total} done={reviewed} current={phase === 'review' ? reviewed : null} styles={styles} />
    </View>
  );
}

const makeStyles = ({ colors }: Theme) => StyleSheet.create({
  strip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  gap: { width: 10 },
  word: { fontSize: 13, lineHeight: 18, fontFamily: fonts.text, color: colors.inkLight },
  wordNow: { fontFamily: fonts.display, color: colors.inkDark },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: colors.ctl },
  dotDone: { backgroundColor: colors.terra, borderColor: colors.terra },
  dotNow: { borderColor: colors.terra },
});
