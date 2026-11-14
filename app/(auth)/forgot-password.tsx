import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import AuthShell, { AuthLink } from '@/components/AuthShell';
import Field from '@/components/ui/Field';
import Button from '@/components/ui/Button';
import InlineError from '@/components/ui/InlineError';
import { colors, fonts, radii, spacing } from '@/constants/theme';
import { authActionMessage, isEmail } from '@/lib/authErrors';
import { isNetworkError } from '@/lib/friendlyError';
import { debugWarn } from '@/lib/debug';
import { haptic } from '@/lib/haptics';

export default function ForgotPasswordScreen() {
  const { resetPasswordForEmail, verifyRecoveryOtp } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  const isFormValid = isEmail(email);
  const isCodeValid = code.trim().length > 0;

  const handleSend = async () => {
    if (!isFormValid || loading) return;
    setSendError(null);
    setLoading(true);
    const { error } = await resetPasswordForEmail(email.trim());
    setLoading(false);
    if (error) {
      debugWarn('resetPasswordForEmail error:', error.message);
      // Only a network or rate-limit failure is reported. Anything else (an
      // unknown address included) reads as sent, deliberately: saying "no such
      // account" would turn this box into a way to test which addresses exist.
      if (isNetworkError(error) || /rate limit|too many/i.test(error.message)) {
        haptic.error();
        setSendError(authActionMessage(error, "Couldn't send the code. Try again."));
        return;
      }
    }
    if (sent) setResent(true);
    setSent(true);
  };

  // Once the code has been sent, a code that never arrives or an address with a
  // typo needs a way out besides starting over from sign-in.
  const handleUseDifferentEmail = () => {
    setSent(false);
    setCode('');
    setVerifyError(null);
    setResent(false);
  };

  const handleVerify = async () => {
    if (!isCodeValid || verifying) return;
    setVerifyError(null);
    setVerifying(true);
    const { error } = await verifyRecoveryOtp(email.trim(), code.trim());
    setVerifying(false);
    if (error) {
      haptic.error();
      setVerifyError(
        isNetworkError(error)
          ? authActionMessage(error, '')
          : 'That code is invalid or expired. Check the latest email and try again.',
      );
    }
  };

  return (
    <AuthShell
      title="Reset Password"
      tagline={sent ? 'Enter the code we emailed you' : "We'll email you a code to reset it"}
    >
      {sendError && <View style={styles.block}><InlineError message={sendError} /></View>}

      <Field
        placeholder="Email"
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

      {!sent && <Button label="Send Reset Code" onPress={handleSend} disabled={!isFormValid} loading={loading} />}

      {sent && (
        <>
          <View style={styles.sentNote} accessibilityLiveRegion="polite">
            <Text style={styles.sentText} maxFontSizeMultiplier={2}>
              If an account exists for that email, we sent a code. Check your inbox.
            </Text>
          </View>

          {/* oneTimeCode puts the emailed code on the keyboard's suggestion bar. */}
          <Field
            placeholder="Code from email"
            value={code}
            onChangeText={setCode}
            error={verifyError}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            autoFocus
            returnKeyType="go"
            onSubmitEditing={handleVerify}
          />

          <Button label="Verify Code" onPress={handleVerify} disabled={!isCodeValid} loading={verifying} />

          <View style={styles.recovery}>
            <Button
              kind="tertiary"
              label={resent ? 'Code sent again' : 'Send another code'}
              onPress={handleSend}
              disabled={loading}
            />
            <Button kind="tertiary" label="Use a different email" onPress={handleUseDifferentEmail} />
          </View>
        </>
      )}

      <View style={styles.foot}>
        <AuthLink prefix="Back to" accent="Sign In" onPress={() => router.replace('/(auth)/sign-in')} />
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: spacing.ms },
  sentNote: { backgroundColor: colors.successLight, borderRadius: radii.md, padding: spacing.ms, marginBottom: spacing.ms },
  sentText: { fontFamily: fonts.text, fontSize: 14, lineHeight: 20, color: colors.success },
  recovery: { alignItems: 'center', marginTop: spacing.sm },
  foot: { alignItems: 'center', marginTop: spacing.sm },
});
