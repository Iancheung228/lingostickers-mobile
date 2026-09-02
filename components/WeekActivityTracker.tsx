import { View, Text, StyleSheet } from 'react-native';
import { DayActivity } from '@/lib/review';
import { colors, radii, spacing, shadows, fonts } from '@/constants/theme';

interface WeekActivityTrackerProps {
  week: DayActivity[];
  /// Which series the screen's toggle is currently on. Both are always drawn
  /// — the week only means something as a pair — but the one you're reading
  /// the month grid by is the one this card leads with.
  active: 'finds' | 'reviews';
}

// Bars are a straight proportion of the busiest bar in the card — one scale
// across both series, not one per series, so a day's two bars can be read
// against each other and not just against their own colour. The floor only
// catches the case a pure proportion can't draw: one find against a
// twenty-review peak would be a sliver you can't see. Nothing at all is a
// flat rule rather than a very short bar — it's a different kind of thing,
// and drawing it as a bar would imply it carries a little work.
const BAR_MAX = 44;
const BAR_MIN = 8;
const BAR_EMPTY = 3;
const BAR_WIDTH = 11;

export default function WeekActivityTracker({ week, active }: WeekActivityTrackerProps) {
  const findsActive = active === 'finds';
  const peak = Math.max(...week.flatMap(d => [d.finds, d.reviews]), 0);
  const totalFinds = week.reduce((sum, d) => sum + d.finds, 0);
  const totalReviews = week.reduce((sum, d) => sum + d.reviews, 0);

  const heightOf = (count: number) =>
    count === 0 ? BAR_EMPTY : Math.max(BAR_MIN, (peak > 0 ? count / peak : 0) * BAR_MAX);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>THIS WEEK</Text>
        {/* The legend carries the totals, so the chart needs no numeral above
            each bar — fourteen of them in a card this size is a table, not a
            shape you can read at a glance. */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.dot, findsActive ? styles.findsFill : styles.findsMuted]} />
            <Text style={[styles.legendText, findsActive && styles.legendTextActive]}>
              {totalFinds} found
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, findsActive ? styles.reviewsMuted : styles.reviewsFill]} />
            <Text style={[styles.legendText, !findsActive && styles.legendTextActive]}>
              {totalReviews} reviewed
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.chart}>
        {week.map((day, i) => (
          <View key={i} style={styles.column}>
            {/* Same shaded box the month grid puts under today, so the two
                charts mark the day you're standing on the same way. */}
            {day.isToday && <View style={styles.todayBox} pointerEvents="none" />}
            <View style={styles.bars}>
              <View
                style={[
                  styles.bar,
                  { height: heightOf(day.finds) },
                  day.finds === 0 ? styles.barEmpty
                    : findsActive ? styles.findsFill : styles.findsMuted,
                ]}
              />
              <View
                style={[
                  styles.bar,
                  { height: heightOf(day.reviews) },
                  day.reviews === 0 ? styles.barEmpty
                    : findsActive ? styles.reviewsMuted : styles.reviewsFill,
                ]}
              />
            </View>
            <Text style={[styles.day, day.isToday && styles.dayToday]}>{day.initial}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    backgroundColor: colors.card,
    borderRadius: 28,
    // A hair wider than the month card's inset, which is what puts this
    // chart's seven columns on the same centres as that grid's seven —
    // the two cards read as one ruler down the page.
    paddingHorizontal: 14,
    paddingTop: 15,
    paddingBottom: 11,
    ...shadows.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: 11,
  },
  title: { fontSize: 10, fontFamily: fonts.monoBold, color: colors.inkFaint, letterSpacing: 1.5 },

  legend: { flexDirection: 'row', alignItems: 'center', gap: spacing.ms },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: radii.full },
  legendText: { fontSize: 11, fontFamily: fonts.display, color: colors.inkFaint },
  legendTextActive: { color: colors.inkDark },

  // The two series are different hues rather than two tints of the rose: a
  // light-and-dark pair of the same colour reads as a scale of one quantity,
  // which is exactly the wrong thing to suggest about finds against reviews.
  findsFill: { backgroundColor: colors.sage },
  reviewsFill: { backgroundColor: colors.blushDeep },
  // The toggle dims the other series rather than removing it: the bars keep
  // one shared scale, so switching modes recolours the chart without any
  // height moving, and the week you aren't reading is still there to compare
  // against. Each muted tone is its own hue washed out, not a neutral grey,
  // so it can't be mistaken for the empty-day rule below — and stays clearly
  // lighter than either full-strength fill.
  findsMuted: { backgroundColor: '#ECDCBB' },
  reviewsMuted: { backgroundColor: '#DCBEC0' },

  // The bar block below is a fixed BAR_MAX tall whatever it contains, so every
  // column ends up the same box — which is what keeps all seven baselines on
  // one line and lets today's shading fill its column exactly.
  chart: { flexDirection: 'row', alignItems: 'flex-end' },
  column: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: BAR_MAX },
  bar: { width: BAR_WIDTH, borderRadius: radii.sm },
  barEmpty: { backgroundColor: colors.borderLight },

  todayBox: {
    position: 'absolute',
    left: 1,
    right: 1,
    top: -4,
    bottom: -3,
    borderRadius: radii.md,
    backgroundColor: '#FBF0F0',
    borderWidth: 1.5,
    borderColor: colors.blush,
  },

  day: {
    fontSize: 11,
    fontFamily: fonts.monoBold,
    color: colors.inkLight,
    letterSpacing: 1,
    marginTop: 5,
  },
  dayToday: { color: colors.blushDeep },
});
