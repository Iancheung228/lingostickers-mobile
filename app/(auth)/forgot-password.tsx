import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

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
    // Log for debugging only — never show the raw error in the UI, since
    // that would let this screen be used to check which emails are registered.
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
      return;
    }
    // The PASSWORD_RECOVERY auth event fires from this and the root layout's
    // effect routes to reset-password — no explicit navigation needed here.
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>
          {sent ? 'Enter the code from the email we sent' : "We'll email you a code to reset it"}
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#9E9E9E"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!sent}
        />

        {!sent && (
          <TouchableOpacity
            style={[styles.button, !isFormValid && styles.buttonDisabled]}
            onPress={handleSend}
            disabled={!isFormValid || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
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
              placeholderTextColor="#9E9E9E"
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
              style={[styles.button, !isCodeValid && styles.buttonDisabled]}
              onPress={handleVerify}
              disabled={!isCodeValid || verifying}
            >
              {verifying ? (
                <ActivityIndicator color="#fff" />
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F0E8' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  title: { fontSize: 32, fontWeight: '800', color: '#1A1A2E', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#6B7280', textAlign: 'center', marginBottom: 40 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1A1A2E',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  button: {
    backgroundColor: '#A7D7C5',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  buttonDisabled: { backgroundColor: '#C9C9C9' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  messageBox: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    backgroundColor: '#E6F4EA',
    borderColor: '#A7D7C5',
  },
  messageText: { fontSize: 14, fontWeight: '600', color: '#2F855A' },
  errorBox: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  errorText: { fontSize: 14, fontWeight: '600', color: '#EF4444' },
  linkButton: { alignItems: 'center' },
  linkText: { color: '#6B7280', fontSize: 14 },
  linkAccent: { color: '#A7D7C5', fontWeight: '700' },
});
