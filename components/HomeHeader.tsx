import { View, StyleSheet } from 'react-native';
import Animated, { interpolate, Extrapolation, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radii, spacing } from '@/constants/theme';
import { useMotion } from '@/lib/motion';
import { useThemedStyles, type Theme } from '@/hooks/useTheme';

/** The rose band at rest is 140pt tall (SPEC "Home band copy"). */
export const BAND_HEIGHT = 140;
/** Its slim form: the title row and nothing else. */
export function slimBandHeight(insetTop: number) { return insetTop + 52; }

interface HomeHeaderProps {
  /** The list's scroll offset: the band collapses to a slim bar as it grows. */
  scrollY: SharedValue<number>;
}

// The band shows only "Collection". Review lives on the Today card below the
// wall (components/TodayCard.tsx): no count, no pill. Two layers make the collapse work with the
// wall overlapping the band at rest: `fill` sits BEHIND the list (so the wall
// card can overlap its bottom 24pt) and slides up as you scroll; `bar` sits
// ABOVE the list with the title and pill and is always the slim height. At rest
// they are the same rose, so together they read as one 140pt band.
export function HomeBandFill({ scrollY }: { scrollY: SharedValue<number> }) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { reduced } = useMotion();
  const travel = BAND_HEIGHT - slimBandHeight(insets.top);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: reduced ? (scrollY.value > 8 ? -travel : 0) : -Math.min(Math.max(scrollY.value, 0), travel) }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.fill, style]} />;
}

export default function HomeHeader({ scrollY }: HomeHeaderProps) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { reduced } = useMotion();
  const slim = slimBandHeight(insets.top);

  const title = useAnimatedStyle(() => {
    const y = scrollY.value;
    const t = reduced ? (y > 40 ? 1 : 0) : interpolate(y, [0, 60], [0, 1], Extrapolation.CLAMP);
    return { fontSize: 30 - 8 * t, lineHeight: 34 - 6 * t, letterSpacing: -0.6 + 0.2 * t };
  });
  return (
    <Animated.View style={[styles.bar, { height: slim, paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.row}>
        <Animated.Text style={[styles.title, title]} accessibilityRole="header" numberOfLines={1} maxFontSizeMultiplier={1.3}>
          Collection
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const makeStyles = ({ colors, type, e1 }: Theme) => StyleSheet.create({
  fill: {
    position: 'absolute', left: 0, right: 0, top: 0, height: BAND_HEIGHT,
    backgroundColor: colors.blush,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  bar: {
    position: 'absolute', left: 0, right: 0, top: 0, zIndex: 20,
    backgroundColor: colors.blush,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
    paddingHorizontal: 20,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
  title: { flex: 1, fontFamily: type.title.fontFamily, color: colors.maroon },
  duePill: {
    flexDirection: 'row', alignItems: 'center', height: 40, backgroundColor: colors.card,
    borderRadius: radii.full, paddingLeft: spacing.md, paddingRight: 4, gap: spacing.sm, ...e1,
  },
  pillPressed: { backgroundColor: colors.terraLight },
  dueText: { ...type.button, color: colors.inkDark },
  arrow: {
    width: 32, height: 32, borderRadius: radii.full, backgroundColor: colors.terra,
    alignItems: 'center', justifyContent: 'center',
  },
});
