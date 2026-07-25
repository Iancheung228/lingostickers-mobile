import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import AuthIntro from '@/components/AuthIntro';
import { colors, typography, shadows, radii, spacing, fonts } from '@/constants/theme';

export default function SignInScreen() {
  const { signIn, resendSignupEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const isFormValid = email.trim().length > 0 && password.length > 0;

  const handleSignIn = async () => {
    if (!isFormValid) return;
    setError(null);
    setUnconfirmed(false);
    setResendMessage(null);
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) {
      if (error.message === 'Email not confirmed') {
        setUnconfirmed(true);
      } else {
        setError(error.message);
      }
    }
  };

  const handleResend = async () => {
    setLoading(true);
    const { error } = await resendSignupEmail(email.trim());
    setLoading(false);
    setResendMessage(error ? error.message : 'Confirmation email resent.');
  };

  return (
    <AuthIntro>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>WELCOME BACK</Text>
            <Text style={styles.title}>Lingo</Text>
            <Text style={styles.tagline}>Learn words from the world around you.</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {unconfirmed && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>Please confirm your email before signing in.</Text>
                <TouchableOpacity onPress={handleResend} disabled={loading}>
                  <Text style={styles.errorLink}>Resend confirmation email</Text>
                </TouchableOpacity>
              </View>
            )}

            {resendMessage && (
              <View style={styles.messageBox}>
                <Text style={styles.messageText}>{resendMessage}</Text>
              </View>
            )}

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.inkFaint}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.inkFaint}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <Link href="/(auth)/forgot-password" asChild>
              <TouchableOpacity style={styles.forgotButton}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            </Link>

            <TouchableOpacity
              style={[styles.button, (!isFormValid || loading) && styles.buttonDisabled]}
              onPress={handleSignIn}
              disabled={!isFormValid || loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={colors.card} />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <Link href="/(auth)/sign-up" asChild>
              <TouchableOpacity style={styles.linkButton}>
                <Text style={styles.linkText}>
                  Don't have an account?{'  '}
                  <Text style={styles.linkAccent}>Sign Up</Text>
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuthIntro>
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
    gap: 6,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 44,
    fontFamily: fonts.cozy,
    color: colors.inkDark,
    letterSpacing: -1,
  },
  tagline: {
    ...typography.body,
    color: colors.inkMid,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    backgroundColor: colors.sky,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.inkDark,
    marginBottom: spacing.ms,
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
  buttonDisabled: {
    backgroundColor: colors.terraLight,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  forgotButton: { alignItems: 'flex-end', marginBottom: spacing.md },
  forgotText: { color: colors.terra, fontSize: 13, fontWeight: '700' },
  linkButton: { alignItems: 'center' },
  linkText: { color: colors.inkLight, fontSize: 14 },
  linkAccent: { color: colors.terra, fontWeight: '700' },
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
  errorLink: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.inkDark,
    textDecorationLine: 'underline',
    marginTop: spacing.xs,
  },
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
});
