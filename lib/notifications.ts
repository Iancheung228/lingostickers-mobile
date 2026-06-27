import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// Request permission, get the Expo push token, and upsert it into push_tokens.
// Safe to call on every app launch — the UNIQUE constraint makes it idempotent.
export async function registerPushToken(userId: string): Promise<string | null> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('challenges', {
      name: 'Challenges',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#A7D7C5',
    });
  }

  let token: string;
  try {
    const { data: tokenData } = await Notifications.getExpoPushTokenAsync();
    token = tokenData;
  } catch (error) {
    console.warn('Skipping push token registration:', error);
    return null;
  }

  await supabase
    .from('push_tokens')
    .upsert({ user_id: userId, token }, { onConflict: 'user_id,token' });

  return token;
}
