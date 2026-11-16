import { useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Camera } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useUsernameAvailability } from '@/hooks/useUsernameAvailability';
import { supabase } from '@/lib/supabase';
import { isValidUsername, normalizeUsername } from '@/lib/username';
import { pickAvatarImage, uploadAvatar } from '@/lib/avatars';
import { stashPendingAvatar, clearPendingAvatar } from '@/lib/pendingAvatar';
import { signUpIssue, isEmail, type AuthIssue } from '@/lib/authErrors';
import AuthShell, { AuthLink } from '@/components/AuthShell';
import PasswordField from '@/components/PasswordField';
import Field from '@/components/ui/Field';
import Button from '@/components/ui/Button';
import InlineError from '@/components/ui/InlineError';
import { Language } from '@/lib/types';
import { haptic } from '@/lib/haptics';
import { fonts, radii, spacing, wordFontFor, MIN_TAP } from '@/constants/theme';
// The one question this form asks that isn't a credential.
import { LANGUAGES as LANGUAGE_CHOICES } from '@/lib/languages';
import { useTheme, useThemedStyles, type Theme } from '@/hooks/useTheme';

// No terms page is published yet (tabistickers.com/terms.html is a 404), so the line
// links only the privacy policy. Set this to the URL once the page exists and the
// line becomes "Terms and Privacy Policy".
const TERMS_URL: string | null = null;
const PRIVACY_URL = 'https://tabistickers.com/privacy.html';

export default function SignUpScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
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
  const [issue, setIssue] = useState<AuthIssue | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);
  // Three fields in a row, so each return key hands on to the next and the
  // last one submits — rather than every one of them just closing the
  // keyboard over the field you were about to fill in.
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const usernameValid = isValidUsername(username);
  // An invalid name is never sent for an availability check.
  const usernameAvailability = useUsernameAvailability(usernameValid ? username : '');

  const isFormValid =
    usernameValid &&
    isEmail(email) &&
    password.length >= 6 &&
    usernameAvailability !== 'taken';
  const emailError = issue?.field === 'email'
    ? issue.message
    : emailTouched && email.length > 0 && !isEmail(email) ? 'Enter a valid email address.' : null;
  const clearIssue = (field: AuthIssue['field']) => { if (issue && (issue.field === field || issue.field === 'form')) setIssue(null); };

  const handlePickAvatar = async () => {
    const picked = await pickAvatarImage();
    if (picked) setAvatarUri(picked.uri);
  };

  const handleSignUp = async () => {
    if (!isFormValid) return;
    setIssue(null);
    setLoading(true);
    const { data, error } = await signUp(email.trim(), password, username.trim(), language);
    if (error) {
      setLoading(false);
      haptic.error();
      setIssue(signUpIssue(error));
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

    // With a session the root layout takes it from here (first run goes to
    // onboarding); without one the account waits on its confirmation email.
    if (data?.session) return;
    router.replace({ pathname: '/(auth)/check-email', params: { email: email.trim() } });
  };

  const usernameError = username.length > 0 && !usernameValid
    ? 'Use 3–20 letters, numbers, _ or .'
    : usernameValid && usernameAvailability === 'taken' ? 'Username taken'
    : issue?.field === 'username' ? issue.message : null;
  const usernameHint = usernameValid && usernameAvailability === 'checking' ? 'Checking…'
    : usernameValid && usernameAvailability === 'available' ? 'Username available' : undefined;

  return (
    <AuthShell overline="CREATE ACCOUNT" title="Tabi Stickers" tagline="Create your collection">
      {issue?.field === 'form' && (
        <View style={styles.block}><InlineError message={issue.message} /></View>
      )}

      {/* Asked for before anything else, because it's the one field people
          answer with a face rather than a keyboard. Optional: skipping it just
          leaves the tinted initial. */}
      <View style={styles.avatarBlock}>
        <Pressable
          onPress={handlePickAvatar}
          style={styles.avatarButton}
          accessibilityRole="button"
          accessibilityLabel={avatarUri ? 'Change your profile picture' : 'Add a profile picture'}
        >
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} contentFit="cover" style={styles.avatarImage} />
          ) : (
            <Camera size={24} strokeWidth={1.75} color={colors.terraInk} />
          )}
        </Pressable>
        <Text style={styles.avatarHint} maxFontSizeMultiplier={2}>
          {avatarUri ? 'Tap to change your photo' : 'Add a profile picture (optional)'}
        </Text>
      </View>

      {/* Before the credentials on purpose: this is the one field that decides
          what the app is *for*. Endonyms lead, set in the learning face. */}
      <Text style={styles.fieldLabel} maxFontSizeMultiplier={2}>I want to learn</Text>
      <View style={styles.langRow} accessibilityRole="radiogroup">
        {LANGUAGE_CHOICES.map(({ code, native, label }) => {
          const active = language === code;
          return (
            <Pressable
              key={code}
              style={[styles.langPill, active && styles.langPillActive]}
              onPress={() => { haptic.select(); setLanguage(code); }}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Learn ${label}`}
            >
              <Text style={[styles.langNative, { fontFamily: wordFontFor(code) }, active && styles.langTextActive]} maxFontSizeMultiplier={1.3}>
                {native}
              </Text>
              <Text style={[styles.langLabel, active && styles.langTextActive]} maxFontSizeMultiplier={1.3}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Field
        placeholder="Username"
        value={username}
        onChangeText={(t) => { setUsername(normalizeUsername(t)); clearIssue('username'); }}
        error={usernameError}
        hint={usernameHint}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="nickname"
        autoComplete="username-new"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => emailRef.current?.focus()}
      />
      <Field
        ref={emailRef}
        placeholder="Email"
        value={email}
        onChangeText={(t) => { setEmail(t); clearIssue('email'); }}
        onBlur={() => setEmailTouched(true)}
        error={emailError}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      {/* `newPassword` is what makes iOS offer to generate and save a strong one
          here rather than treating it as a login box. The rule is shown up front. */}
      <PasswordField
        ref={passwordRef}
        placeholder="Password"
        value={password}
        onChangeText={(t) => { setPassword(t); clearIssue('password'); }}
        error={issue?.field === 'password' ? issue.message : null}
        hint="At least 6 characters."
        textContentType="newPassword"
        autoComplete="new-password"
        returnKeyType="go"
        onSubmitEditing={handleSignUp}
      />

      <Text style={styles.terms} maxFontSizeMultiplier={2}>
        By creating an account you agree to the{' '}
        {TERMS_URL ? (
          <>
            <Text style={styles.termsLink} accessibilityRole="link" onPress={() => Linking.openURL(TERMS_URL)}>Terms</Text>
            {' and '}
          </>
        ) : null}
        <Text style={styles.termsLink} accessibilityRole="link" onPress={() => Linking.openURL(PRIVACY_URL)}>Privacy Policy</Text>.
      </Text>

      <Button label="Create Account" onPress={handleSignUp} disabled={!isFormValid} loading={loading} />

      <View style={styles.foot}>
        <AuthLink prefix="Already have an account?" accent="Sign In" onPress={() => router.replace('/(auth)/sign-in')} />
      </View>
    </AuthShell>
  );
}

const makeStyles = ({ colors }: Theme) => StyleSheet.create({
  block: { marginBottom: spacing.ms },
  avatarBlock: { alignItems: 'center', gap: 6, marginBottom: spacing.md },
  avatarButton: {
    width: 84, height: 84, borderRadius: radii.full, backgroundColor: colors.terraLight,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarHint: { fontFamily: fonts.text, fontSize: 14, lineHeight: 20, color: colors.inkLight },
  fieldLabel: { fontFamily: fonts.display, fontSize: 14, lineHeight: 20, color: colors.inkLight, marginBottom: spacing.sm },
  langRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  langPill: {
    flex: 1, minHeight: MIN_TAP + 12, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm,
    borderRadius: radii.md, borderWidth: 1, borderColor: colors.ctl, backgroundColor: colors.card, gap: 1,
  },
  langPillActive: { borderColor: colors.terra, backgroundColor: colors.terra },
  langNative: { fontSize: 17, lineHeight: 24, color: colors.inkDark },
  langLabel: { fontFamily: fonts.text, fontSize: 14, lineHeight: 18, color: colors.inkLight },
  langTextActive: { color: colors.white },
  terms: { fontFamily: fonts.text, fontSize: 14, lineHeight: 20, color: colors.inkLight, textAlign: 'center', marginBottom: spacing.md },
  termsLink: { fontFamily: fonts.display, color: colors.terraInk, textDecorationLine: 'underline' },
  foot: { alignItems: 'center', marginTop: spacing.sm },
});
