import { useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Link, useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import CozyBackground from '@/components/CozyBackground';
import PasswordField from '@/components/PasswordField';
import { colors, shadows, radii, spacing, typography, fonts } from '@/constants/theme';

export default function ResetPasswordScreen() {
  const { updatePassword, session, clearPasswordRecovery, signOut } = useAuth();
  const { error: linkError } = useLocalSearchParams<{ error?: string }>();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const confirmRef = useRef<TextInput>(null);

  const isFormValid =
    password.length >= 6 && confirmPassword.length >= 6 && password === confirmPassword;
  // The button is disabled until the two match, which on its own is a dead
  // control with no stated reason — the one thing more frustrating than an
  // error is a button that just doesn't respond. Only shown once the second
  // field has enough characters to be a real attempt rather than mid-typing.
  const mismatch = confirmPassword.length >= 6 && password !== confirmPassword;

  const handleUpdate = async () => {
    if (!isFormValid) return;
    setError(null);
    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);
    if (error) { setError(error.message); return; }
    clearPasswordRecovery();
    setSuccess(true);
  };

  // The recovery session is only ever meant to be used to set a new
  // password — leaving it signed in without doing that would strand the
  // user in a half-authenticated state, so cancel signs it out rather than
  // just clearing the flag and leaving.
  const handleCancel = async () => {
    clearPasswordRecovery();
    await signOut();
    router.replace('/(auth)/sign-in');
  };

  if (linkError) {
    return (
      <CozyBackground variant="full">
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.inner}>
            <Text style={styles.title}>Link Expired</Text>
            <Text style={styles.subtitle}>{linkError}</Text>
            <View style={styles.card}>
              <Link href="/(auth)/forgot-password" asChild>
                <TouchableOpacity style={styles.button} activeOpacity={0.8}>
                  <Text style={styles.buttonText}>Request a New Link</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </KeyboardAvoidingView>
      </CozyBackground>
    );
  }

  if (!session) {
    return (
      <CozyBackground variant="full">
        <View style={styles.inner}>
          <ActivityIndicator size="large" color={colors.terra} />
          <Text style={[typography.body, { marginTop: spacing.md, color: colors.inkMid, textAlign: 'center' }]}>
            Verifying your link…
          </Text>
          <TouchableOpacity style={styles.linkButton} onPress={handleCancel}>
            <Text style={styles.linkText}>Back to <Text style={styles.linkAccent}>Sign In</Text></Text>
          </TouchableOpacity>
        </View>
      </CozyBackground>
    );
  }

  return (
    <CozyBackground variant="full">
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.inner}>
          <Text style={styles.title}>New Password</Text>
          <Text style={styles.subtitle}>Choose a new password for your account</Text>

          <View style={styles.card}>
            <PasswordField
              style={styles.input}
              placeholder="New password (min 6 characters)"
              placeholderTextColor={colors.inkFaint}
              value={password}
              onChangeText={setPassword}
              editable={!success}
              textContentType="newPassword"
              autoComplete="new-password"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => confirmRef.current?.focus()}
            />
            <PasswordField
              ref={confirmRef}
              style={styles.input}
              placeholder="Confirm new password"
              placeholderTextColor={colors.inkFaint}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              editable={!success}
              textContentType="newPassword"
              autoComplete="new-password"
              returnKeyType="go"
              onSubmitEditing={handleUpdate}
            />

            {mismatch && (
              <Text style={styles.mismatchHint} accessibilityLiveRegion="polite">
                Those two don&apos;t match yet.
              </Text>
            )}

            {error && (
              <View style={styles.errorBox} accessibilityRole="alert" accessibilityLiveRegion="polite">
                <Text style={styles.errorText}>{error}</Text>
                <Link href="/(auth)/forgot-password" asChild>
                  <TouchableOpacity>
                    <Text style={styles.errorLink}>Request a new link</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            )}

            {success && (
              <View style={styles.messageBox} accessibilityLiveRegion="polite">
                <Text style={styles.messageText}>Password updated! Taking you to your collection…</Text>
              </View>
            )}

            {!success && (
              <TouchableOpacity
                style={[styles.button, (!isFormValid || loading) && styles.buttonDisabled]}
                onPress={handleUpdate}
                disabled={!isFormValid || loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color={colors.card} />
                ) : (
                  <Text style={styles.buttonText}>Update Password</Text>
                )}
              </TouchableOpacity>
            )}

            {!success && (
              <TouchableOpacity style={styles.linkButton} onPress={handleCancel}>
                <Text style={styles.linkText}>Back to <Text style={styles.linkAccent}>Sign In</Text></Text>
              </TouchableOpacity>
            )}
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
    marginBottom: spacing.sm,
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
  mismatchHint: {
    fontSize: 13,
    fontFamily: fonts.text,
    color: colors.error,
    marginTop: -spacing.sm,
    marginBottom: spacing.ms,
  },
  errorBox: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.md,
    backgroundColor: colors.errorLight,
    borderWidth: 1.5,
    borderColor: colors.error,
    gap: spacing.xs,
  },
  errorText: { fontSize: 14, fontFamily: fonts.display, color: colors.error },
  errorLink: { fontSize: 13, fontFamily: fonts.display, color: colors.inkDark, textDecorationLine: 'underline' },
  linkButton: { alignItems: 'center', marginTop: spacing.sm },
  linkText: { color: colors.inkLight, fontSize: 14, fontFamily: fonts.text },
  linkAccent: { color: colors.terra, fontFamily: fonts.display },
});
