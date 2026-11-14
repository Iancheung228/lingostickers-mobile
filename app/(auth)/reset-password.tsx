import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import AuthShell, { AuthLink } from '@/components/AuthShell';
import PasswordField from '@/components/PasswordField';
import Button from '@/components/ui/Button';
import InlineError from '@/components/ui/InlineError';
import { colors, fonts, radii, spacing } from '@/constants/theme';
import { authActionMessage } from '@/lib/authErrors';
import { haptic } from '@/lib/haptics';

export default function ResetPasswordScreen() {
  const { updatePassword, session, clearPasswordRecovery, signOut } = useAuth();
  // Set by the root layout when the emailed link couldn't be used. Only its
  // presence matters: the copy is ours, never the server's.
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
  // A disabled button with no stated reason is worse than an error, so the
  // mismatch is said once the second field is long enough to be a real attempt.
  const mismatch = confirmPassword.length >= 6 && password !== confirmPassword;

  const handleUpdate = async () => {
    if (!isFormValid || loading) return;
    setError(null);
    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);
    if (error) {
      haptic.error();
      setError(authActionMessage(error, "Couldn't update your password. The link may have expired. Request a new one."));
      return;
    }
    clearPasswordRecovery();
    setSuccess(true);
  };

  // The recovery session exists only to set a new password, so cancel signs it
  // out rather than leaving the user half-authenticated.
  const handleCancel = async () => {
    clearPasswordRecovery();
    await signOut();
    router.replace('/(auth)/sign-in');
  };

  if (linkError) {
    return (
      <AuthShell title="Link Expired" tagline="That reset link has expired or was already used." intro={false}>
        <Button label="Request a New Link" onPress={() => router.replace('/(auth)/forgot-password')} />
        <View style={styles.foot}>
          <AuthLink prefix="Back to" accent="Sign In" onPress={() => router.replace('/(auth)/sign-in')} />
        </View>
      </AuthShell>
    );
  }

  if (!session) {
    return (
      <AuthShell title="New Password" tagline="Verifying your link…" intro={false}>
        <View style={styles.wait}><ActivityIndicator size="large" color={colors.terra} /></View>
        <View style={styles.foot}>
          <AuthLink prefix="Back to" accent="Sign In" onPress={handleCancel} />
        </View>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="New Password" tagline="Choose a new password for your account" intro={false}>
      <PasswordField
        placeholder="New password (min 6 characters)"
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
        placeholder="Confirm new password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        editable={!success}
        error={mismatch ? "Those two don't match yet." : null}
        textContentType="newPassword"
        autoComplete="new-password"
        returnKeyType="go"
        onSubmitEditing={handleUpdate}
      />

      {error && (
        <View style={styles.block}>
          <InlineError message={error} onRetry={() => router.replace('/(auth)/forgot-password')} retryLabel="Request a new link" />
        </View>
      )}

      {success ? (
        <View style={styles.done} accessibilityLiveRegion="polite">
          <Text style={styles.doneText} maxFontSizeMultiplier={2}>Password updated. Taking you to your collection…</Text>
        </View>
      ) : (
        <Button label="Update Password" onPress={handleUpdate} disabled={!isFormValid} loading={loading} />
      )}

      {!success && (
        <View style={styles.foot}>
          <AuthLink prefix="Back to" accent="Sign In" onPress={handleCancel} />
        </View>
      )}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: spacing.ms },
  wait: { alignItems: 'center', paddingVertical: spacing.lg },
  done: { backgroundColor: colors.successLight, borderRadius: radii.md, padding: spacing.ms },
  doneText: { fontFamily: fonts.text, fontSize: 14, lineHeight: 20, color: colors.success },
  foot: { alignItems: 'center', marginTop: spacing.sm },
});
