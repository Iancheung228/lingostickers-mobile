/**
 * Pure reminder planner (no React Native / expo imports, so node can test it).
 * lib/reminder.ts re-exports it and does the scheduling.
 *
 * One-shot notifications for the next `days` days, at the user's chosen
 * wall-clock slots. Silent when nothing is due; never states a total above 5.
 */

export interface ReminderSlot { hour: number; minute: number }
export interface PlannedReminder { fireAt: number; title: string; body: string }

/** A card, as the planner sees it: just when it comes due. */
export interface PlannableCard { dueAtMs: number }

/** Matches DAILY_GOAL / the Quick 5 session size. */
export const QUICK_SESSION = 5;
const SECONDS_PER_CARD = 12;

function minutesFor(count: number): number {
  return Math.max(1, Math.ceil((count * SECONDS_PER_CARD) / 60));
}

function todayBody(count: number): string {
  if (count > QUICK_SESSION) return 'A quick 5 is ready · about 1 min';
  const mins = minutesFor(count);
  return `${count} card${count === 1 ? '' : 's'} · about ${mins} min`;
}

export function planReminders(opts: {
  slots: ReminderSlot[];
  cards: PlannableCard[];
  now: number;
  days?: number;
}): PlannedReminder[] {
  const { slots, cards, now } = opts;
  const days = opts.days ?? 7;
  const seen = new Set<string>();
  const unique = slots.filter(s => {
    const k = `${s.hour}:${s.minute}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const today = new Date(now);
  const out: PlannedReminder[] = [];
  for (let d = 0; d < days; d++) {
    for (const slot of unique) {
      // Built from local date parts, so a DST change inside the week can't
      // move the wall-clock time.
      const fireAt = new Date(today.getFullYear(), today.getMonth(), today.getDate() + d, slot.hour, slot.minute, 0, 0).getTime();
      if (fireAt <= now) continue;
      const due = cards.reduce((n, c) => (c.dueAtMs <= fireAt ? n + 1 : n), 0);
      if (due === 0) continue;
      out.push(d === 0
        ? { fireAt, title: 'Time to review', body: todayBody(due) }
        : { fireAt, title: 'Time to review', body: 'Your Tabi cards are ready' });
    }
  }
  return out.sort((a, b) => a.fireAt - b.fireAt);
}
