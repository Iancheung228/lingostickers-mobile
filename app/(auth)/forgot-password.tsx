import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import CozyBackground from '@/components/CozyBackground';
import { colors, shadows, radii, spacing, typography, fonts } from '@/constants/theme';
import { debugWarn } from '@/lib/debug';

export default function ForgotPasswordScreen() {
  const { resetPasswordForEmail, verifyRecoveryOtp } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  const isFormValid = email.trim().length > 0;
  const isCodeValid = code.trim().length > 0;

  const handleSend = async () => {
    if (!isFormValid) return;
    setLoading(true);
    const { error } = await resetPasswordForEmail(email.trim());
    setLoading(false);
    if (error) debugWarn('resetPasswordForEmail error:', error.message);
    // Reported as sent either way, deliberately: saying "no such account"
    // here would turn this box into a way to test which addresses are
    // registered.
    if (sent) setResent(true);
    setSent(true);
  };

  // Once the code has been sent, this screen used to have exactly two exits:
  // type the right code, or go back to sign-in and start over. A code that
  // never arrives, or an address with a typo in it, had no route out — so
  // both are offered below the field.
  const handleUseDifferentEmail = () => {
    setSent(false);
    setCode('');
    setVerifyError(null);
    setResent(false);
  };

  const handleVerify = async () => {
    if (!isCodeValid) return;
    setVerifyError(null);
    setVerifying(true);
    const { error } = await verifyRecoveryOtp(email.trim(), code.trim());
    setVerifying(false);
    if (error) {
      setVerifyError('That code is invalid or expired. Check the latest email and try again.');
    }
  };

  return (
    <CozyBackground variant="full">
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.inner}>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            {sent ? 'Enter the code we emailed you' : "We'll email you a code to reset it"}
          </Text>

          <View style={styles.card}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.inkFaint}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              returnKeyType="send"
              onSubmitEditing={handleSend}
              editable={!sent}
            />

            {!sent && (
              <TouchableOpacity
                style={[styles.button, (!isFormValid || loading) && styles.buttonDisabled]}
                onPress={handleSend}
                disabled={!isFormValid || loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color={colors.card} />
                ) : (
                  <Text style={styles.buttonText}>Send Reset Code</Text>
                )}
              </TouchableOpacity>
            )}

            {sent && (
              <>
                <View style={styles.messageBox} accessibilityLiveRegion="polite">
                  <Text style={styles.messageText}>
                    If an account exists for that email, we sent a code. Check your inbox.
                  </Text>
                </View>

                {/* oneTimeCode is what puts the code from the email onto the
                    keyboard's suggestion bar, so it can be filled with one
                    tap instead of memorised and typed back in. */}
                <TextInput
                  style={styles.input}
                  placeholder="Code from email"
                  placeholderTextColor={colors.inkFaint}
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  autoFocus
                  returnKeyType="go"
                  onSubmitEditing={handleVerify}
                />

                {verifyError && (
                  <View style={styles.errorBox} accessibilityRole="alert" accessibilityLiveRegion="polite">
                    <Text style={styles.errorText}>{verifyError}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.button, (!isCodeValid || verifying) && styles.buttonDisabled]}
                  onPress={handleVerify}
                  disabled={!isCodeValid || verifying}
                  activeOpacity={0.8}
                >
                  {verifying ? (
                    <ActivityIndicator color={colors.card} />
                  ) : (
                    <Text style={styles.buttonText}>Verify Code</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.recoveryRow}>
                  <TouchableOpacity onPress={handleSend} disabled={loading} hitSlop={8}>
                    <Text style={[styles.recoveryLink, loading && styles.recoveryLinkBusy]}>
                      {resent ? 'Code sent again' : 'Send another code'}
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.recoveryDot}>·</Text>
                  <TouchableOpacity onPress={handleUseDifferentEmail} hitSlop={8}>
                    <Text style={styles.recoveryLink}>Use a different email</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <Link href="/(auth)/sign-in" asChild>
              <TouchableOpacity style={styles.linkButton}>
                <Text style={styles.linkText}>Back to <Text style={styles.linkAccent}>Sign In</Text></Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </CozyBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.lg },
  title: {
    fontSize: 34,
    fontFamily: fonts.display,
    color: colors.inkDark,
    textAlign: 'center',
    marginBottom: spacing.sm,
    letterSpacing: -0.5,
  },
  subtitle: {
    ...typography.body,
    color: colors.inkMid,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: spacing.lg,
    ...shadows.card,
  },
  input: { backgroundColor: colors.sky, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: 14, fontSize: 15, fontFamily: fonts.text, color: colors.inkDark, marginBottom: spacing.md, borderWidth: 1.5, borderColor: colors.border, },
  button: {
    backgroundColor: colors.terra,
    borderRadius: radii.lg,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.xs,
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
  messageText: { fontSize: 14, fontFamily: fonts.display, color: colors.success },
  recoveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  recoveryLink: { fontSize: 13, fontFamily: fonts.display, color: colors.terra },
  recoveryLinkBusy: { color: colors.inkFaint },
  recoveryDot: { fontSize: 13, color: colors.inkFaint },
  errorBox: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.md,
    backgroundColor: colors.errorLight,
    borderWidth: 1.5,
    borderColor: colors.error,
  },
  errorText: { fontSize: 14, fontFamily: fonts.display, color: colors.error },
  linkButton: { alignItems: 'center' },
  linkText: { color: colors.inkLight, fontSize: 14, fontFamily: fonts.text },
  linkAccent: { color: colors.terra, fontFamily: fonts.display },
});
