import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// The daily review reminder (SPEC "Daily reminder"): a local notification that
// repeats at a chosen time. JS-only (expo-notifications is already installed),
// off by default, and permission is asked only at the moment it is switched on.
// Nothing leaves the device and nothing needs a server.

export interface ReminderSettings { enabled: boolean; hour: number; minute: number }
export const DEFAULT_REMINDER: ReminderSettings = { enabled: false, hour: 9, minute: 0 };

const KEY = 'tabi.reminder.v1';
const ID_KEY = 'tabi.reminder.id.v1';

export async function loadReminder(): Promise<ReminderSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_REMINDER;
    const r = JSON.parse(raw);
    const hour = Number(r.hour), minute = Number(r.minute);
    return {
      enabled: r.enabled === true,
      hour: Number.isInteger(hour) && hour >= 0 && hour < 24 ? hour : DEFAULT_REMINDER.hour,
      minute: Number.isInteger(minute) && minute >= 0 && minute < 60 ? minute : DEFAULT_REMINDER.minute,
    };
  } catch {
    return DEFAULT_REMINDER;
  }
}

async function save(r: ReminderSettings) {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(r)); } catch { /* the schedule itself is the truth */ }
}

export type ReminderPermission = 'granted' | 'denied';

/** Asks for notification permission only if the system still lets us. */
export async function ensureReminderPermission(): Promise<ReminderPermission> {
  const cur = await Notifications.getPermissionsAsync();
  if (cur.status === 'granted') return 'granted';
  if (!cur.canAskAgain) return 'denied';
  const asked = await Notifications.requestPermissionsAsync();
  return asked.status === 'granted' ? 'granted' : 'denied';
}

export async function isReminderPermitted(): Promise<boolean> {
  return (await Notifications.getPermissionsAsync()).status === 'granted';
}

async function cancelScheduled() {
  try {
    const id = await AsyncStorage.getItem(ID_KEY);
    if (id) await Notifications.cancelScheduledNotificationAsync(id);
  } catch { /* nothing scheduled */ }
}

/** Replaces any existing reminder with one at hour:minute every day. */
export async function scheduleReminder(hour: number, minute: number): Promise<void> {
  await cancelScheduled();
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Daily review reminder',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Time to review',
      body: 'Your Tabi cards are ready. A few minutes is enough.',
      data: { type: 'review-reminder' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
    },
  });
  await AsyncStorage.setItem(ID_KEY, id);
  await save({ enabled: true, hour, minute });
}

export async function disableReminder(hour: number, minute: number): Promise<void> {
  await cancelScheduled();
  try { await AsyncStorage.removeItem(ID_KEY); } catch { /* ignore */ }
  await save({ enabled: false, hour, minute });
}

export function formatReminderTime(hour: number, minute: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}
