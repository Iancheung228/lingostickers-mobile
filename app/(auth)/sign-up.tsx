import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useUsernameAvailability } from '@/hooks/useUsernameAvailability';
import CozyBackground from '@/components/CozyBackground';
import OtterMascot from '@/components/illustrations/OtterMascot';
import { colors, typography, shadows, radii, spacing } from '@/constants/theme';

function friendlySignUpError(message: string): string {
  if (message.includes('already registered')) {
    return 'An account with that email already exists. Try signing in instead.';
  }
  if (message.includes('Database error saving new user')) {
    return 'That username may have just been taken — try a different one.';
  }
  return message;
}

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const usernameAvailability = useUsernameAvailability(username);

  const isFormValid =
    username.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 6 &&
    usernameAvailability !== 'taken';

  const handleSignUp = async () => {
    if (!isFormValid) return;
    setMessage(null);
    setLoading(true);
    const { data, error } = await signUp(email.trim(), password, username.trim());
    setLoading(false);
    if (error) {
      setMessage({ type: 'error', text: friendlySignUpError(error.message) });
      return;
    }
    if (data?.session) {
      setMessage({ type: 'success', text: 'Account created! Welcome to Lingo.' });
      return;
    }
    router.replace({ pathname: '/(auth)/check-email', params: { email: email.trim() } });
  };

  return (
    <CozyBackground variant="full">
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <OtterMascot size={120} variant="sleeping" />
            <Text style={styles.title}>Join Lingo</Text>
            <Text style={styles.tagline}>Create your collection</Text>
          </View>

          <View style={styles.card}>
            {message && (
              <View style={[
                styles.messageBox,
                message.type === 'error' ? styles.messageError : styles.messageSuccess,
              ]}>
                <Text style={[
                  styles.messageText,
                  message.type === 'error' ? styles.messageErrorText : styles.messageSuccessText,
                ]}>
                  {message.text}
                </Text>
              </View>
            )}

            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor={colors.inkFaint}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
            {usernameAvailability !== 'idle' && (
              <Text style={[
                styles.usernameHint,
                usernameAvailability === 'taken' && styles.usernameHintTaken,
                usernameAvailability === 'available' && styles.usernameHintAvailable,
              ]}>
                {usernameAvailability === 'checking' && 'Checking…'}
                {usernameAvailability === 'available' && 'Username available'}
                {usernameAvailability === 'taken' && 'Username taken'}
              </Text>
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
              placeholder="Password (min 6 characters)"
              placeholderTextColor={colors.inkFaint}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <TouchableOpacity
              style={[styles.button, (!isFormValid || loading) && styles.buttonDisabled]}
              onPress={handleSignUp}
              disabled={!isFormValid || loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={colors.card} />
              ) : (
                <Text style={styles.buttonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            <Link href="/(auth)/sign-in" asChild>
              <TouchableOpacity style={styles.linkButton}>
                <Text style={styles.linkText}>
                  Already have an account?{'  '}
                  <Text style={styles.linkAccent}>Sign In</Text>
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </CozyBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingBottom: spacing.xl,
  },
  hero: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    color: colors.inkDark,
    letterSpacing: -1,
    fontStyle: 'italic',
  },
  tagline: {
    ...typography.body,
    color: colors.inkMid,
    textAlign: 'center',
  },
  card: {
    marginHorizontal: spacing.lg,
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
    marginBottom: spacing.sm + 4,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  usernameHint: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkFaint,
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  usernameHintAvailable: { color: colors.success },
  usernameHintTaken: { color: colors.error },
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
  buttonText: { color: colors.card, fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  linkButton: { alignItems: 'center' },
  linkText: { color: colors.inkLight, fontSize: 14 },
  linkAccent: { color: colors.terra, fontWeight: '700' },
  messageBox: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.md,
    borderWidth: 1.5,
  },
  messageError: { backgroundColor: colors.errorLight, borderColor: colors.error },
  messageSuccess: { backgroundColor: colors.successLight, borderColor: colors.success },
  messageText: { fontSize: 14, fontWeight: '600' },
  messageErrorText: { color: colors.error },
  messageSuccessText: { color: colors.success },
});
