import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>LingoStickers</Text>
        <Text style={styles.subtitle}>Sign in to your collection</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#9E9E9E"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#9E9E9E"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

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

        <Link href="/(auth)/forgot-password" asChild>
          <TouchableOpacity style={styles.forgotButton}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>
        </Link>

        <TouchableOpacity
          style={[styles.button, !isFormValid && styles.buttonDisabled]}
          onPress={handleSignIn}
          disabled={!isFormValid || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <Link href="/(auth)/sign-up" asChild>
          <TouchableOpacity style={styles.linkButton}>
            <Text style={styles.linkText}>Don't have an account? <Text style={styles.linkAccent}>Sign Up</Text></Text>
          </TouchableOpacity>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F0E8' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  title: { fontSize: 36, fontWeight: '800', color: '#1A1A2E', textAlign: 'center', marginBottom: 8 },
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
  errorLink: { fontSize: 13, fontWeight: '700', color: '#1A1A2E', textDecorationLine: 'underline', marginTop: 6 },
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
  forgotButton: { alignItems: 'flex-end', marginBottom: 16 },
  forgotText: { color: '#A7D7C5', fontSize: 14, fontWeight: '700' },
  linkButton: { alignItems: 'center' },
  linkText: { color: '#6B7280', fontSize: 14 },
  linkAccent: { color: '#A7D7C5', fontWeight: '700' },
});
