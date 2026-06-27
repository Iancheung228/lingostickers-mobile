import { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as Linking from 'expo-linking';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import { useAuth, AuthProvider } from '@/hooks/useAuth';
import { FriendsProvider } from '@/hooks/useFriends';
import { ChallengesProvider } from '@/hooks/useChallenges';
import { configureNotificationHandler, registerPushToken } from '@/lib/notifications';
import { handleAuthDeepLink } from '@/lib/deepLinks';

function RootLayout() {
  const { session, loading, isPasswordRecovery } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const notifListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    configureNotificationHandler();
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
    } else if (session && !inTabsGroup) {
      router.replace('/(tabs)/collection');
    }
  }, [session, loading, segments, isPasswordRecovery]);

  useEffect(() => {
    if (!session?.user?.id) return;

    registerPushToken(session.user.id);

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

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

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
