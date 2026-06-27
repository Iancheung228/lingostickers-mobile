import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import CozyBackground from '@/components/CozyBackground';
import { colors, shadows, radii, spacing, typography } from '@/constants/theme';

export default function ResetPasswordScreen() {
  const { updatePassword, session, clearPasswordRecovery } = useAuth();
  const { error: linkError } = useLocalSearchParams<{ error?: string }>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isFormValid =
    password.length >= 6 && confirmPassword.length >= 6 && password === confirmPassword;

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
            <TextInput
              style={styles.input}
              placeholder="New password (min 6 characters)"
              placeholderTextColor={colors.inkFaint}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!success}
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm new password"
              placeholderTextColor={colors.inkFaint}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              editable={!success}
            />

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
                <Link href="/(auth)/forgot-password" asChild>
                  <TouchableOpacity>
                    <Text style={styles.errorLink}>Request a new link</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            )}

            {success && (
              <View style={styles.messageBox}>
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
    marginBottom: spacing.sm,
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
    gap: spacing.xs,
  },
  errorText: { fontSize: 14, fontWeight: '600', color: colors.error },
  errorLink: { fontSize: 13, fontWeight: '700', color: colors.inkDark, textDecorationLine: 'underline' },
});
