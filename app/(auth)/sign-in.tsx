import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import PasswordField from '@/components/PasswordField';
import AuthShell, { AuthLink } from '@/components/AuthShell';
import Field from '@/components/ui/Field';
import Button from '@/components/ui/Button';
import InlineError from '@/components/ui/InlineError';
import { signInIssue, authActionMessage, isEmail, type AuthIssue } from '@/lib/authErrors';
import { haptic } from '@/lib/haptics';
import { spacing } from '@/constants/theme';

export default function SignInScreen() {
  const { signIn, resendSignupEmail } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [issue, setIssue] = useState<AuthIssue | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  // So the email field's return key can hand over instead of dismissing the
  // keyboard and leaving the password box untouched two rows below it.
  const passwordRef = useRef<TextInput>(null);

  const isFormValid = isEmail(email) && password.length > 0;
  const emailError = emailTouched && email.length > 0 && !isEmail(email) ? 'Enter a valid email address.' : null;

  const handleSignIn = async () => {
    if (!isFormValid || loading) return;
    setIssue(null);
    setUnconfirmed(false);
    setResendMessage(null);
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) {
      haptic.error();
      if (error.message === 'Email not confirmed') setUnconfirmed(true);
      else setIssue(signInIssue(error));
    }
  };

  const handleResend = async () => {
    setLoading(true);
    const { error } = await resendSignupEmail(email.trim());
    setLoading(false);
    setResendMessage(error ? authActionMessage(error, "Couldn't resend the email. Try again in a minute.") : 'Confirmation email resent.');
  };

  return (
    <AuthShell overline="WELCOME BACK" title="Tabi Stickers" tagline="Learn words from the world around you.">
      {unconfirmed && (
        <View style={styles.block}>
          <InlineError
            message="Please confirm your email before signing in."
            onRetry={handleResend}
            retryLabel="Resend confirmation email"
          />
        </View>
      )}
      {resendMessage && (
        <View style={styles.block}>
          <InlineError message={resendMessage} />
        </View>
      )}
      {issue?.field === 'form' && (
        <View style={styles.block}><InlineError message={issue.message} /></View>
      )}

      {/* textContentType/autoComplete are what let iOS's Keychain and Android's
          autofill offer the saved login above the keyboard (lesson 11). */}
      <Field
        placeholder="Email"
        value={email}
        onChangeText={(t) => { setEmail(t); if (issue) setIssue(null); }}
        onBlur={() => setEmailTouched(true)}
        error={emailError}
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
        placeholder="Password"
        value={password}
        onChangeText={(t) => { setPassword(t); if (issue) setIssue(null); }}
        error={issue?.field === 'password' ? issue.message : null}
        textContentType="password"
        autoComplete="current-password"
        returnKeyType="go"
        onSubmitEditing={handleSignIn}
      />

      <View style={styles.forgot}>
        <Button kind="tertiary" label="Forgot password?" onPress={() => router.push('/(auth)/forgot-password')} />
      </View>

      <Button label="Sign In" onPress={handleSignIn} disabled={!isFormValid} loading={loading} />

      <View style={styles.foot}>
        <AuthLink prefix="Don't have an account?" accent="Sign Up" onPress={() => router.push('/(auth)/sign-up')} />
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: spacing.ms },
  forgot: { alignItems: 'flex-end', marginBottom: spacing.sm },
  foot: { alignItems: 'center', marginTop: spacing.sm },
});
