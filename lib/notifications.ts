import * as Notifications from 'expo-notifications';
import { Alert, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { debugWarn } from './debug';

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

// ---------------------------------------------------------------------------
// When we are allowed to ask
//
// iOS shows the system permission dialog exactly once per install. Whatever
// the user taps is final: a "Don't Allow" can never be undone from inside the
// app, only from Settings, which nobody visits. So the single most important
// property of this module is *when* the ask happens.
//
// It used to fire from a session effect in the root layout — meaning the
// dialog appeared within seconds of signing up, before the user had scanned
// anything or discovered that friends and challenges exist. Declining is the
// obvious response to a request you have no context for, and every challenge
// and friend request after that is silent. That is the entire social loop,
// spent on a prompt shown at the worst possible moment.
//
// Split in two instead:
//   syncPushToken       — silent. Registers only if permission was already
//                         granted. Safe on every launch, never prompts.
//   enablePushNotifications — explains first, then asks. Called from the
//                         moments where a notification is obviously the point.
// ---------------------------------------------------------------------------

async function storeToken(userId: string): Promise<string | null> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('challenges', {
      name: 'Challenges',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#E4A0A1',
    });
  }

  let token: string;
  try {
    const { data: tokenData } = await Notifications.getExpoPushTokenAsync();
    token = tokenData;
  } catch (error) {
    debugWarn('Skipping push token registration:', error);
    return null;
  }

  // Idempotent — the UNIQUE constraint on (user_id, token) makes re-running
  // this on every launch a no-op.
  await supabase
    .from('push_tokens')
    .upsert({ user_id: userId, token }, { onConflict: 'user_id,token' });

  return token;
}

/**
 * Refresh this device's push token, without ever showing a permission dialog.
 *
 * Call on launch. For a user who has already allowed notifications this keeps
 * their token current (tokens can rotate); for everyone else it does nothing
 * at all, leaving the one prompt we get unspent.
 */
export async function syncPushToken(userId: string): Promise<string | null> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return null;
  return storeToken(userId);
}

/**
 * Ask for notification permission, at a moment where it makes sense.
 *
 * Shows our own explanation first. That pre-prompt is the point: if the user
 * says "Not now" to *ours*, the system dialog is never spent and we can ask
 * again next time. Only a yes here reaches the real, irreversible one.
 *
 * Returns true if notifications are enabled by the time it resolves.
 */
export async function enablePushNotifications(userId: string): Promise<boolean> {
  const { status: existing, canAskAgain } = await Notifications.getPermissionsAsync();

  if (existing === 'granted') {
    await storeToken(userId);
    return true;
  }

  // Already declined at the system level — asking again is a no-op that
  // silently resolves to denied, so don't pretend otherwise.
  if (!canAskAgain) return false;

  const wants = await new Promise<boolean>((resolve) => {
    Alert.alert(
      'Get notified?',
      "We'll let you know when a friend sends you a challenge or accepts your request. Nothing else — no reminders, no marketing.",
      [
        { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Notify me', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
  if (!wants) return false;

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return false;

  await storeToken(userId);
  return true;
}
