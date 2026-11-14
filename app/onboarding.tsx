import { useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, CalendarCheck } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import Button from '@/components/ui/Button';
import { markOnboardingDone } from '@/lib/onboarding';
import { haptic } from '@/lib/haptics';
import { useMotion } from '@/lib/motion';
import { colors, e1, radii, spacing, type, wordFontFor, GUTTER } from '@/constants/theme';

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

function Visual({ page }: { page: number }) {
  if (page === 1) {
    return (
      <View style={styles.card} accessible={false} importantForAccessibility="no-hide-descendants">
        <View style={styles.well}><Text style={styles.emoji}>🍎</Text></View>
        <Text style={[styles.cardWord, { fontFamily: wordFontFor('fr') }]}>la pomme</Text>
        <Text style={styles.cardMeaning}>apple</Text>
      </View>
    );
  }
  const Icon = page === 0 ? Camera : CalendarCheck;
  return (
    <View style={styles.disc} accessible={false} importantForAccessibility="no-hide-descendants">
      <Icon size={44} strokeWidth={1.75} color={colors.inkDark} />
    </View>
  );
}

export default function OnboardingScreen() {
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.sky, paddingHorizontal: GUTTER },
  top: { alignItems: 'flex-end', minHeight: 44 },
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  disc: {
    width: 120, height: 120, borderRadius: 60, backgroundColor: colors.sand, alignItems: 'center',
    justifyContent: 'center', marginBottom: spacing.md,
  },
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
