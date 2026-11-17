import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { planReminders, type PlannableCard, type ReminderSlot } from '@/lib/reminderPlan';
import { plannableCards } from '@/lib/review';
import { newCardsIntroducedToday, studyPrefsReady, getStudyPrefs } from '@/lib/studyPrefs';
import { supabase } from '@/lib/supabase';
import type { Sticker } from '@/lib/types';

export { planReminders } from '@/lib/reminderPlan';
export type { ReminderSlot, PlannedReminder, PlannableCard } from '@/lib/reminderPlan';

// Review reminders (card spec 4): up to 3 times a day, each a one-shot DATE
// notification planned for the next 7 days by planReminders(), so a day with
// nothing due stays silent and the text never states a total. The plan is
// rebuilt (cancel every Tabi reminder, schedule fresh) on app foreground, after
// a study session and when settings change. The old single repeating DAILY
// reminder is cancelled by its stored id and its time becomes slot 1.
// JS-only (expo-notifications); permission is asked only when switching on.
// Nothing leaves the device except the one read of the user's own cards.

export interface ReminderSettings { enabled: boolean; slots: ReminderSlot[] }
export const MAX_REMINDER_SLOTS = 3;
export const DEFAULT_REMINDER: ReminderSettings = { enabled: false, slots: [{ hour: 9, minute: 0 }] };

const KEY_V1 = 'tabi.reminder.v1';
const KEY = 'tabi.reminder.v2';
const ID_KEY = 'tabi.reminder.id.v1'; // the legacy repeating DAILY notification
const TYPE = 'review-reminder';

const validSlot = (h: unknown, m: unknown): ReminderSlot | null => {
  const hour = Number(h), minute = Number(m);
  return Number.isInteger(hour) && hour >= 0 && hour < 24 && Number.isInteger(minute) && minute >= 0 && minute < 60
    ? { hour, minute } : null;
};

/** Drops duplicates, keeps the order, caps at MAX_REMINDER_SLOTS. */
export function normalizeSlots(slots: ReminderSlot[]): ReminderSlot[] {
  const seen = new Set<string>();
  const out: ReminderSlot[] = [];
  for (const s of slots) {
    const k = `${s.hour}:${s.minute}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out.slice(0, MAX_REMINDER_SLOTS);
}

export async function loadReminder(): Promise<ReminderSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const r = JSON.parse(raw);
      const slots = normalizeSlots(
        (Array.isArray(r.slots) ? r.slots : []).map((s: any) => validSlot(s?.hour, s?.minute)).filter(Boolean) as ReminderSlot[],
      );
      return { enabled: r.enabled === true, slots: slots.length ? slots : DEFAULT_REMINDER.slots };
    }
    // Migration: the v1 single time becomes slot 1.
    const old = await AsyncStorage.getItem(KEY_V1);
    if (old) {
      const r = JSON.parse(old);
      const slot = validSlot(r.hour, r.minute) ?? DEFAULT_REMINDER.slots[0];
      return { enabled: r.enabled === true, slots: [slot] };
    }
    return DEFAULT_REMINDER;
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

/** Cancels the legacy repeating reminder by its stored id. Needs no network. */
async function cancelLegacyReminder() {
  try {
    const id = await AsyncStorage.getItem(ID_KEY);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      await AsyncStorage.removeItem(ID_KEY);
    }
  } catch { /* nothing scheduled */ }
}

/** Cancels the legacy reminder and every Tabi one-shot reminder. */
async function cancelAllReminders() {
  await cancelLegacyReminder();
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      all
        .filter(n => (n.content.data as { type?: string } | null)?.type === TYPE)
        .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
  } catch { /* nothing scheduled */ }
}

/** Sign-out / account deletion: cancel everything scheduled and forget the settings. Never throws. */
export async function clearReminders(): Promise<void> {
  try {
    await cancelAllReminders();
    await AsyncStorage.multiRemove([KEY, KEY_V1, ID_KEY]);
  } catch { /* best effort */ }
}

const PAGE = 1000; // PostgREST's default row cap: page through, or big collections are truncated

async function fetchPlannableCards(): Promise<PlannableCard[] | null> {
  const { data: auth, error: authError } = await supabase.auth.getSession();
  // A failed read (offline) is NOT "signed out": keep what is scheduled.
  if (authError) return null;
  // Signed out: nothing of this account's should keep firing.
  if (!auth.session) return [];
  const rows: Sticker[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('stickers')
      .select('id,due_at,last_reviewed_at,interval_days,created_at,review_count,learning_step')
      .eq('user_id', auth.session.user.id)
      .order('id')
      .range(from, from + PAGE - 1);
    if (error || !data) return null;
    rows.push(...(data as unknown as Sticker[]));
    if (data.length < PAGE) break;
  }
  await studyPrefsReady();
  return plannableCards(rows, {
    newCardsPerDay: getStudyPrefs().newCardsPerDay,
    introducedToday: newCardsIntroducedToday(),
  });
}

let running: Promise<void> | null = null;
let again = false;

/**
 * Rebuilds the schedule from the stored settings and the user's cards:
 * cancel everything of ours, then one-shot DATE triggers from planReminders().
 * Calls coalesce (one in flight, one queued) so a flurry of triggers can never
 * interleave a cancel with another's schedule.
 */
export function syncReminders(): Promise<void> {
  if (running) { again = true; return running; }
  running = (async () => {
    try {
      do {
        again = false;
        await rebuild();
      } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
}

async function rebuild() {
  try {
    // The legacy repeating reminder dies first, before anything that needs the network.
    await cancelLegacyReminder();
    const settings = await loadReminder();
    if (!settings.enabled || !(await isReminderPermitted())) {
      await cancelAllReminders();
      await logScheduled('off');
      return;
    }
    const cards = await fetchPlannableCards();
    if (!cards) return; // offline or a failed read: keep what is scheduled
    await cancelAllReminders();
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('reminders', {
        name: 'Review reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const plan = planReminders({ slots: settings.slots, cards, now: Date.now(), days: 7 });
    for (const p of plan) {
      await Notifications.scheduleNotificationAsync({
        content: { title: p.title, body: p.body, data: { type: TYPE, fireAt: p.fireAt } },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(p.fireAt),
          ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
        },
      });
    }
    await logScheduled('rebuilt');
  } catch (e) {
    if (__DEV__) console.warn('[reminders] sync failed', e);
  }
}

/** One line per scheduled Tabi reminder, for the dev readout and the console. */
export async function describeScheduledReminders(): Promise<string[]> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const rows = all
    .filter(n => (n.content.data as { type?: string } | null)?.type === TYPE)
    .map(n => {
      // The iOS trigger comes back as a timeInterval, so the fire time is kept in data.
      const ms = Number((n.content.data as { fireAt?: number } | null)?.fireAt ?? NaN);
      const at = Number.isNaN(ms) ? null : new Date(ms);
      const label = at
        ? `${at.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} ${formatReminderTime(at.getHours(), at.getMinutes())}`
        : 'scheduled';
      return { ms: at?.getTime() ?? 0, text: `${label} · ${n.content.body}` };
    })
    .sort((a, b) => a.ms - b.ms);
  return rows.map(r => r.text);
}

async function logScheduled(why: string) {
  if (!__DEV__) return;
  try {
    const rows = await describeScheduledReminders();
    console.log(`[reminders] ${why}: ${rows.length} scheduled`, rows);
  } catch { /* dev only */ }
}

/** Switch on/off or change the times: save, then rebuild. Permission is the caller's job. */
export async function setReminder(settings: ReminderSettings): Promise<void> {
  await save({ enabled: settings.enabled, slots: normalizeSlots(settings.slots) });
  await syncReminders();
}

export function formatReminderTime(hour: number, minute: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}
