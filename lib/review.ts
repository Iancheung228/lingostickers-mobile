/**
 * The spaced-repetition scheduler: SM-2 with Anki's learning steps, over the
 * state added in 028_study_card_review_state.sql, 029_sm2_scheduler.sql and
 * 040_learning_steps.sql.
 *
 * Every function here is pure — it takes a card and a clock and returns
 * either a verdict or a patch. The database write that applies a patch lives
 * at the call site (components/StudyCard.tsx), so all of the calendar-boundary
 * and ease arithmetic below, every bit of which is off-by-one prone, can be
 * exercised without a React Native runtime or a Supabase client. Same
 * reasoning as lib/relativeTime.ts.
 *
 * **A card is in one of three phases**, and the four buttons mean different
 * things in each — this is the part 029's day-granular scheduler was missing,
 * which is why Again, Hard and Good all used to resolve to "tomorrow" on a
 * card you had just met:
 *
 *   learning     A new card. Walks LEARNING_STEPS_MIN (1m, 10m) — minutes,
 *                not days, because the useful question about a word you just
 *                failed is "can you recall it in a minute", and burning a
 *                whole day to ask it wastes the day.
 *   review       Graduated. The day-granular SM-2 ladder from 029, unchanged:
 *                interval × ease, due at local midnight.
 *   relearning   Lapsed back off the review ladder. Walks
 *                RELEARNING_STEPS_MIN (10m) and then graduates back onto the
 *                interval stored in interval_days.
 *
 * Review-card due times are still written at local midnight, so the queue
 * still turns over overnight rather than reshuffling through the afternoon.
 * Only cards on a step are scheduled to the minute.
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
// nothing. Applies to rows written before 040, which have no due_at.
export const NEW_CARD_REST_DAYS = 1;

// How many cards the home screen's feed rail renders. Nothing else is capped
// by this — the review session always takes the whole due queue.
export const FEED_PREVIEW = 12;

// --- Anki's defaults --------------------------------------------------------
// These are Anki's own out-of-the-box deck options, kept as they ship rather
// than tuned by taste: they are the numbers the overwhelming majority of
// spaced-repetition practice has actually been run on, and any deviation
// should be a change someone can point at evidence for.
//
//   https://docs.ankiweb.net/deck-options.html

/** Minutes at each rung of the new-card ladder. Anki: `1m 10m`. */
export const LEARNING_STEPS_MIN = [1, 10];
/** Minutes at each rung of the after-a-lapse ladder. Anki: `10m`. */
export const RELEARNING_STEPS_MIN = [10];
/** Days a card waits after finishing the learning ladder. */
export const GRADUATING_INTERVAL_DAYS = 1;
/** Days a card waits when Easy skips the ladder outright. */
export const EASY_INTERVAL_DAYS = 4;
/** Hard grows the interval by this much instead of by ease. */
export const HARD_MULTIPLIER = 1.2;
/** Easy multiplies the Good interval by this on top of ease. */
export const EASY_BONUS = 1.3;
/**
 * What a lapse leaves of the interval. Anki's default is 0 — a forgotten card
 * goes back to a day, on the argument that an interval you demonstrably could
 * not hold is not evidence of anything worth keeping. The ease penalty below
 * is what carries the card's history forward instead.
 */
export const LAPSE_MULTIPLIER = 0;
/** …but never below this, so a lapse can't schedule a card into the past. */
export const MIN_LAPSE_INTERVAL_DAYS = 1;

/**
 * How far ahead a running session will pull a card that is on a step.
 *
 * Anki calls this the learn-ahead limit and also defaults it to 20 minutes.
 * Without it, answering Good on a new card would book it for ten minutes'
 * time and then end the session, so the second half of the learning ladder
 * would only ever be walked by someone who came back within the window —
 * i.e. almost never. See components/StudySessionHost.tsx.
 */
export const LEARN_AHEAD_MIN = 20;

export type Grade = 'again' | 'hard' | 'good' | 'easy';
export type Phase = 'learning' | 'review' | 'relearning';

/** The columns a grading writes. Exactly the shape of the Supabase update. */
export interface SchedulePatch {
  ease_factor: number;
  interval_days: number;
  learning_step: number | null;
  due_at: string;
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

/** Local midnight `days` days after the local midnight containing `ms`. */
function midnightIn(ms: number, days: number): number {
  // Stepped by date parts rather than by adding milliseconds so a DST
  // boundary inside the interval can't shift the due day by one.
  const d = new Date(startOfDay(ms));
  d.setDate(d.getDate() + days);
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
// Phases
// ---------------------------------------------------------------------------

/**
 * Which ladder a card is on, and where.
 *
 * Derived rather than stored, so rows written before 040 (which have
 * learning_step = NULL) land in the right place without a backfill: one that
 * has been studied graduated under the old scheduler and is a review card;
 * one that hasn't is new. Learning and relearning are told apart by
 * interval_days exactly as Anki tells them apart — a card on a step that has
 * never graduated has no interval yet, and one that has lapsed carries the
 * interval it will graduate back onto.
 */
export function phaseOf(sticker: Sticker): { phase: Phase; step: number } {
  const step = sticker.learning_step;
  if (step == null) {
    return sticker.last_reviewed_at
      ? { phase: 'review', step: -1 }
      : { phase: 'learning', step: 0 };
  }
  return { phase: (sticker.interval_days ?? 0) > 0 ? 'relearning' : 'learning', step };
}

function stepsFor(phase: Phase): number[] {
  return phase === 'relearning' ? RELEARNING_STEPS_MIN : LEARNING_STEPS_MIN;
}

/**
 * Anki's Hard-on-a-step delay: on the first rung, the average of the first
 * two rungs (or 1.5× the only rung), so Hard sits between Again and Good
 * rather than being a synonym for one of them; on any later rung, a repeat of
 * that rung.
 */
function hardStepDelay(steps: number[], step: number): number {
  if (step > 0) return steps[Math.min(step, steps.length - 1)];
  return steps.length > 1 ? (steps[0] + steps[1]) / 2 : steps[0] * 1.5;
}

// ---------------------------------------------------------------------------
// SM-2
// ---------------------------------------------------------------------------

/**
 * What one press of one button does to a card, before any clock is involved.
 *
 * `delayMinutes` non-null means the card stays on (or moves to) a step and is
 * due that many minutes from the moment it was answered. Null means it is a
 * review card due at midnight `intervalDays` days out. Exactly one of those
 * is true of any answer, and `schedule` and the button labels both read this
 * one function — so what a button previews can't drift from what it does.
 */
export interface Outcome {
  ease: number;
  intervalDays: number;
  learningStep: number | null;
  delayMinutes: number | null;
  lapsed: boolean;
}

/**
 * SM-2's ease adjustments, as Anki applies them: only a review answer moves
 * ease. Walking the learning ladder doesn't, because the ladder is there to
 * establish the first memory rather than to measure a schedule that hasn't
 * been made yet.
 */
const EASE_DELTA: Record<Grade, number> = {
  again: -0.20,
  hard:  -0.15,
  good:   0,
  easy:  +0.15,
};

export function nextEase(ease: number, grade: Grade): number {
  return Math.max(MIN_EASE, Number((ease + EASE_DELTA[grade]).toFixed(3)));
}

export function nextOutcome(sticker: Sticker, grade: Grade): Outcome {
  const ease = sticker.ease_factor ?? START_EASE;
  const interval = sticker.interval_days ?? 0;
  const { phase, step } = phaseOf(sticker);

  if (phase === 'learning' || phase === 'relearning') {
    const steps = stepsFor(phase);
    // A card being learned graduates onto GRADUATING_INTERVAL_DAYS; a card
    // being relearned graduates back onto the interval its lapse left it,
    // which is already stored in interval_days.
    const graduated = phase === 'relearning' ? Math.max(1, interval) : GRADUATING_INTERVAL_DAYS;
    const base = { ease, lapsed: false };

    if (grade === 'again') {
      return { ...base, intervalDays: interval, learningStep: 0, delayMinutes: steps[0] };
    }
    if (grade === 'hard') {
      return { ...base, intervalDays: interval, learningStep: step, delayMinutes: hardStepDelay(steps, step) };
    }
    if (grade === 'easy') {
      // Easy leaves the ladder immediately at any rung. Out of relearning
      // that means a day earlier than Good, not the full four — the card has
      // just been forgotten, and one confident answer doesn't undo that.
      const days = phase === 'relearning' ? Math.max(graduated + 1, Math.round(graduated * EASY_BONUS)) : EASY_INTERVAL_DAYS;
      return { ...base, intervalDays: days, learningStep: null, delayMinutes: null };
    }
    const next = step + 1;
    return next >= steps.length
      ? { ...base, intervalDays: graduated, learningStep: null, delayMinutes: null }
      : { ...base, intervalDays: interval, learningStep: next, delayMinutes: steps[next] };
  }

  // --- review -------------------------------------------------------------
  if (grade === 'again') {
    // A lapse doesn't go straight back to "tomorrow" any more: it drops onto
    // the relearning ladder, so the card comes back inside the same sitting
    // while the failure is still informative. The interval it will graduate
    // back onto is decided here, at lapse time, and parked in interval_days.
    return {
      ease: nextEase(ease, 'again'),
      intervalDays: Math.max(MIN_LAPSE_INTERVAL_DAYS, Math.round(interval * LAPSE_MULTIPLIER)),
      learningStep: 0,
      delayMinutes: RELEARNING_STEPS_MIN[0],
      lapsed: true,
    };
  }

  // The three passing intervals are computed together and stacked, each at
  // least a day past the one below it. Both halves of that matter:
  //
  //   - the +1 floor stops a rounding-down leaving a card repeating the same
  //     interval forever;
  //   - stacking stops the buttons collapsing into each other at short
  //     intervals, which is the whole complaint this scheduler exists to fix.
  //     On a 1-day card, 1.2×, 2.5× and 3.25× round to 1, 3 and 3 — so Good
  //     and Easy would be the same button, exactly as Again and Hard used to
  //     be. Stacked, they are 2d, 3d and 4d. Anki enforces the same ordering.
  const hardDays = Math.max(interval + 1, Math.round(interval * HARD_MULTIPLIER));
  const goodDays = Math.max(hardDays + 1, Math.round(interval * ease));
  const easyDays = Math.max(goodDays + 1, Math.round(interval * ease * EASY_BONUS));
  return {
    ease: nextEase(ease, grade),
    intervalDays: grade === 'hard' ? hardDays : grade === 'easy' ? easyDays : goodDays,
    learningStep: null,
    delayMinutes: null,
    lapsed: false,
  };
}

/** The full patch a grading writes. Pure — the caller performs the update. */
export function schedule(sticker: Sticker, grade: Grade, now: number = Date.now()): SchedulePatch {
  const outcome = nextOutcome(sticker, grade);
  // A card on a step is due to the minute from the moment it was answered; a
  // review card is due at local midnight of its target day, which is what
  // keeps the day-granular queue from reshuffling itself through the
  // afternoon.
  const due = outcome.delayMinutes != null
    ? now + outcome.delayMinutes * 60_000
    : midnightIn(now, outcome.intervalDays);
  return {
    ease_factor: outcome.ease,
    interval_days: outcome.intervalDays,
    learning_step: outcome.learningStep,
    due_at: new Date(due).toISOString(),
    review_count: (sticker.review_count ?? 0) + 1,
    lapses: (sticker.lapses ?? 0) + (outcome.lapsed ? 1 : 0),
    last_reviewed_at: new Date(now).toISOString(),
  };
}

/**
 * A preview of where each button would send the card, for the labels under
 * the grading buttons. Reads the same `nextOutcome` the write does, so the
 * two can't drift — and formats the *nominal* delay rather than the wall
 * clock difference, because a review card booked for tomorrow midnight is
 * "1d" whatever time of the evening you answered it.
 */
export function intervalPreview(sticker: Sticker, grade: Grade): string {
  const outcome = nextOutcome(sticker, grade);
  return outcome.delayMinutes != null
    ? formatMinutes(outcome.delayMinutes)
    : formatInterval(outcome.intervalDays);
}

/** "1m", "6m", "45m", "2h" — the sub-day end of the same scale. */
export function formatMinutes(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 60) return `${m}m`;
  const hours = m / 60;
  return `${hours < 10 ? Number(hours.toFixed(1)) : Math.round(hours)}h`;
}

/**
 * The same compact delay spoken as words, for the grading buttons'
 * accessibility labels — VoiceOver reads "1m" as "one em".
 */
const DELAY_WORDS: Record<string, [string, string]> = {
  m:  ['minute', 'minutes'],
  h:  ['hour', 'hours'],
  d:  ['day', 'days'],
  mo: ['month', 'months'],
  y:  ['year', 'years'],
};

export function spokenDelay(compact: string): string {
  // `mo` first, or the alternation matches the `m` of "3mo" and leaves "o".
  const parsed = /^([\d.]+)(mo|[mhdy])$/.exec(compact);
  if (!parsed) return compact;
  const [, count, unit] = parsed;
  const [one, many] = DELAY_WORDS[unit];
  return `${count} ${Number(count) === 1 ? one : many}`;
}

/** "6d", "3mo", "1.5y" — the gap each button would open up. */
export function formatInterval(days: number): string {
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  const years = days / 365;
  return `${years < 10 ? years.toFixed(1).replace(/\.0$/, '') : Math.round(years)}y`;
}

// ---------------------------------------------------------------------------
// The queue
// ---------------------------------------------------------------------------

/**
 * The moment a card next comes up, in epoch ms.
 *
 * due_at is authoritative when present. It is absent only on rows last
 * written before 040, which are deliberately not backfilled (a server-side
 * date_trunc would have shifted the due day for anyone west of GMT) — those
 * fall back to 029's inference, computed here in the user's own timezone
 * exactly as it always was: local midnight of last_reviewed_at (or of
 * discovered_at, for a card never studied) plus the interval.
 */
export function dueAtMs(sticker: Sticker): number {
  if (sticker.due_at) {
    const at = new Date(sticker.due_at).getTime();
    if (!Number.isNaN(at)) return at;
  }
  const studied = !!sticker.last_reviewed_at;
  const clockStart = studied ? sticker.last_reviewed_at! : sticker.discovered_at;
  const interval = studied ? (sticker.interval_days ?? 0) : NEW_CARD_REST_DAYS;
  const from = new Date(clockStart).getTime();
  return midnightIn(Number.isNaN(from) ? Date.now() : from, interval);
}

/** Days a card is past due. Negative means it is still resting. */
export function overdueBy(sticker: Sticker, now: number = Date.now()): number {
  return Math.round((startOfDay(now) - startOfDay(dueAtMs(sticker))) / 86_400_000);
}

export function isDue(sticker: Sticker, now: number = Date.now()): boolean {
  return dueAtMs(sticker) <= now;
}

/**
 * Everything due, soonest-due first. Uncapped — the session studies the whole
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
    .map(s => ({ sticker: s, due: dueAtMs(s) }))
    .filter(a => a.due <= now)
    .sort((x, y) => x.due - y.due || (x.sticker.review_count ?? 0) - (y.sticker.review_count ?? 0))
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
