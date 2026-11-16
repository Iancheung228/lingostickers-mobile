// node --experimental-strip-types --test scripts/test-batch-queue.mts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BatchQueue, nextToReview, batchProgress } from '../lib/batchQueue.ts';
import { loopCapacity, sceneAvoidWords } from '../lib/batchLimits.ts';

type Job = { name: string };
function setup(concurrency = 2) {
  const gates = new Map<string, { resolve: () => void; reject: (e: unknown) => void }>();
  const started: string[] = [];
  const disposed: string[] = [];
  const q = new BatchQueue<Job, string>({
    concurrency,
    run: (job, signal) => new Promise<string>((resolve, reject) => {
      started.push(job.name);
      gates.set(job.name, { resolve: () => resolve(`draft-${job.name}`), reject });
      signal.addEventListener('abort', () => reject(new Error('aborted')));
    }),
    describeError: (e) => `nice: ${(e as Error).message}`,
    dispose: (r) => { disposed.push(r); },
    timeoutMs: 1000,
  });
  return { q, gates, started, disposed };
}
const tick = () => new Promise((r) => setImmediate(r));
const status = (q: BatchQueue<Job, string>) => q.getSnapshot().map((i) => i.status).join(',');

test('caps concurrency and starts the next job when a slot frees', async () => {
  const { q, gates, started } = setup(2);
  q.enqueue({ name: 'a' }); q.enqueue({ name: 'b' }); q.enqueue({ name: 'c' });
  await tick();
  assert.deepEqual(started, ['a', 'b']);
  gates.get('a')!.resolve(); await tick();
  assert.deepEqual(started, ['a', 'b', 'c']);
  assert.equal(status(q), 'done,running,running');
});

test('a failure does not stop the others, and retry re-runs it', async () => {
  const { q, gates, started } = setup(2);
  const a = q.enqueue({ name: 'a' }); q.enqueue({ name: 'b' });
  await tick();
  gates.get('a')!.reject(new Error('boom')); await tick();
  assert.equal(q.getSnapshot()[0].status, 'failed');
  assert.equal(q.getSnapshot()[0].error, 'nice: boom');
  gates.get('b')!.resolve(); await tick();
  assert.equal(q.getSnapshot()[1].status, 'done');
  q.retry(a); await tick();
  assert.equal(started.filter((s) => s === 'a').length, 2);
  assert.equal(q.getSnapshot()[0].status, 'running');
});

test('skipping a running job aborts it, frees the slot, and ignores its late result', async () => {
  const { q, gates, started } = setup(1);
  const a = q.enqueue({ name: 'a' }); q.enqueue({ name: 'b' });
  await tick();
  q.skip(a); await tick();
  assert.deepEqual(started, ['a', 'b']);
  assert.equal(status(q), 'skipped,running');
  gates.get('a')!.resolve(); await tick(); // late result of the aborted attempt
  assert.equal(q.getSnapshot()[0].status, 'skipped');
});

test('skipping a finished job disposes its result exactly once', async () => {
  const { q, gates, disposed } = setup();
  const a = q.enqueue({ name: 'a' }); await tick();
  gates.get('a')!.resolve(); await tick();
  q.skip(a); q.skip(a);
  assert.deepEqual(disposed, ['draft-a']);
});

test('an added job cannot be added again or skipped', async () => {
  const { q, gates, disposed } = setup();
  const a = q.enqueue({ name: 'a' }); await tick();
  gates.get('a')!.resolve(); await tick();
  assert.equal(q.markAdded(a), true);
  assert.equal(q.markAdded(a), false);
  q.skip(a);
  assert.equal(q.getSnapshot()[0].status, 'added');
  assert.deepEqual(disposed, []);
});

test('review order is enqueue order and skips resolved items', async () => {
  const { q, gates } = setup();
  const a = q.enqueue({ name: 'a' }); const b = q.enqueue({ name: 'b' }); await tick();
  gates.get('b')!.resolve(); await tick();
  assert.equal(nextToReview(q.getSnapshot())!.id, a); // a still running: review waits on it
  q.skip(a);
  assert.equal(nextToReview(q.getSnapshot())!.id, b);
});

test('shutdown aborts in-flight work and keeps finished results', async () => {
  const { q, gates } = setup();
  q.enqueue({ name: 'a' }); q.enqueue({ name: 'b' }); await tick();
  gates.get('a')!.resolve(); await tick();
  q.shutdown(); await tick();
  assert.equal(status(q), 'done,failed');
});

test('skipping one finished card leaves every other card running, queued and reviewable', async () => {
  const { q, gates, started, disposed } = setup(2);
  const a = q.enqueue({ name: 'a' }); q.enqueue({ name: 'b' }); q.enqueue({ name: 'c' }); await tick();
  gates.get('a')!.resolve(); await tick(); // a done, b running, c started in a's slot
  assert.deepEqual(started, ['a', 'b', 'c']);
  q.skip(a); await tick();
  assert.deepEqual(disposed, ['draft-a']); // only a's files go
  assert.equal(status(q), 'skipped,running,running');
  gates.get('b')!.resolve(); gates.get('c')!.resolve(); await tick();
  assert.equal(status(q), 'skipped,done,done');
  assert.equal(nextToReview(q.getSnapshot())!.result, 'draft-b');
  assert.deepEqual(disposed, ['draft-a']);
});

test('skipping a card still running does not abort its neighbours', async () => {
  const { q, gates, disposed } = setup(2);
  const a = q.enqueue({ name: 'a' }); q.enqueue({ name: 'b' }); q.enqueue({ name: 'c' }); await tick();
  q.skip(a); await tick(); // a aborted; its slot goes to c
  gates.get('b')!.resolve(); gates.get('c')!.resolve(); await tick();
  assert.equal(status(q), 'skipped,done,done');
  assert.deepEqual(disposed, []);
});

test('loop capacity reserves one card for every photo still to come', () => {
  assert.equal(loopCapacity(5, 0, 0), 5);   // one photo: up to 5 loops
  assert.equal(loopCapacity(5, 0, 2), 3);   // 2 more photos wait
  assert.equal(loopCapacity(5, 3, 1), 1);   // 3 made, 1 photo left: one card for this one
  assert.equal(loopCapacity(5, 5, 0), 1);   // never below one: the photo itself
});

test('scene chips avoid sibling cards from the same photo, and only those', () => {
  const items = [
    { id: 1, photoId: 1, status: 'done', word: 'vélo', chipWords: ['roue'] },
    { id: 2, photoId: 1, status: 'done', word: 'sac', chipWords: [] },
    { id: 3, photoId: 2, status: 'done', word: 'tasse', chipWords: ['café'] },
    { id: 4, photoId: 1, status: 'skipped', word: null, chipWords: [] },
  ];
  assert.deepEqual(sceneAvoidWords(items, 2).sort(), ['roue', 'vélo']);
  assert.deepEqual(sceneAvoidWords(items, 1), ['sac']);
  assert.deepEqual(sceneAvoidWords(items, 3), []);
});

test('progress counts photos cut and cards reviewed against the picked total', async () => {
  const { q, gates } = setup();
  assert.deepEqual(batchProgress(q.getSnapshot(), 3), { total: 3, cut: 0, reviewed: 0 });
  const a = q.enqueue({ name: 'a' }); q.enqueue({ name: 'b' }); await tick();
  assert.deepEqual(batchProgress(q.getSnapshot(), 3), { total: 3, cut: 2, reviewed: 0 });
  gates.get('a')!.resolve(); await tick();
  q.markAdded(a);
  q.skip(q.getSnapshot()[1].id);
  assert.deepEqual(batchProgress(q.getSnapshot(), 3), { total: 3, cut: 2, reviewed: 2 });
});

test('a result can carry edits until it is added, and is added only once', async () => {
  const { q, gates } = setup();
  const a = q.enqueue({ name: 'a' }); await tick();
  gates.get('a')!.resolve(); await tick();
  q.updateResult(a, (r) => `${r}+chips`);
  assert.equal(q.getSnapshot()[0].result, 'draft-a+chips');
  assert.equal(q.markAdded(a), true);
  assert.equal(q.markAdded(a), false); // a second Add tap must not count twice
});
