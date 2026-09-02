import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { colors, shadows, radii, spacing, typography, fonts } from '@/constants/theme';

const RESEND_COOLDOWN_SECONDS = 30;

export default function CheckEmailScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const { resendSignupEmail } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
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
    setMessage(error ? error.message : 'Confirmation email resent.');
    startCooldown();
  };

  // Deliberately not wrapped in AuthIntro: the wordmark fade is the app's
  // first impression, and replaying it one screen later — arrived at by a
  // replace() from sign-up — would read as a restart rather than a step.
  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>ONE LAST STEP</Text>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.tagline}>
            We sent a confirmation link to{'\n'}
            <Text style={styles.email}>{email}</Text>
          </Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          {message && (
            <View style={styles.messageBox}>
              <Text style={styles.messageText}>{message}</Text>
            </View>
          )}

          <Text style={styles.hint}>Confirm it, then come back and sign in.</Text>

          <TouchableOpacity
            style={[styles.button, cooldown > 0 && styles.buttonDisabled]}
            onPress={handleResend}
            disabled={cooldown > 0 || loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={colors.card} />
            ) : (
              <Text style={styles.buttonText}>
                {cooldown > 0 ? `Resend email (${cooldown}s)` : 'Resend Email'}
              </Text>
            )}
          </TouchableOpacity>

          <Link href="/(auth)/sign-in" asChild>
            <TouchableOpacity style={styles.linkButton}>
              <Text style={styles.linkText}>Back to <Text style={styles.linkAccent}>Sign In</Text></Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.sky },
  scroll: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingBottom: spacing.xl,
  },
  hero: {
    alignItems: 'center',
    paddingTop: spacing.xxl + spacing.md,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    gap: 6,
  },
  eyebrow: { fontSize: 11, fontFamily: fonts.monoBold, color: colors.inkFaint, letterSpacing: 2, textTransform: 'uppercase', },
  title: {
    fontSize: 36,
    fontFamily: fonts.display,
    color: colors.inkDark,
    textAlign: 'center',
    letterSpacing: -1,
  },
  tagline: {
    ...typography.body,
    color: colors.inkMid,
    textAlign: 'center',
    lineHeight: 24,
  },
  email: { fontFamily: fonts.display, color: colors.inkDark },
  card: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hint: { fontSize: 13, fontFamily: fonts.text, color: colors.inkLight, textAlign: 'center', marginBottom: spacing.md, },
  button: {
    backgroundColor: colors.terra,
    borderRadius: radii.lg,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadows.button,
  },
  buttonDisabled: { backgroundColor: colors.terraLight, shadowOpacity: 0, elevation: 0 },
  buttonText: { color: colors.card, fontSize: 16, fontFamily: fonts.display, letterSpacing: 0.3 },
  messageBox: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.md,
    backgroundColor: colors.successLight,
    borderWidth: 1.5,
    borderColor: colors.success,
  },
  messageText: { fontSize: 14, fontFamily: fonts.display, color: colors.success, textAlign: 'center' },
  linkButton: { alignItems: 'center' },
  linkText: { color: colors.inkLight, fontSize: 14, fontFamily: fonts.text },
  linkAccent: { color: colors.terra, fontFamily: fonts.display },
});
