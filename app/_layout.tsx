import { useEffect, useRef } from 'react';
import { AppState, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useRouter, useSegments, type ErrorBoundaryProps } from 'expo-router';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { KosugiMaru_400Regular } from '@expo-google-fonts/kosugi-maru';
import { JetBrainsMono_500Medium, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { useAuth, AuthProvider } from '@/hooks/useAuth';
import { FriendsProvider } from '@/hooks/useFriends';
import { ChallengesProvider } from '@/hooks/useChallenges';
import { configureNotificationHandler, syncPushToken } from '@/lib/notifications';
import { handleAuthDeepLink } from '@/lib/deepLinks';
import { flushPendingAvatar } from '@/lib/pendingAvatar';
import { initAnalytics, trackEvent } from '@/lib/analytics';
import { colors, fonts as themeFonts, radii, spacing, typography } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

// Expo Router renders this instead of the route when a render throws. Without
// it a release build has no redbox to fall back to — the app just quits to the
// home screen with nothing said. Exported from the root layout so it covers
// every route beneath it.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={crashStyles.container}>
      <Text style={crashStyles.title}>Something went wrong</Text>
      <Text style={crashStyles.body}>
        Your stickers are safe — this is just the screen failing to draw. Try again, and if it
        keeps happening, restarting the app will clear it.
      </Text>
      <TouchableOpacity style={crashStyles.button} onPress={retry} activeOpacity={0.85}>
        <Text style={crashStyles.buttonText}>Try Again</Text>
      </TouchableOpacity>
      {__DEV__ && <Text style={crashStyles.detail}>{error.message}</Text>}
    </View>
  );
}

function RootLayout() {
  const { session, loading, isPasswordRecovery } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  // `error` matters as much as `loaded`: useFonts never flips loaded to true
  // after a failure, so gating the splash and the tree on loaded alone turns
  // one failed font into a permanently frozen splash screen. Falling back to
  // system faces is strictly better than never launching.
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    KosugiMaru_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  useEffect(() => {
    configureNotificationHandler();
    initAnalytics();
    trackEvent('app_launched');
  }, []);

  const fontsSettled = fontsLoaded || !!fontError;

  useEffect(() => {
    if (fontsSettled) SplashScreen.hideAsync();
  }, [fontsSettled]);

  // The notification handler sets a badge on every delivery; nothing else
  // ever takes it down, so without this the count on the home screen only
  // ever climbs. Cleared whenever the app comes to the foreground — by then
  // the Friends tab's own badge is the live, accurate count.
  useEffect(() => {
    const clear = () => { Notifications.setBadgeCountAsync(0); };
    clear();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') clear();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const onUrl = async ({ url }: { url: string }) => {
      const { type, error } = await handleAuthDeepLink(url);
      // On success, the PASSWORD_RECOVERY auth event (handled below) takes
      // care of routing to reset-password. Only the failure case needs
      // explicit handling here, since no session/event will follow it.
      if (type === 'recovery' && error) {
        router.replace({ pathname: '/(auth)/reset-password', params: { error: error.message } });
      }
    };

    Linking.getInitialURL().then((url) => { if (url) onUrl({ url }); });
    const sub = Linking.addEventListener('url', onUrl);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';
    // Top-level screens (outside the (tabs) group) that a signed-in user can
    // legitimately be on — pushed from within a tab (e.g. the sticker wall's
    // "open board" flow). Without this, the generic "session -> tabs"
    // redirect below fires on every one of these and instantly bounces the
    // user back to the collection tab.
    const inStandaloneAuthenticatedRoute = ['profile', 'day'].includes(segments[0] as string);
    const onResetPasswordScreen = (segments as string[])[1] === 'reset-password';

    // A recovery session looks identical to a normal sign-in session, so it
    // must be checked first — otherwise the generic "session -> tabs" rule
    // below logs the user in instead of letting them set a new password.
    if (isPasswordRecovery) {
      if (!onResetPasswordScreen) router.replace('/(auth)/reset-password');
      return;
    }

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (session && !inTabsGroup && !inStandaloneAuthenticatedRoute) {
      router.replace('/(tabs)/collection');
    }
  }, [session, loading, segments, isPasswordRecovery]);

  useEffect(() => {
    if (!session?.user?.id) return;

    // Silent — refreshes the token for users who have already opted in, and
    // does nothing for everyone else. The actual ask happens where a
    // notification is obviously the point; see lib/notifications.ts.
    syncPushToken(session.user.id);
    // A profile picture picked during sign-up couldn't be uploaded then —
    // there was no session to authorize the write. This is the first moment
    // there is one. No-ops for everyone else.
    flushPendingAvatar(session.user.id);

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      if (data?.type === 'challenge' || data?.type === 'friend_request' || data?.type === 'friend_accepted') {
        router.push('/(tabs)/friends');
      }
    });

    return () => {
      responseListener.current?.remove();
    };
  }, [session?.user?.id]);

  if (!fontsSettled) return null;

  return (
    <>
      {/* app.json pins userInterfaceStyle to light, and every ground in the
          palette — cream, white, the rose band — is light. Saying so
          explicitly beats inheriting whatever the platform defaults to. */}
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="profile" options={{ presentation: 'card' }} />
        <Stack.Screen name="day/[date]" options={{ presentation: 'card' }} />
      </Stack>
    </>
  );
}

const crashStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sky,
    paddingHorizontal: spacing.xl,
    gap: spacing.ms,
  },
  title: { fontSize: 24, fontFamily: themeFonts.cozy, color: colors.inkDark, textAlign: 'center' },
  body: { ...typography.body, color: colors.inkMid, textAlign: 'center' },
  button: {
    marginTop: spacing.sm,
    backgroundColor: colors.terra,
    borderRadius: radii.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
  },
  buttonText: { color: colors.white, fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
  detail: {
    marginTop: spacing.md,
    fontFamily: themeFonts.mono,
    fontSize: 11,
    color: colors.inkFaint,
    textAlign: 'center',
  },
});

export default function Root() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <FriendsProvider>
          <ChallengesProvider>
            <RootLayout />
          </ChallengesProvider>
        </FriendsProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
