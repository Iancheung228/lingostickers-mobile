/**
 * The spaced-repetition scheduler: SM-2, over the state added in
 * 028_study_card_review_state.sql and 029_sm2_scheduler.sql.
 *
 * Every function here is pure — it takes a card and a clock and returns
 * either a verdict or a patch. The database write that applies a patch lives
 * at the call site (components/StudyCard.tsx), so all of the calendar-boundary
 * and ease arithmetic below, every bit of which is off-by-one prone, can be
 * exercised without a React Native runtime or a Supabase client. Same
 * reasoning as lib/relativeTime.ts.
 *
 * Deliberately day-granular. There are no learning steps and no intraday
 * scheduling, so the queue changes only at midnight and "is this due" is a
 * question about dates rather than about the current minute.
 */
import { Language, Sticker } from '@/lib/types';

// How many finds a day counts as a full day. Shown as "GOAL 5" on the home
// header; purely a target to aim at, nothing is gated on hitting it.
export const DAILY_GOAL = 5;

// SM-2's floor. Below roughly this, intervals stop growing meaningfully and
// the card never leaves the queue no matter how well it is answered.
export const MIN_EASE = 1.3;
export const START_EASE = 2.5;

// A card you have only just scanned rests a day before its first review —
// you were looking at the object minutes ago, so asking immediately measures
// nothing.
export const NEW_CARD_REST_DAYS = 1;

// How many due cards the home screen previews. The session itself takes the
// whole queue; this only caps what the rail renders.
export const DUE_PREVIEW = 12;

export type Grade = 'again' | 'hard' | 'good' | 'easy';

/** The columns a grading writes. Exactly the shape of the Supabase update. */
export interface SchedulePatch {
  ease_factor: number;
  interval_days: number;
  review_count: number;
  lapses: number;
  last_reviewed_at: string;
}

// Local midnight, so a card's age flips over at midnight rather than at
// whatever time of day it was last studied — otherwise the due list would
// reshuffle itself partway through the afternoon.
function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Whole calendar days between a timestamp and now. Today is 0. */
export function ageInDays(dateStr: string, now: number = Date.now()): number {
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return 0;
  // Rounded, not floored: DST turns one day a year into 23 or 25 hours, and a
  // floor would silently report that day as the one before.
  return Math.max(0, Math.round((startOfDay(now) - startOfDay(then)) / 86_400_000));
}

/** Stickers discovered today — the numerator of the header's "N found today". */
export function findsToday(stickers: Sticker[], now: number = Date.now()): number {
  return stickers.filter(s => ageInDays(s.discovered_at, now) === 0).length;
}

// ---------------------------------------------------------------------------
// SM-2
// ---------------------------------------------------------------------------

// SM-2 is defined over a 0–5 recall quality. Only four of those six are
// reachable from four buttons, and the ones chosen here are the standard
// mapping: below 3 is a failure, 3 is a struggle, 5 is instant.
const QUALITY: Record<Grade, number> = { again: 2, hard: 3, good: 4, easy: 5 };

/**
 * SM-2's ease adjustment. Good is deliberately neutral (+0), so ease drifts
 * only when a card is genuinely harder or easier than the schedule assumed.
 */
export function nextEase(ease: number, grade: Grade): number {
  const q = QUALITY[grade];
  const next = ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  return Math.max(MIN_EASE, Number(next.toFixed(3)));
}

/**
 * The next interval in whole days.
 *
 * Branches on the current interval rather than on a separate repetition
 * counter: 0 means never studied, 1 means it is on the first rung. That keeps
 * `review_count` free to be an honest monotonic "times studied" for the card's
 * own badge, instead of an SM-2 internal that resets on every lapse.
 */
export function nextInterval(intervalDays: number, ease: number, grade: Grade): number {
  // A lapse drops the card to the bottom rung rather than to zero: with no
  // intraday scheduling, "tomorrow" is the soonest it can come back.
  if (grade === 'again') return 1;
  if (intervalDays <= 0) return grade === 'easy' ? 4 : 1;
  if (intervalDays === 1) return grade === 'hard' ? 2 : grade === 'easy' ? 8 : 6;

  const base =
    grade === 'hard' ? intervalDays * 1.2 :
    grade === 'easy' ? intervalDays * ease * 1.3 :
    intervalDays * ease;
  // Always advance by at least a day, so a rounding-down can't leave a card
  // stuck repeating the same interval forever.
  return Math.max(intervalDays + 1, Math.round(base));
}

/** The full patch a grading writes. Pure — the caller performs the update. */
export function schedule(sticker: Sticker, grade: Grade, now: number = Date.now()): SchedulePatch {
  const ease = sticker.ease_factor ?? START_EASE;
  return {
    ease_factor: nextEase(ease, grade),
    interval_days: nextInterval(sticker.interval_days ?? 0, ease, grade),
    review_count: (sticker.review_count ?? 0) + 1,
    lapses: (sticker.lapses ?? 0) + (grade === 'again' ? 1 : 0),
    last_reviewed_at: new Date(now).toISOString(),
  };
}

/**
 * A preview of where each button would send the card, for the labels under
 * the grading buttons. Same arithmetic the write uses, so the two can't drift.
 */
export function intervalPreview(sticker: Sticker, grade: Grade): number {
  return nextInterval(sticker.interval_days ?? 0, sticker.ease_factor ?? START_EASE, grade);
}

// ---------------------------------------------------------------------------
// The queue
// ---------------------------------------------------------------------------

/** Days a card is past due. Negative means it is still resting. */
export function overdueBy(sticker: Sticker, now: number = Date.now()): number {
  // A never-studied card's clock runs from when it was found, not from a
  // review that never happened.
  const studied = !!sticker.last_reviewed_at;
  const clockStart = studied ? sticker.last_reviewed_at! : sticker.discovered_at;
  const interval = studied ? (sticker.interval_days ?? 0) : NEW_CARD_REST_DAYS;
  return ageInDays(clockStart, now) - interval;
}

export function isDue(sticker: Sticker, now: number = Date.now()): boolean {
  return overdueBy(sticker, now) >= 0;
}

/**
 * Everything due, most-overdue first. Uncapped — the session studies the whole
 * queue, and the home screen slices it for the preview rail.
 *
 * Ties break toward the card studied fewest times, so a word you have barely
 * met doesn't sit behind one you already know well.
 */
export function dueToday(
  stickers: Sticker[],
  opts: { language?: Language; now?: number } = {}
): Sticker[] {
  const now = opts.now ?? Date.now();
  return stickers
    .filter(s => !opts.language || s.language === opts.language)
    .map(s => ({ sticker: s, over: overdueBy(s, now) }))
    .filter(a => a.over >= 0)
    .sort((x, y) => y.over - x.over || (x.sticker.review_count ?? 0) - (y.sticker.review_count ?? 0))
    .map(a => a.sticker);
}

// ---------------------------------------------------------------------------
// Forecast
// ---------------------------------------------------------------------------

export interface DayForecast {
  date: Date;
  /// Single-letter weekday, as the chart's axis labels.
  initial: string;
  count: number;
  isToday: boolean;
}

/**
 * Days from today until this card next comes up. 0 means due now — including
 * everything already overdue, which is why the forecast's first bar is
 * "today and the backlog" rather than "cards whose interval lands exactly
 * today".
 */
export function nextDueInDays(sticker: Sticker, now: number = Date.now()): number {
  return Math.max(0, -overdueBy(sticker, now));
}

/**
 * How many cards fall due on each of the next `days` days, starting today.
 *
 * Cards due beyond the window are simply not counted — this answers "what
 * does my week look like", not "how much do I owe in total".
 */
export function weekAhead(
  stickers: Sticker[],
  opts: { days?: number; language?: Language; now?: number } = {}
): DayForecast[] {
  const days = opts.days ?? 7;
  const now = opts.now ?? Date.now();
  const counts = new Array<number>(days).fill(0);

  for (const sticker of stickers) {
    if (opts.language && sticker.language !== opts.language) continue;
    const due = nextDueInDays(sticker, now);
    if (due < days) counts[due] += 1;
  }

  const today = startOfDay(now);
  return counts.map((count, offset) => {
    // Built by adding to a local-midnight date rather than by adding
    // milliseconds, so a DST boundary inside the window can't shift a bar
    // onto the wrong day.
    const date = new Date(today);
    date.setDate(date.getDate() + offset);
    return {
      date,
      initial: date.toLocaleDateString(undefined, { weekday: 'narrow' }),
      count,
      isToday: offset === 0,
    };
  });
}

export interface DayActivity {
  date: Date;
  /// Single-letter weekday, as the chart's axis labels.
  initial: string;
  isToday: boolean;
  /// Cards discovered on this day.
  finds: number;
  /// Cards whose most recent review landed on this day — see the caveat below.
  reviews: number;
}

/**
 * The week just gone: what you found each day, and what you reviewed.
 *
 * The window ends today, so unlike `weekAhead` this is a record rather than a
 * forecast — which is the only way the two series can share an axis at all.
 * Finds are knowable for past days and reviews only for past days, so a
 * forward window would have nothing to draw.
 *
 * **The review series is a floor, not a count.** Only `last_reviewed_at` is
 * stored — one timestamp per card, overwritten by every grading — so a card
 * studied on Monday and again on Thursday appears under Thursday alone, and
 * Monday's bar is short by one. Reporting the honest floor beats inventing a
 * number; a true per-day history needs a review-events table, which the
 * schema deliberately doesn't have (see 028/029). The same limit is why the
 * month grid marks no review data on past days.
 */
export function weekActivity(
  stickers: Sticker[],
  opts: { days?: number; language?: Language; now?: number } = {}
): DayActivity[] {
  const days = opts.days ?? 7;
  const now = opts.now ?? Date.now();

  // Slot 0 is the oldest day in the window, slot days-1 is today. Stepped by
  // date parts rather than by subtracting milliseconds so a DST boundary
  // inside the window can't shift a day onto its neighbour.
  const dates: Date[] = [];
  const slotOf = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(startOfDay(now));
    date.setDate(date.getDate() - i);
    slotOf.set(dateKeyOf(date), dates.length);
    dates.push(date);
  }

  const finds = new Array<number>(days).fill(0);
  const reviews = new Array<number>(days).fill(0);
  for (const sticker of stickers) {
    if (opts.language && sticker.language !== opts.language) continue;
    const foundSlot = slotOf.get(dateKeyOf(new Date(sticker.discovered_at)));
    if (foundSlot !== undefined) finds[foundSlot] += 1;
    if (sticker.last_reviewed_at) {
      const reviewSlot = slotOf.get(dateKeyOf(new Date(sticker.last_reviewed_at)));
      if (reviewSlot !== undefined) reviews[reviewSlot] += 1;
    }
  }

  return dates.map((date, i) => ({
    date,
    initial: date.toLocaleDateString(undefined, { weekday: 'narrow' }),
    isToday: i === days - 1,
    finds: finds[i],
    reviews: reviews[i],
  }));
}

/**
 * Local-time date key, `YYYY-MM-DD`. Local rather than UTC so a card due late
 * in the evening isn't bucketed into tomorrow — the same reasoning the
 * calendar screen uses for `discovered_at`.
 */
export function dateKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * How many cards come due on each calendar day, for marking a month grid.
 *
 * Everything already overdue is folded into today's key, matching the
 * forecast chart — a backlog is work for today, not for the day it originally
 * came up.
 */
export function dueCountsByDate(
  stickers: Sticker[],
  opts: { language?: Language; now?: number } = {}
): Map<string, number> {
  const now = opts.now ?? Date.now();
  const today = startOfDay(now);
  const counts = new Map<string, number>();

  for (const sticker of stickers) {
    if (opts.language && sticker.language !== opts.language) continue;
    // Stepped by date parts rather than by adding milliseconds, so a DST
    // boundary between now and the due date can't shift it a day.
    const due = new Date(today);
    due.setDate(due.getDate() + nextDueInDays(sticker, now));
    const key = dateKeyOf(due);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * The one day in the window worth pointing at. Null when there isn't one: an
 * empty week, or a flat one where every day carries the same load and
 * singling one out would send you to an arbitrary day.
 *
 * Used by the month grid, which rings this day in full colour while every
 * other due day gets the muted ring.
 */
export function heaviestDay(forecast: DayForecast[]): DayForecast | null {
  if (forecast.length === 0) return null;
  const heaviest = forecast.reduce((a, b) => (b.count > a.count ? b : a));
  if (heaviest.count === 0) return null;
  if (forecast.every(d => d.count === heaviest.count)) return null;
  return heaviest;
}

/** Rough "this'll take N min" for a queue of a given size. */
export function reviewMinutes(count: number): number {
  return Math.max(1, count);
}
