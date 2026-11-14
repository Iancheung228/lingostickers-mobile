import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import AuthShell, { AuthLink } from '@/components/AuthShell';
import Button from '@/components/ui/Button';
import InlineError from '@/components/ui/InlineError';
import { colors, fonts, radii, spacing } from '@/constants/theme';
import { authActionMessage } from '@/lib/authErrors';

const RESEND_COOLDOWN_SECONDS = 30;

export default function CheckEmailScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const { resendSignupEmail } = useAuth();
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN_SECONDS);
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { if (timerRef.current) clearInterval(timerRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    if (!email || cooldown > 0) return;
    setLoading(true);
    const { error } = await resendSignupEmail(email);
    setLoading(false);
    setMessage(error
      ? { ok: false, text: authActionMessage(error, "Couldn't resend the email. Try again in a minute.") }
      : { ok: true, text: 'Confirmation email resent.' });
    startCooldown();
  };

  // Deliberately not wrapped in AuthIntro: the wordmark fade is the app's
  // first impression, and replaying it one screen later — arrived at by a
  // replace() from sign-up — would read as a restart rather than a step.
  // Deliberately without the wordmark fade: arrived at by a replace() from
  // sign-up, replaying it would read as a restart rather than a step.
  return (
    <AuthShell
      overline="ONE LAST STEP"
      title="Check your email"
      tagline={email ? `We sent a confirmation link to ${email}` : 'We sent you a confirmation link'}
      intro={false}
    >
      {message && (
        <View style={styles.block}>
          {message.ok ? (
            <View style={styles.ok} accessibilityLiveRegion="polite">
              <Text style={styles.okText} maxFontSizeMultiplier={2}>{message.text}</Text>
            </View>
          ) : (
            <InlineError message={message.text} />
          )}
        </View>
      )}

      <Text style={styles.hint} maxFontSizeMultiplier={2}>Confirm it, then come back and sign in.</Text>

      <Button
        label={cooldown > 0 ? `Resend email (${cooldown}s)` : 'Resend Email'}
        onPress={handleResend}
        disabled={cooldown > 0}
        loading={loading}
      />

      <View style={styles.foot}>
        <AuthLink prefix="Back to" accent="Sign In" onPress={() => router.replace('/(auth)/sign-in')} />
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: spacing.ms },
  ok: { backgroundColor: colors.successLight, borderRadius: radii.md, padding: spacing.ms },
  okText: { fontFamily: fonts.text, fontSize: 14, lineHeight: 20, color: colors.success },
  hint: { fontFamily: fonts.text, fontSize: 16, lineHeight: 24, color: colors.inkMid, textAlign: 'center', marginBottom: spacing.md },
  foot: { alignItems: 'center', marginTop: spacing.sm },
});
