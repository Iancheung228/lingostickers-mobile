import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useUsernameAvailability } from '@/hooks/useUsernameAvailability';

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
    // Email confirmation is off — session returned, root layout will redirect automatically
    if (data?.session) {
      setMessage({ type: 'success', text: 'Account created! Welcome to LingoStickers.' });
      return;
    }
    // Email confirmation is on — send them to the dedicated check-email screen
    router.replace({ pathname: '/(auth)/check-email', params: { email: email.trim() } });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>LingoStickers</Text>
        <Text style={styles.subtitle}>Create your collection</Text>

        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor="#9E9E9E"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        {usernameAvailability !== 'idle' && (
          <Text
            style={[
              styles.usernameHint,
              usernameAvailability === 'taken' && styles.usernameHintTaken,
              usernameAvailability === 'available' && styles.usernameHintAvailable,
            ]}
          >
            {usernameAvailability === 'checking' && 'Checking…'}
            {usernameAvailability === 'available' && 'Username available'}
            {usernameAvailability === 'taken' && 'Username taken'}
          </Text>
        )}
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
          placeholder="Password (min 6 characters)"
          placeholderTextColor="#9E9E9E"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {message && (
          <View style={[styles.messageBox, message.type === 'error' ? styles.messageError : styles.messageSuccess]}>
            <Text style={[styles.messageText, message.type === 'error' ? styles.messageErrorText : styles.messageSuccessText]}>
              {message.text}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, !isFormValid && styles.buttonDisabled]}
          onPress={handleSignUp}
          disabled={!isFormValid || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Create Account</Text>
          )}
        </TouchableOpacity>

        <Link href="/(auth)/sign-in" asChild>
          <TouchableOpacity style={styles.linkButton}>
            <Text style={styles.linkText}>Already have an account? <Text style={styles.linkAccent}>Sign In</Text></Text>
          </TouchableOpacity>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F0E8' },
  inner: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 48 },
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
  usernameHint: { fontSize: 12, fontWeight: '600', color: '#9E9E9E', marginTop: -10, marginBottom: 14, marginLeft: 4 },
  usernameHintAvailable: { color: '#2F855A' },
  usernameHintTaken: { color: '#EF4444' },
  messageBox: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  messageError: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
  messageSuccess: { backgroundColor: '#E6F4EA', borderColor: '#A7D7C5' },
  messageText: { fontSize: 14, fontWeight: '600' },
  messageErrorText: { color: '#EF4444' },
  messageSuccessText: { color: '#2F855A' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  linkButton: { alignItems: 'center' },
  linkText: { color: '#6B7280', fontSize: 14 },
  linkAccent: { color: '#A7D7C5', fontWeight: '700' },
});
