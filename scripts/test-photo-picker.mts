// node --experimental-strip-types --test scripts/test-photo-picker.mts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addUsedAssets, parseUsedAssets } from '../lib/usedAssets.ts';
import { toggleSelection, confirmLabel, isScreenshot, randomWindows, shuffled, sampleDistinct } from '../lib/photoSelection.ts';

const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

test('used assets: parse tolerates junk', () => {
  assert.deepEqual(parseUsedAssets(null), []);
  assert.deepEqual(parseUsedAssets('not json'), []);
  assert.deepEqual(parseUsedAssets('{"a":1}'), []);
  assert.deepEqual(parseUsedAssets('["a",3,"","b"]'), ['a', 'b']);
});

test('used assets: add dedupes, moves to newest, ignores empty ids', () => {
  assert.deepEqual(addUsedAssets(['a', 'b'], ['b', undefined, null, 'c', 'c']), ['a', 'b', 'c']);
  assert.deepEqual(addUsedAssets(['a', 'b', 'c'], ['a']), ['b', 'c', 'a']);
  assert.deepEqual(addUsedAssets(['a'], [undefined]), ['a']);
});

test('used assets: cap drops the oldest', () => {
  assert.deepEqual(addUsedAssets(['a', 'b', 'c'], ['d', 'e'], 4), ['b', 'c', 'd', 'e']);
});

test('selection: toggles, keeps tap order, refuses past the cap', () => {
  let r = toggleSelection([], 'a', 3);
  r = toggleSelection(r.ids, 'b', 3);
  r = toggleSelection(r.ids, 'c', 3);
  assert.deepEqual(r.ids, ['a', 'b', 'c']);
  const full = toggleSelection(r.ids, 'd', 3);
  assert.deepEqual(full, { ids: ['a', 'b', 'c'], capped: true });
  assert.deepEqual(toggleSelection(r.ids, 'b', 3), { ids: ['a', 'c'], capped: false });
});

test('selection: deselecting at the cap is allowed and re-adding then works', () => {
  const r = toggleSelection(['a', 'b'], 'a', 2);
  assert.deepEqual(toggleSelection(r.ids, 'c', 2).ids, ['b', 'c']);
});

test('confirm label', () => {
  assert.equal(confirmLabel(1), 'Use 1 photo');
  assert.equal(confirmLabel(3), 'Make 3 stickers');
});

test('screenshots are recognised', () => {
  assert.equal(isScreenshot(['hdr', 'screenshot']), true);
  assert.equal(isScreenshot(['livePhoto']), false);
  assert.equal(isScreenshot(undefined), false);
});

test('past-year windows stay inside the last 12 months and have the asked width', () => {
  const now = Date.UTC(2026, 10, 16);
  const DAY = 86_400_000;
  const ws = randomWindows(now, seeded(7), 200, 7, 365);
  assert.equal(ws.length, 200);
  for (const w of ws) {
    assert.equal(w.before - w.after, 7 * DAY);
    assert.ok(w.before <= now, 'not in the future');
    assert.ok(w.after >= now - 365 * DAY, 'not older than a year');
  }
  // spread: the windows are not all the same
  assert.ok(new Set(ws.map((w) => w.after)).size > 50);
});

test('sampling: distinct, bounded, a permutation of the pool', () => {
  const pool = Array.from({ length: 50 }, (_, i) => ({ id: `p${i % 40}` })); // 10 duplicates
  const s = sampleDistinct(pool, 24, seeded(3), (p) => p.id);
  assert.equal(s.length, 24);
  assert.equal(new Set(s.map((p) => p.id)).size, 24);
  assert.equal(sampleDistinct(pool, 100, seeded(3), (p) => p.id).length, 40);
  assert.deepEqual([...shuffled([1, 2, 3, 4, 5], seeded(1))].sort(), [1, 2, 3, 4, 5]);
  assert.notDeepEqual(sampleDistinct(pool, 24, seeded(3), (p) => p.id), sampleDistinct(pool, 24, seeded(4), (p) => p.id));
});
