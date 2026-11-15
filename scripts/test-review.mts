// ---------------------------------------------------------------------------
// Unit tests for the review clock (lib/review.ts).
//
//   node --experimental-strip-types --test scripts/test-review.mts
//
// A card made today from an old photo carries the photo's date in
// discovered_at. Everything about activity and scheduling must run on
// created_at instead, or that card is due the moment it is made — and
// thousands of days overdue.
// ---------------------------------------------------------------------------
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { dueAtMs, findsToday, NEW_CARD_REST_DAYS } from '../lib/review.ts';

const DAY = 86_400_000;

function card(overrides: Record<string, unknown> = {}) {
  return {
    discovered_at: '2018-03-30T15:14:00.000Z', // the photo's own date
    created_at: new Date().toISOString(),       // made just now
    last_reviewed_at: null,
    interval_days: 0,
    due_at: null,
    ...overrides,
  } as any;
}

test('a new card from an old photo is not due yet', () => {
  assert.ok(dueAtMs(card()) > Date.now());
});

test('a new card rests NEW_CARD_REST_DAYS from the day it was made, not the photo date', () => {
  const due = dueAtMs(card());
  assert.ok(due - Date.now() <= (NEW_CARD_REST_DAYS + 1) * DAY);
});

test('a card made today from an old photo counts as found today', () => {
  assert.equal(findsToday([card()]), 1);
});

test('due_at, when set, still wins over both dates', () => {
  const at = '2030-01-01T00:00:00.000Z';
  assert.equal(dueAtMs(card({ due_at: at })), Date.parse(at));
});

// ---------------------------------------------------------------------------
// Card + review rethink, M1: lapses, review cap, catch-up, minutes, reminders
// ---------------------------------------------------------------------------
import {
  schedule, intervalPreview, reviewMinutes, capReviews, isCatchUp, reviewedTodayCount,
} from '../lib/review.ts';
import { planReminders } from '../lib/reminderPlan.ts';

function reviewCard(interval: number, overdueDays: number, extra: Record<string, unknown> = {}) {
  const now = Date.now();
  return card({
    interval_days: interval,
    learning_step: null,
    ease_factor: 2.5,
    review_count: 5,
    last_reviewed_at: new Date(now - (interval + overdueDays) * DAY).toISOString(),
    due_at: new Date(now - overdueDays * DAY).toISOString(),
    created_at: new Date(now - 200 * DAY).toISOString(),
    ...extra,
  });
}

test('lapse keeps a quarter of the interval, clamped to 1..14 days', () => {
  assert.equal(schedule(reviewCard(30, 0), 'again').interval_days, 8);
  assert.equal(schedule(reviewCard(90, 0), 'again').interval_days, 14);
  assert.equal(schedule(reviewCard(2, 0), 'again').interval_days, 1);
  assert.equal(schedule(reviewCard(30, 0), 'again').learning_step, 0);
});

test('Again preview still reads the relearning step, not the interval', () => {
  assert.equal(intervalPreview(reviewCard(30, 0), 'again'), '10m');
});

test('reviewMinutes: ~12s a card, minimum one minute', () => {
  assert.equal(reviewMinutes(0), 1);
  assert.equal(reviewMinutes(5), 1);
  assert.equal(reviewMinutes(6), 2);
  assert.equal(reviewMinutes(30), 6);
});

test('capReviews caps review cards, keeps learning/new, orders by overdue ratio', () => {
  const a = reviewCard(3, 7, { id: 'a' });    // ratio ~2.3
  const b = reviewCard(90, 7, { id: 'b' });   // ratio ~0.08
  const c = reviewCard(10, 10, { id: 'c' });  // ratio 1
  const learning = card({ id: 'l', learning_step: 1, interval_days: 0, last_reviewed_at: new Date().toISOString(), due_at: new Date(Date.now() - 1000).toISOString() });
  const fresh = card({ id: 'n', review_count: 0, due_at: new Date(Date.now() - 1000).toISOString() });
  const out = capReviews([b, learning, c, fresh, a], { reviewCap: 2, reviewedToday: 0 }).map((s: any) => s.id);
  assert.deepEqual(out, ['a', 'l', 'c', 'n']);
  const none = capReviews([a, b, learning], { reviewCap: 30, reviewedToday: 30 }).map((s: any) => s.id);
  assert.deepEqual(none, ['l']);
});

test('reviewedTodayCount counts only review-phase cards reviewed today', () => {
  const done = reviewCard(5, 0, { last_reviewed_at: new Date().toISOString() });
  const old = reviewCard(5, 2);
  const step = card({ learning_step: 0, interval_days: 0, last_reviewed_at: new Date().toISOString() });
  assert.equal(reviewedTodayCount([done, old, step]), 1);
});

test('catch-up: 20 cards 3+ days overdue, or 7+ days away; otherwise off', () => {
  const many = Array.from({ length: 20 }, () => reviewCard(5, 4));
  assert.equal(isCatchUp(many), true);
  assert.equal(isCatchUp(many.slice(0, 19).map(c => ({ ...c, last_reviewed_at: new Date().toISOString() }))), false);
  const away = [reviewCard(30, 0, { last_reviewed_at: new Date(Date.now() - 8 * DAY).toISOString() })];
  assert.equal(isCatchUp(away), true);
  const recent = [reviewCard(30, 0, { last_reviewed_at: new Date(Date.now() - 2 * DAY).toISOString() })];
  assert.equal(isCatchUp(recent), false);
  assert.equal(isCatchUp([]), false);
});

const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m, d, h, min).getTime();

test('planReminders: zero-due days are skipped, past slots skipped, count text', () => {
  const now = at(2026, 5, 10, 10, 0);
  const slots = [{ hour: 9, minute: 0 }, { hour: 18, minute: 0 }];
  const cards = [{ dueAtMs: now - 1000 }, { dueAtMs: now - 5000 }, { dueAtMs: at(2026, 5, 12, 0) }];
  const plan = planReminders({ slots, cards, now, days: 7 });
  assert.equal(plan[0].fireAt, at(2026, 5, 10, 18));       // 9:00 today already past
  assert.equal(plan[0].body, '2 cards · about 1 min');
  assert.ok(plan.every(p => p.fireAt > now));
  const empty = planReminders({ slots, cards: [], now, days: 7 });
  assert.equal(empty.length, 0);
  const later = planReminders({ slots: [slots[0]], cards: [{ dueAtMs: at(2026, 5, 12, 0) }], now, days: 7 });
  assert.equal(later[0].fireAt, at(2026, 5, 12, 9));
  assert.equal(later[0].body, 'Your Tabi cards are ready');
});

test('planReminders: more than 5 due says a quick 5; single card is singular', () => {
  const now = at(2026, 5, 10, 8, 0);
  const many = Array.from({ length: 12 }, () => ({ dueAtMs: now - 1 }));
  assert.equal(planReminders({ slots: [{ hour: 9, minute: 0 }], cards: many, now })[0].body, 'A quick 5 is ready · about 1 min');
  assert.equal(planReminders({ slots: [{ hour: 9, minute: 0 }], cards: many.slice(0, 1), now })[0].body, '1 card · about 1 min');
});

test('planReminders: DST transition day keeps the wall-clock time; 3 slots no duplicates', () => {
  // 2026-03-08 is US spring-forward; whatever TZ the host uses, wall time must hold.
  const now = at(2026, 2, 6, 12, 0);
  const cards = [{ dueAtMs: now - 1 }];
  const slots = [{ hour: 9, minute: 0 }, { hour: 13, minute: 30 }, { hour: 20, minute: 0 }, { hour: 9, minute: 0 }];
  const plan = planReminders({ slots, cards, now, days: 7 });
  for (const p of plan) {
    const d = new Date(p.fireAt);
    assert.ok([9, 13, 20].includes(d.getHours()));
  }
  assert.equal(new Set(plan.map(p => p.fireAt)).size, plan.length);
  assert.equal(plan.length, 2 + 3 * 6);   // today: 13:30 + 20:00, then 6 full days
});

// ---------------------------------------------------------------------------
// M3: Today plan and practice mode
// ---------------------------------------------------------------------------
import { buildTodayPlan, nextDueWhen } from '../lib/review.ts';
import { persistGrade } from '../lib/practice.ts';

test('practice never runs a write; review runs it exactly once', () => {
  let writes = 0;
  assert.equal(persistGrade('practice', () => { writes += 1; }), false);
  assert.equal(writes, 0);
  assert.equal(persistGrade('review', () => { writes += 1; }), true);
  assert.equal(writes, 1);
});

test('buildTodayPlan: new-card limit applies, catch-up pauses new cards, reviews are capped', () => {
  const fresh = Array.from({ length: 3 }, () => card({ review_count: 0, due_at: new Date(Date.now() - 1000).toISOString() }));
  const reviews = Array.from({ length: 4 }, () => reviewCard(5, 1));
  const normal = buildTodayPlan([...fresh, ...reviews], { newCardsPerDay: 2, introducedToday: 0 });
  assert.equal(normal.catchUp, false);
  assert.equal(normal.queue.length, 2 + 4);
  const gone = [reviewCard(30, 0, { last_reviewed_at: new Date(Date.now() - 9 * DAY).toISOString() }), ...fresh];
  const away = buildTodayPlan(gone, { newCardsPerDay: 5, introducedToday: 0 });
  assert.equal(away.catchUp, true);
  assert.equal(away.queue.every((c: any) => c.review_count > 0), true);
  const many = Array.from({ length: 40 }, () => reviewCard(5, 1));
  assert.equal(buildTodayPlan(many, { newCardsPerDay: 5, introducedToday: 0 }).queue.length, 30);
});

test('nextDueWhen words the next due day', () => {
  const tomorrow = reviewCard(1, 0, { due_at: new Date(Date.now() + DAY).toISOString() });
  assert.equal(nextDueWhen([tomorrow]), 'tomorrow');
  assert.equal(nextDueWhen([]), null);
});

// ---------------------------------------------------------------------------
// Review fixes: held-back cards, reminder/Today agreement
// ---------------------------------------------------------------------------
import { plannableCards } from '../lib/review.ts';

test('nextDueWhen: due cards held back by the cap say tomorrow, never later today', () => {
  const held = Array.from({ length: 40 }, () => reviewCard(5, 1));
  assert.equal(nextDueWhen(held), 'tomorrow');
  const plan = buildTodayPlan(held, { newCardsPerDay: 5, introducedToday: 0 });
  assert.equal(plan.queue.length, 30);
  // all 30 reviewed today -> queue empty, 10 still due -> tomorrow
  const doneToday = held.map((c: any, i: number) => i < 30 ? { ...c, last_reviewed_at: new Date().toISOString(), due_at: new Date(Date.now() + DAY).toISOString() } : c);
  assert.equal(buildTodayPlan(doneToday, { newCardsPerDay: 5, introducedToday: 0 }).queue.length, 0);
  assert.equal(nextDueWhen(doneToday), 'tomorrow');
});

test('plannableCards: held-back cards only count from tomorrow, so reminders agree with Today', () => {
  const now = Date.now();
  const cards = Array.from({ length: 35 }, () => reviewCard(5, 1));
  const out = plannableCards(cards, { newCardsPerDay: 5, introducedToday: 0, now });
  const dueNow = out.filter(c => c.dueAtMs <= now).length;
  assert.equal(dueNow, 30);                       // today: the capped queue only
  assert.equal(out.filter(c => c.dueAtMs > now).length, 5); // the other 5 wait for tomorrow
  const doneToday = cards.map((c: any) => ({ ...c, last_reviewed_at: new Date().toISOString() }));
  const none = plannableCards(doneToday, { newCardsPerDay: 5, introducedToday: 0, now });
  assert.equal(none.filter(c => c.dueAtMs <= now).length, 0);   // Today says caught up -> no reminder today
});
