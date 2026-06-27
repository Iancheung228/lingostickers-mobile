import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

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
    if (error) {
      setError(error.message);
      return;
    }
    // Clearing this lets the root layout's generic redirect effect take over
    // again — no manual sign-out, the new password is active.
    clearPasswordRecovery();
    setSuccess(true);
  };

  // The reset link's code exchange happens in the root layout and is async,
  // so this screen can mount (via expo-router's own URL-based navigation)
  // before a session exists. Distinguish "still exchanging" from "link is
  // dead" so the form is never shown without a session behind it.
  if (linkError) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.inner}>
          <Text style={styles.title}>Link Expired</Text>
          <Text style={styles.subtitle}>{linkError}</Text>
          <Link href="/(auth)/forgot-password" asChild>
            <TouchableOpacity style={styles.button}>
              <Text style={styles.buttonText}>Request a New Link</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </KeyboardAvoidingView>
    );
  }

  if (!session) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.inner}>
          <ActivityIndicator size="large" color="#A7D7C5" />
          <Text style={[styles.subtitle, { marginTop: 16 }]}>Verifying your link…</Text>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Set New Password</Text>
        <Text style={styles.subtitle}>Choose a new password for your account</Text>

        <TextInput
          style={styles.input}
          placeholder="New password (min 6 characters)"
          placeholderTextColor="#9E9E9E"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!success}
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm new password"
          placeholderTextColor="#9E9E9E"
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
            style={[styles.button, !isFormValid && styles.buttonDisabled]}
            onPress={handleUpdate}
            disabled={!isFormValid || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Update Password</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F0E8' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  title: { fontSize: 30, fontWeight: '800', color: '#1A1A2E', textAlign: 'center', marginBottom: 8 },
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
    gap: 6,
  },
  errorText: { fontSize: 14, fontWeight: '600', color: '#EF4444' },
  errorLink: { fontSize: 13, fontWeight: '700', color: '#1A1A2E', textDecorationLine: 'underline' },
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
});
