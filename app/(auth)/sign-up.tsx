import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { Link, useRouter } from 'expo-router';
import { Camera } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useUsernameAvailability } from '@/hooks/useUsernameAvailability';
import { supabase } from '@/lib/supabase';
import { pickAvatarImage, uploadAvatar } from '@/lib/avatars';
import { stashPendingAvatar, clearPendingAvatar } from '@/lib/pendingAvatar';
import AuthIntro from '@/components/AuthIntro';
import { Language } from '@/lib/types';
import { colors, typography, shadows, radii, spacing, fonts, wordFontFor } from '@/constants/theme';
// The one question this form asks that isn't a credential.
import { LANGUAGES as LANGUAGE_CHOICES } from '@/lib/languages';

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
  // Local file URI only. There is no session yet at this point, and storage
  // writes are gated on auth.uid() matching the folder — so the photo can't
  // go anywhere until the account is real. See handleSignUp.
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  // Defaulted rather than left empty: 'fr' is what the column has always
  // defaulted to, so a pre-selected pill changes nothing for someone who
  // ignores it, and gives everyone else something to change.
  const [language, setLanguage] = useState<Language>('fr');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const usernameAvailability = useUsernameAvailability(username);

  const isFormValid =
    username.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 6 &&
    usernameAvailability !== 'taken';

  const handlePickAvatar = async () => {
    const picked = await pickAvatarImage();
    if (picked) setAvatarUri(picked.uri);
  };

  const handleSignUp = async () => {
    if (!isFormValid) return;
    setMessage(null);
    setLoading(true);
    const { data, error } = await signUp(email.trim(), password, username.trim(), language);
    if (error) {
      setLoading(false);
      setMessage({ type: 'error', text: friendlySignUpError(error.message) });
      return;
    }

    // Two ways out, depending on whether email confirmation is required.
    // With a session in hand the picture can go up right now; without one the
    // account doesn't exist yet, so it's parked and uploaded on the first
    // launch that does have a session (see lib/pendingAvatar.ts). Either way
    // a failed picture must never fail the sign-up — the account is made.
    if (avatarUri && data?.session?.user) {
      try {
        const path = await uploadAvatar(data.session.user.id, avatarUri);
        await supabase.from('profiles').update({ avatar_path: path }).eq('id', data.session.user.id);
        await clearPendingAvatar();
      } catch {
        await stashPendingAvatar(avatarUri);
      }
    } else if (avatarUri) {
      await stashPendingAvatar(avatarUri);
    }
    setLoading(false);

    if (data?.session) {
      setMessage({ type: 'success', text: 'Account created! Welcome to Tabi Stickers.' });
      return;
    }
    router.replace({ pathname: '/(auth)/check-email', params: { email: email.trim() } });
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
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>CREATE ACCOUNT</Text>
            <Text style={styles.title}>Tabi Stickers</Text>
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

            {/* Asked for before anything else, because it's the one field
                people answer with a face rather than a keyboard — and the one
                that makes a friend recognisable everywhere else in the app.
                Optional: skipping it just leaves the tinted initial. */}
            <View style={styles.avatarBlock}>
              <TouchableOpacity
                onPress={handlePickAvatar}
                activeOpacity={0.8}
                style={styles.avatarButton}
                accessibilityRole="button"
                accessibilityLabel={avatarUri ? 'Change your profile picture' : 'Add a profile picture'}
              >
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} contentFit="cover" style={styles.avatarImage} />
                ) : (
                  <Camera size={22} color={colors.terra} />
                )}
                <View style={styles.avatarBadge}>
                  <Camera size={11} color={colors.white} />
                </View>
              </TouchableOpacity>
              <Text style={styles.avatarHint}>
                {avatarUri ? 'Tap to change your photo' : 'Add a profile picture (optional)'}
              </Text>
            </View>

            {/* Before the credentials on purpose. This is the only field that
                decides what the app is *for*, and burying it under the
                password made it read as a setting rather than the choice it
                is. */}
            <Text style={styles.fieldLabel}>I WANT TO LEARN</Text>
            <View style={styles.langRow}>
              {LANGUAGE_CHOICES.map(({ code, native, label }) => {
                const active = language === code;
                return (
                  <TouchableOpacity
                    key={code}
                    style={[styles.langPill, active && styles.langPillActive]}
                    onPress={() => setLanguage(code)}
                    activeOpacity={0.85}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`Learn ${label}`}
                  >
                    <Text
                      style={[
                        styles.langPillNative,
                        { fontFamily: wordFontFor(code) },
                        active && styles.langPillTextActive,
                      ]}
                    >
                      {native}
                    </Text>
                    <Text style={[styles.langPillLabel, active && styles.langPillTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

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
    fontSize: 36,
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
  },
  card: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarBlock: { alignItems: 'center', gap: 6, marginBottom: spacing.md },
  fieldLabel: { fontSize: 11, fontFamily: fonts.monoBold, color: colors.inkFaint, letterSpacing: 1.2, marginBottom: spacing.sm, },
  langRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  langPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: 4,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: 1,
  },
  langPillActive: { borderColor: colors.terra, backgroundColor: colors.terraLight },
  langPillNative: { fontSize: 15, color: colors.inkDark },
  langPillLabel: { fontSize: 10, fontFamily: fonts.mono, color: colors.inkLight },
  langPillTextActive: { color: colors.terra },
  avatarButton: {
    width: 84,
    height: 84,
    borderRadius: radii.full,
    backgroundColor: colors.sky,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  avatarImage: { width: '100%', height: '100%', borderRadius: radii.full },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: radii.full,
    backgroundColor: colors.terra,
    borderWidth: 2,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHint: { fontSize: 12, fontFamily: fonts.display, color: colors.inkLight },
  input: { backgroundColor: colors.sky, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: 14, fontSize: 15, fontFamily: fonts.text, color: colors.inkDark, marginBottom: spacing.ms, borderWidth: 1.5, borderColor: colors.border, },
  usernameHint: { fontSize: 12, fontFamily: fonts.display, color: colors.inkFaint, marginTop: -spacing.sm, marginBottom: spacing.sm, marginLeft: spacing.xs, },
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
  buttonText: { color: colors.card, fontSize: 16, fontFamily: fonts.display, letterSpacing: 0.3 },
  linkButton: { alignItems: 'center' },
  linkText: { color: colors.inkLight, fontSize: 14, fontFamily: fonts.text },
  linkAccent: { color: colors.terra, fontFamily: fonts.display },
  messageBox: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.md,
    borderWidth: 1.5,
  },
  messageError: { backgroundColor: colors.errorLight, borderColor: colors.error },
  messageSuccess: { backgroundColor: colors.successLight, borderColor: colors.success },
  messageText: { fontSize: 14, fontFamily: fonts.display,},
  messageErrorText: { color: colors.error },
  messageSuccessText: { color: colors.success },
});
