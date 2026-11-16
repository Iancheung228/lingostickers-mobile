import { useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { ArrowRight } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import Button from '@/components/ui/Button';
import { markOnboardingDone } from '@/lib/onboarding';
import { haptic } from '@/lib/haptics';
import { useMotion } from '@/lib/motion';
import { fonts, radii, spacing, wordFontFor, GUTTER } from '@/constants/theme';
import { useTheme, useThemedStyles, type Theme } from '@/hooks/useTheme';
import type { Palette } from '@/constants/palettes';

// First run: three short screens (photo, sticker and word, review), then Scan.
// Calm on purpose: a sand disc and one sentence each, no metaphor, no confetti.
// Skippable from every page. Gated in app/_layout.tsx (lib/onboarding.ts).

const PAGES = [
  {
    title: 'Photograph something near you',
    body: 'Point the camera at an object, or pick a photo you already have.',
  },
  {
    title: 'It becomes a sticker and a word',
    body: 'Tabi cuts the object out and gives you the word, an example sentence and how it sounds.',
  },
  {
    title: 'Review a little each day',
    body: "Cards come back just before you'd forget them. Grade each one and the next date is set for you.",
  },
] as const;

// A hand-drawn apple, the same fruit screen 2 uses. `cutout` draws it as the
// app does a finished sticker: a white outline and a contact shadow under it.
function Apple({ size, cutout }: { size: number; cutout?: boolean }) {
  const { colors } = useTheme();
  const body = (
    <G>
      <Path d="M50 28 C38 20 18 26 18 50 C18 72 34 86 50 82 C66 86 82 72 82 50 C82 26 62 20 50 28 Z" />
      <Path d="M50 28 C50 20 54 14 60 11" strokeLinecap="round" />
    </G>
  );
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {cutout && <Ellipse cx="50" cy="90" rx="26" ry="4.5" fill={colors.shadowDeep} fillOpacity={0.2} />}
      {cutout && (
        <G fill={colors.white} stroke={colors.white} strokeWidth={9} strokeLinejoin="round">{body}</G>
      )}
      <G fill={colors.error} stroke="none">
        <Path d="M50 28 C38 20 18 26 18 50 C18 72 34 86 50 82 C66 86 82 72 82 50 C82 26 62 20 50 28 Z" />
      </G>
      <Path d="M50 28 C50 20 54 14 60 11" stroke={colors.maroon} strokeWidth={3.5} strokeLinecap="round" fill="none" />
      <Path d="M54 22 C60 14 70 14 74 18 C68 26 60 26 54 22 Z" fill={colors.success} />
      <Ellipse cx="34" cy="46" rx="5" ry="9" fill={colors.white} fillOpacity={0.28} transform="rotate(20 34 46)" />
    </Svg>
  );
}

function Visual({ page }: { page: number }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const MINI_GRADES = miniGradesFor(colors);
  if (page === 0) {
    // The moment a photo becomes a sticker: the photo, an arrow, the cutout.
    return (
      <View style={styles.moment} accessible={false} importantForAccessibility="no-hide-descendants">
        <View style={styles.photo}>
          <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
            <Rect x="0" y="0" width="100" height="100" fill={colors.sand2} />
            <Rect x="0" y="66" width="100" height="34" fill={colors.blush} fillOpacity={0.45} />
            <Circle cx="82" cy="20" r="14" fill={colors.sand} />
          </Svg>
          <View style={styles.photoApple}><Apple size={84} /></View>
        </View>
        <ArrowRight size={22} strokeWidth={2} color={colors.inkLight} />
        <View style={styles.cutoutWell}><Apple size={96} cutout /></View>
      </View>
    );
  }
  if (page === 1) {
    return (
      <View style={styles.card} accessible={false} importantForAccessibility="no-hide-descendants">
        <View style={styles.well}><Text style={styles.emoji}>🍎</Text></View>
        <Text style={[styles.cardWord, { fontFamily: wordFontFor('fr') }]}>la pomme</Text>
        <Text style={styles.cardMeaning}>apple</Text>
      </View>
    );
  }
  // A card's answer side with its grade row, exactly as it will look in study.
  return (
    <View style={styles.card3} accessible={false} importantForAccessibility="no-hide-descendants">
      <Text style={[styles.cardWord, { fontFamily: wordFontFor('fr'), marginTop: 0 }]}>la pomme</Text>
      <Text style={styles.cardMeaning}>apple</Text>
      <View style={styles.miniRow}>
        {MINI_GRADES.map(g => (
          <View key={g.label} style={[styles.miniBtn, { backgroundColor: g.bg, flex: g.flex }]}>
            <Text style={[styles.miniLabel, { color: g.fg }]} maxFontSizeMultiplier={1}>{g.label}</Text>
            <Text style={[styles.miniSub, { color: g.fg }]} maxFontSizeMultiplier={1}>{g.sub}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const miniGradesFor = (colors: Palette) => [
  { label: 'Again', sub: '1m', bg: colors.againTint, fg: colors.errorInk, flex: 1.4 },
  { label: 'Hard', sub: '6m', bg: colors.goldTint, fg: colors.gold, flex: 1 },
  { label: 'Good', sub: '10m', bg: colors.success, fg: colors.white, flex: 1.4 },
  { label: 'Easy', sub: '4d', bg: colors.successLight, fg: colors.successInk, flex: 1 },
];

export default function OnboardingScreen() {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { fade } = useMotion();
  const [page, setPage] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;
  const last = page === PAGES.length - 1;

  // 200 ms crossfade between pages (120 ms under Reduce Motion), never a slide.
  const goTo = (next: number) => {
    Animated.timing(opacity, { toValue: 0, duration: fade(100), useNativeDriver: true }).start(() => {
      setPage(next);
      Animated.timing(opacity, { toValue: 1, duration: fade(100), useNativeDriver: true }).start();
    });
  };


  const finish = async (to: '/(tabs)/scan' | '/(tabs)/collection') => {
    if (user) await markOnboardingDone(user.id);
    router.replace(to);
  };

  const next = () => {
    haptic.select();
    if (last) void finish('/(tabs)/scan'); else goTo(page + 1);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.md }]}>
      <View style={styles.top}>
        <Button kind="tertiary" label="Skip" onPress={() => finish('/(tabs)/collection')} accessibilityHint="Skips the introduction" />
      </View>

      <Animated.View style={[styles.page, { opacity }]}>
        <Visual page={page} />
        <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.5}>{PAGES[page].title}</Text>
        <Text style={styles.body} maxFontSizeMultiplier={2}>{PAGES[page].body}</Text>
      </Animated.View>

      <View style={styles.bottom}>
        <View
          style={styles.dots}
          accessible
          accessibilityLabel={`Step ${page + 1} of ${PAGES.length}`}
          accessibilityLiveRegion="polite"
        >
          {PAGES.map((_, i) => <View key={i} style={[styles.dot, i === page && styles.dotOn]} />)}
        </View>
        <Button label={last ? 'Get started' : 'Next'} onPress={next} style={styles.cta} testID="onboarding-next" />
      </View>
    </View>
  );
}

const makeStyles = ({ colors, e1, type }: Theme) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.sky, paddingHorizontal: GUTTER },
  top: { alignItems: 'flex-end', minHeight: 44 },
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  moment: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  photo: { width: 128, height: 128, borderRadius: radii.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end', ...e1 },
  photoApple: { position: 'absolute', bottom: 18 },
  cutoutWell: { width: 128, height: 128, alignItems: 'center', justifyContent: 'center' },
  card3: {
    width: 288, backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.md, alignItems: 'center',
    marginBottom: spacing.md, ...e1,
  },
  miniRow: { flexDirection: 'row', gap: 6, alignSelf: 'stretch', marginTop: spacing.sm },
  miniBtn: { height: 52, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  miniLabel: { fontFamily: fonts.display, fontSize: 13, lineHeight: 16 },
  miniSub: { fontFamily: fonts.mono, fontSize: 10, lineHeight: 13 },
  card: {
    width: 200, backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.sm + 4, alignItems: 'center',
    marginBottom: spacing.md, ...e1,
  },
  well: { width: '100%', height: 112, borderRadius: radii.md, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 56, lineHeight: 68 },
  cardWord: { fontSize: 28, lineHeight: 34, color: colors.inkDark, marginTop: spacing.sm + 4 },
  cardMeaning: { ...type.small, marginBottom: spacing.xs },
  title: { ...type.title, textAlign: 'center', maxWidth: 320 },
  body: { ...type.body, color: colors.inkLight, textAlign: 'center', maxWidth: 300 },
  bottom: { gap: spacing.md },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, minHeight: 20, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.terraLight },
  dotOn: { backgroundColor: colors.terra },
  cta: { alignSelf: 'stretch' },
});
