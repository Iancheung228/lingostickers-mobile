import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_CLEARANCE } from '@/constants/tabBar';
import { colors, e2, fonts, radii, spacing, type } from '@/constants/theme';
import Button from '@/components/ui/Button';
import { haptic } from '@/lib/haptics';
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
//  * No dismiss through the scrim. Declining is real ("Not now" leaves the
//    scanner); the other tabs stay reachable so the collection still works.
//
// R5: a sheet over the live camera instead of a page. It is an in-screen
// overlay, not a Modal, so the floating tab bar stays reachable.
//
// TAB_BAR_CLEARANCE is load-bearing: this renders inside the tab navigator,
// over a floating tab bar. Without it the button sits behind the bar, which
// looks exactly like a screen with no way out of it.
// ---------------------------------------------------------------------------

const PRIVACY_URL = 'https://tabistickers.com/privacy.html';

export function AiConsentGate({
  onAccept,
  onNotNow,
  agree_testID,
  privacy_testID,
}: {
  onAccept: () => void;
  onNotNow?: () => void;
  agree_testID?: string;
  privacy_testID?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* The scrim does not dismiss: this gates the feature. */}
      <View style={styles.scrim} />
      <View style={[styles.sheet, { bottom: insets.bottom + TAB_BAR_CLEARANCE + 8 }]}>
        <ScrollView showsVerticalScrollIndicator={false} bounces={false} style={styles.scroll}>
          <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.3}>One quick thing</Text>
          <Text style={styles.intro} maxFontSizeMultiplier={2}>To turn your photo into a sticker, we send it to:</Text>

          <View style={styles.list}>
            {AI_PROCESSORS.map((processor) => (
              <View key={processor.name} style={styles.row}>
                <Text style={styles.name} maxFontSizeMultiplier={1.5}>{processor.name}</Text>
                <Text style={styles.does} maxFontSizeMultiplier={2}>{processor.short}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.terms} maxFontSizeMultiplier={2}>
            That&rsquo;s all they do with it. Your photos are never used to train AI, sold, or used
            for ads.
          </Text>
        </ScrollView>

        <Button
          label="Agree & Start Scanning"
          accessibilityLabel="Agree and start scanning"
          testID={agree_testID}
          onPress={() => { haptic.success(); onAccept(); }}
        />
        <View style={styles.links}>
          {onNotNow && (
            <TouchableOpacity
              onPress={onNotNow}
              testID="scan-consent-not-now"
              accessibilityRole="button"
              accessibilityLabel="Not now"
              style={styles.linkHit}
            >
              <Text style={styles.linkStrong}>Not now</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => Linking.openURL(PRIVACY_URL)}
            testID={privacy_testID}
            accessibilityRole="link"
            accessibilityLabel="Read the privacy policy"
            style={styles.linkHit}
          >
            <Text style={styles.link}>Privacy policy</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.scrim },
  sheet: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.sky,
    borderRadius: radii.lg,
    padding: spacing.md,
    paddingTop: spacing.lg,
    gap: spacing.md,
    maxHeight: '75%',
    ...e2,
  },
  scroll: { flexGrow: 0 },
  title: { ...type.h2, marginBottom: spacing.xs },
  intro: { ...type.body, marginBottom: spacing.ms },
  list: { gap: spacing.ms, marginBottom: spacing.ms },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  name: { fontSize: 16, fontFamily: fonts.display, color: colors.inkDark, minWidth: 84 },
  does: { flex: 1, ...type.small, color: colors.inkMid },
  terms: { ...type.small },
  links: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg },
  linkHit: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.sm },
  linkStrong: { fontSize: 16, fontFamily: fonts.display, color: colors.inkDark },
  link: { ...type.small, textDecorationLine: 'underline' },
});
