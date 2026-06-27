import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import CozyBackground from '@/components/CozyBackground';
import { colors, shadows, radii, spacing, typography } from '@/constants/theme';

export default function ForgotPasswordScreen() {
  const { resetPasswordForEmail, verifyRecoveryOtp } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const isFormValid = email.trim().length > 0;
  const isCodeValid = code.trim().length > 0;

  const handleSend = async () => {
    if (!isFormValid) return;
    setLoading(true);
    const { error } = await resetPasswordForEmail(email.trim());
    setLoading(false);
    if (error) console.warn('resetPasswordForEmail error:', error.message);
    setSent(true);
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
              keyboardType="email-address"
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
                <View style={styles.messageBox}>
                  <Text style={styles.messageText}>
                    If an account exists for that email, we sent a code. Check your inbox.
                  </Text>
                </View>

                <TextInput
                  style={styles.input}
                  placeholder="Code from email"
                  placeholderTextColor={colors.inkFaint}
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                />

                {verifyError && (
                  <View style={styles.errorBox}>
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
    fontWeight: '800',
    color: colors.inkDark,
    textAlign: 'center',
    marginBottom: spacing.sm,
    letterSpacing: -0.5,
    fontStyle: 'italic',
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
  input: {
    backgroundColor: colors.sky,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.inkDark,
    marginBottom: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
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
  messageText: { fontSize: 14, fontWeight: '600', color: colors.success },
  errorBox: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.md,
    backgroundColor: colors.errorLight,
    borderWidth: 1.5,
    borderColor: colors.error,
  },
  errorText: { fontSize: 14, fontWeight: '600', color: colors.error },
  linkButton: { alignItems: 'center' },
  linkText: { color: colors.inkLight, fontSize: 14 },
  linkAccent: { color: colors.terra, fontWeight: '700' },
});
