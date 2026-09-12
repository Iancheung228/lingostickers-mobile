import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TAB_BAR_CLEARANCE } from '@/constants/tabBar';
import { colors, fonts, radii, shadows, spacing } from '@/constants/theme';
import { AI_PROCESSORS } from '@/lib/aiConsent';

// ---------------------------------------------------------------------------
// The disclosure App Store Guideline 5.1.2(i) requires, shown once before the
// first scan. See lib/aiConsent.ts for the rule and why it lives here.
//
// Deliberately light. This screen stands between a person and the thing they
// opened the app to do, so every extra sentence is a tax on the whole product
// — and a wall of text is *worse* disclosure, not better, because nobody reads
// it. Each processor gets one line: who, and what they do with the photo.
//
// Three things must survive a redesign, because they are the guideline:
//  * ONE affirmative button. No pre-ticked box, no "by continuing you agree",
//    and no route to the camera around it.
//  * Each processor NAMED beside what it does. "We use AI services" is not a
//    disclosure.
//  * No dismiss control. Declining is real and means no scanner; the other
//    tabs stay reachable so the existing collection still works.
//
// TAB_BAR_CLEARANCE is load-bearing: this renders inside the tab navigator,
// over a floating tab bar. Without it the button sits behind the bar, which
// looks exactly like a screen with no way out of it.
// ---------------------------------------------------------------------------

const PRIVACY_URL = 'https://tabistickers.com/privacy.html';

export function AiConsentGate({ onAccept }: { onAccept: () => void }) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>One quick thing</Text>
        <Text style={styles.intro}>To turn your photo into a sticker, we send it to:</Text>

        <View style={styles.list}>
          {AI_PROCESSORS.map((processor) => (
            <View key={processor.name} style={styles.row}>
              <Text style={styles.name}>{processor.name}</Text>
              <Text style={styles.does}>{processor.short}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.terms}>
          That&rsquo;s all they do with it. Your photos are never used to train AI, sold, or used
          for ads.
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.button}
          onPress={onAccept}
          accessibilityRole="button"
          accessibilityLabel="Agree and start scanning"
        >
          <Text style={styles.buttonText}>Agree &amp; Start Scanning</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => Linking.openURL(PRIVACY_URL)}
          accessibilityRole="link"
          accessibilityLabel="Read the privacy policy"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.link}>Privacy policy</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sky },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  title: {
    fontSize: 26,
    fontFamily: fonts.display,
    color: colors.inkDark,
    marginBottom: spacing.xs,
  },
  intro: {
    fontSize: 15,
    fontFamily: fonts.text,
    color: colors.inkMid,
    marginBottom: spacing.lg,
  },
  list: { gap: spacing.md, marginBottom: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  name: { fontSize: 15, fontFamily: fonts.display, color: colors.inkDark, minWidth: 84 },
  does: { flex: 1, fontSize: 14, fontFamily: fonts.text, color: colors.inkLight, lineHeight: 19 },
  terms: {
    fontSize: 13,
    fontFamily: fonts.text,
    color: colors.inkLight,
    lineHeight: 19,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    // Clears the floating tab bar this screen renders behind.
    paddingBottom: TAB_BAR_CLEARANCE,
    gap: spacing.md,
    alignItems: 'center',
  },
  button: {
    alignSelf: 'stretch',
    backgroundColor: colors.terra,
    borderRadius: radii.lg,
    paddingVertical: 15,
    alignItems: 'center',
    ...shadows.button,
  },
  buttonText: { color: colors.card, fontSize: 16, fontFamily: fonts.display },
  link: { fontSize: 13, fontFamily: fonts.text, color: colors.inkLight, textDecorationLine: 'underline' },
});
