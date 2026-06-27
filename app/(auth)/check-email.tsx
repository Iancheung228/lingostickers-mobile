import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

const RESEND_COOLDOWN_SECONDS = 30;

export default function CheckEmailScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const { resendSignupEmail } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN_SECONDS);
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    if (!email || cooldown > 0) return;
    setLoading(true);
    const { error } = await resendSignupEmail(email);
    setLoading(false);
    setMessage(error ? error.message : 'Confirmation email resent.');
    startCooldown();
  };

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.title}>Check Your Email</Text>
        <Text style={styles.subtitle}>
          We sent a confirmation link to{'\n'}
          <Text style={styles.email}>{email}</Text>
        </Text>
        <Text style={styles.hint}>Confirm it, then come back and sign in.</Text>

        {message && (
          <View style={styles.messageBox}>
            <Text style={styles.messageText}>{message}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, cooldown > 0 && styles.buttonDisabled]}
          onPress={handleResend}
          disabled={cooldown > 0 || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {cooldown > 0 ? `Resend email (${cooldown}s)` : 'Resend Email'}
            </Text>
          )}
        </TouchableOpacity>

        <Link href="/(auth)/sign-in" asChild>
          <TouchableOpacity style={styles.linkButton}>
            <Text style={styles.linkText}>Back to <Text style={styles.linkAccent}>Sign In</Text></Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F0E8' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  title: { fontSize: 30, fontWeight: '800', color: '#1A1A2E', textAlign: 'center', marginBottom: 16 },
  subtitle: { fontSize: 16, color: '#6B7280', textAlign: 'center', marginBottom: 4, lineHeight: 22 },
  email: { fontWeight: '700', color: '#1A1A2E' },
  hint: { fontSize: 14, color: '#9E9E9E', textAlign: 'center', marginBottom: 32 },
  button: {
    backgroundColor: '#A7D7C5',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
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
  messageText: { fontSize: 14, fontWeight: '600', color: '#2F855A', textAlign: 'center' },
  linkButton: { alignItems: 'center' },
  linkText: { color: '#6B7280', fontSize: 14 },
  linkAccent: { color: '#A7D7C5', fontWeight: '700' },
});
