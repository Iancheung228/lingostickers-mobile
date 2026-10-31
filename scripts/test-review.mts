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
