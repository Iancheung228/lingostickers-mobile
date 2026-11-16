// node --experimental-strip-types --test scripts/test-background-library.mts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newBackgroundId, libraryPathFor, libraryThumbPathFor, libraryFilesFor, isLibraryPath, newestFirst,
} from '../lib/backgroundLibrary.ts';

test('newBackgroundId is a v4-shaped uuid', () => {
  for (let i = 0; i < 50; i++) {
    assert.match(newBackgroundId(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  }
});

test('paths live in the owner folder, thumbnail beside the source', () => {
  const p = libraryPathFor('u1', 'abc');
  assert.equal(p, 'u1/backgrounds/abc.jpg');
  assert.equal(libraryThumbPathFor(p), 'u1/backgrounds/abc.thumb.webp');
  assert.deepEqual(libraryFilesFor(p), ['u1/backgrounds/abc.jpg', 'u1/backgrounds/abc.thumb.webp']);
  // First folder segment is the user id, which is what the storage RLS checks.
  assert.equal(p.split('/')[0], 'u1');
});

test('isLibraryPath never matches a board background', () => {
  assert.equal(isLibraryPath('u1', 'u1/backgrounds/abc.jpg'), true);
  assert.equal(isLibraryPath('u1', 'u1/board-b1-background.jpg'), false);
  assert.equal(isLibraryPath('u1', 'u2/backgrounds/abc.jpg'), false);
});

test('newestFirst sorts descending and does not mutate', () => {
  const rows = [{ created_at: '2026-01-01T00:00:00Z' }, { created_at: '2026-03-01T00:00:00Z' }, { created_at: '2026-02-01T00:00:00Z' }];
  const out = newestFirst(rows);
  assert.deepEqual(out.map(r => r.created_at.slice(5, 7)), ['03', '02', '01']);
  assert.equal(rows[0].created_at.slice(5, 7), '01');
});
