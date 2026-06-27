import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import CozyBackground from '@/components/CozyBackground';
import OtterMascot from '@/components/illustrations/OtterMascot';
import { colors, shadows, radii, spacing, typography } from '@/constants/theme';

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

  return (
    <CozyBackground variant="full">
      <View style={styles.inner}>
        <OtterMascot size={120} variant="sleeping" />

        <Text style={styles.title}>Check Your Email</Text>
        <Text style={styles.subtitle}>
          We sent a confirmation link to{'\n'}
          <Text style={styles.email}>{email}</Text>
        </Text>
        <Text style={styles.hint}>Confirm it, then come back and sign in.</Text>

        <View style={styles.card}>
          {message && (
            <View style={styles.messageBox}>
              <Text style={styles.messageText}>{message}</Text>
            </View>
          )}

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
      </View>
    </CozyBackground>
  );
}

const styles = StyleSheet.create({
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.inkDark,
    textAlign: 'center',
    letterSpacing: -0.5,
    fontStyle: 'italic',
  },
  subtitle: {
    ...typography.body,
    color: colors.inkMid,
    textAlign: 'center',
    lineHeight: 24,
  },
  email: { fontWeight: '700', color: colors.inkDark },
  hint: {
    fontSize: 13,
    color: colors.inkFaint,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  card: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: spacing.lg,
    ...shadows.card,
  },
  button: {
    backgroundColor: colors.terra,
    borderRadius: radii.lg,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadows.button,
  },
  buttonDisabled: { backgroundColor: colors.terraLight, shadowOpacity: 0, elevation: 0 },
  buttonText: { color: colors.card, fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  messageBox: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.md,
    backgroundColor: colors.successLight,
    borderWidth: 1.5,
    borderColor: colors.success,
  },
  messageText: { fontSize: 14, fontWeight: '600', color: colors.success, textAlign: 'center' },
  linkButton: { alignItems: 'center' },
  linkText: { color: colors.inkLight, fontSize: 14 },
  linkAccent: { color: colors.terra, fontWeight: '700' },
});
