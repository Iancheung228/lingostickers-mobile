import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AuthIntro from '@/components/AuthIntro';
import { colors, fonts, radii, spacing, type } from '@/constants/theme';

interface AuthShellProps {
  /** The one allowed mono overline ("WELCOME BACK"). */
  overline?: string;
  title: string;
  /** One line under the title. Non-interactive: flows tap it to dismiss the keyboard. */
  tagline?: string;
  children: ReactNode;
  /** Skip the wordmark fade (screens reached by replace() from another auth screen). */
  intro?: boolean;
}

// C-look 6 "Auth / onboarding": the wordmark in the rose band, the form on the
// cream page, the primary button last, links as tertiary. The band is fixed (it
// stays put when the keyboard opens), so the overline and tagline stay on screen
// and tappable to dismiss the keyboard. No card around the fields: they are white
// with their own `ctl` border, directly on the page.
export default function AuthShell({ overline, title, tagline, children, intro = true }: AuthShellProps) {
  const insets = useSafeAreaInsets();
  const body = (
    <View style={styles.root}>
      <View style={[styles.band, { paddingTop: insets.top + spacing.md }]}>
        {overline ? <Text style={styles.overline} maxFontSizeMultiplier={1.15}>{overline}</Text> : null}
        <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.3}>{title}</Text>
        {tagline ? <Text style={styles.tagline} maxFontSizeMultiplier={1.5}>{tagline}</Text> : null}
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.lg }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
  return intro ? <AuthIntro>{body}</AuthIntro> : body;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.sky },
  flex: { flex: 1 },
  band: {
    backgroundColor: colors.blush,
    borderBottomLeftRadius: radii.lg,
    borderBottomRightRadius: radii.lg,
    paddingHorizontal: 20,
    paddingBottom: spacing.md + 4,
    gap: 2,
  },
  overline: { ...type.overline, color: colors.maroon },
  title: { ...type.title, color: colors.maroon },
  tagline: { ...type.small, color: colors.maroon },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: spacing.lg },
});

/** "Already have an account?  Sign In": a tertiary 44pt link with an accented tail. */
export function AuthLink({ prefix, accent, onPress, testID }: { prefix: string; accent: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={`${prefix} ${accent}`}
      style={linkStyles.link}
    >
      <Text style={linkStyles.text} maxFontSizeMultiplier={1.5}>
        {prefix}{'  '}<Text style={linkStyles.accent}>{accent}</Text>
      </Text>
    </Pressable>
  );
}

const linkStyles = StyleSheet.create({
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  text: { fontFamily: fonts.text, fontSize: 16, lineHeight: 22, color: colors.inkLight },
  accent: { fontFamily: fonts.display, color: colors.terra },
});
