import { View, Text, StyleSheet, Pressable } from 'react-native';
import { radii, spacing, MIN_TAP } from '@/constants/theme';
import { haptic } from '@/lib/haptics';
import { QUICK_SESSION_SIZE, reviewMinutes } from '@/lib/review';
import { useThemedStyles, type Theme } from '@/hooks/useTheme';

export const TODAY_CARD_HEIGHT = 72;

interface TodayCardProps {
  /// Today's capped queue length. Never shown above the Quick 5 size.
  queueCount: number;
  /// Welcome-back mode (new cards paused).
  catchUp: boolean;
  /// A Quick 5 just ended and more are waiting.
  afterSession: boolean;
  /// "tomorrow" / "in 3 days" / "later today", for the caught-up line.
  nextWhen: string | null;
  onStart: () => void;
}

/**
 * The one review entry (spec 3): a small card that says how much is next, never
 * how much is owed. Counts are capped at the size of one Quick session.
 */
export default function TodayCard({ queueCount, catchUp, afterSession, nextWhen, onStart }: TodayCardProps) {
  const styles = useThemedStyles(makeStyles);
  const n = Math.min(queueCount, QUICK_SESSION_SIZE);
  const cards = `${n} card${n === 1 ? '' : 's'}`;
  const mins = reviewMinutes(n);
  const NB = '\u00A0';
  const detail = `${cards} · about${NB}${mins}${NB}min`;

  let title: string;
  let button: string | null = 'Start';
  let id = 'today-start';
  if (queueCount === 0) {
    title = nextWhen ? `All caught up. Next one ${nextWhen}.` : 'All caught up.';
    button = null;
  } else if (afterSession) {
    title = 'Nice. 5 more?';
    button = `${n} more`;
    id = 'today-more';
  } else if (catchUp) {
    title = `Welcome back · ${detail}`;
  } else {
    title = `Today · ${detail}`;
  }

  return (
    <View style={styles.card} testID="today-card" accessible={button === null} accessibilityLabel={button === null ? title : undefined}>
      <View style={styles.textCol}>
        <Text style={styles.title} numberOfLines={2} maxFontSizeMultiplier={1.4}>{title}</Text>
        {afterSession && queueCount > 0 && <Text style={styles.sub} maxFontSizeMultiplier={1.4}>{detail}</Text>}
      </View>
      {button && (
        <Pressable
          testID={id}
          onPress={() => { haptic.press(); onStart(); }}
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          accessibilityRole="button"
          accessibilityLabel={afterSession ? `${button}, ${detail}` : `Start, ${detail}`}
        >
          <Text style={styles.btnText} maxFontSizeMultiplier={1.3}>{button}</Text>
        </Pressable>
      )}
    </View>
  );
}

const makeStyles = ({ colors, e1, type }: Theme) => StyleSheet.create({
  card: {
    height: TODAY_CARD_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card, borderRadius: radii.md, paddingHorizontal: spacing.md, ...e1,
  },
  textCol: { flex: 1, gap: 2 },
  title: { ...type.button, color: colors.inkDark },
  sub: { ...type.small },
  btn: {
    minWidth: MIN_TAP + 20, height: MIN_TAP, paddingHorizontal: spacing.md, borderRadius: radii.full,
    backgroundColor: colors.terra, alignItems: 'center', justifyContent: 'center',
  },
  btnPressed: { backgroundColor: colors.terraDark },
  btnText: { ...type.button, color: colors.white },
});
