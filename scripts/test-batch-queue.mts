// node --experimental-strip-types --test scripts/test-batch-queue.mts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BatchQueue, nextToReview } from '../lib/batchQueue.ts';

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
