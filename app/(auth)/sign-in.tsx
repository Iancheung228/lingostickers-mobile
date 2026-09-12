import { useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import PasswordField from '@/components/PasswordField';
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
  // So the email field's return key can hand over instead of dismissing the
  // keyboard and leaving the password box untouched two rows below it.
  const passwordRef = useRef<TextInput>(null);

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
            <Text style={styles.title}>Tabi Stickers</Text>
            <Text style={styles.tagline}>Learn words from the world around you.</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            {error && (
              <View style={styles.errorBox} accessibilityRole="alert" accessibilityLiveRegion="polite">
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {unconfirmed && (
              <View style={styles.errorBox} accessibilityRole="alert" accessibilityLiveRegion="polite">
                <Text style={styles.errorText}>Please confirm your email before signing in.</Text>
                <TouchableOpacity onPress={handleResend} disabled={loading}>
                  <Text style={styles.errorLink}>Resend confirmation email</Text>
                </TouchableOpacity>
              </View>
            )}

            {resendMessage && (
              <View style={styles.messageBox} accessibilityLiveRegion="polite">
                <Text style={styles.messageText}>{resendMessage}</Text>
              </View>
            )}

            {/* textContentType/autoComplete are what let iOS's Keychain and
                Android's autofill offer the saved login above the keyboard.
                Without them a returning user has to type an address and a
                password they have never once typed on this device. */}
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.inkFaint}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              autoComplete="email"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <PasswordField
              ref={passwordRef}
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.inkFaint}
              value={password}
              onChangeText={setPassword}
              textContentType="password"
              autoComplete="current-password"
              returnKeyType="go"
              onSubmitEditing={handleSignIn}
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
                  Don&apos;t have an account?{'  '}
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
  eyebrow: { fontSize: 11, fontFamily: fonts.monoBold, color: colors.inkFaint, letterSpacing: 2, textTransform: 'uppercase', },
  title: {
    fontSize: 38,
    fontFamily: fonts.display,
    color: colors.inkDark,
    letterSpacing: -1,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
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
  input: { backgroundColor: colors.sky, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: 14, fontSize: 15, fontFamily: fonts.text, color: colors.inkDark, marginBottom: spacing.ms, borderWidth: 1.5, borderColor: colors.border, },
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
  buttonText: { color: colors.card, fontSize: 16, fontFamily: fonts.display, letterSpacing: 0.3, },
  forgotButton: { alignItems: 'flex-end', marginBottom: spacing.md },
  forgotText: { color: colors.terra, fontSize: 13, fontFamily: fonts.display,},
  linkButton: { alignItems: 'center' },
  linkText: { color: colors.inkLight, fontSize: 14, fontFamily: fonts.text },
  linkAccent: { color: colors.terra, fontFamily: fonts.display },
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
  errorLink: { fontSize: 13, fontFamily: fonts.display, color: colors.inkDark, textDecorationLine: 'underline', marginTop: spacing.xs, },
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
});
