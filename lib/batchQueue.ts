// ---------------------------------------------------------------------------
// The queue behind "batch create" (hooks/useBatchCreate.ts).
//
// Framework-free on purpose: the interesting bugs here are races (a result
// that lands after Skip, a retry racing its own first attempt, a slot that is
// never freed), and those are cheap to pin down in a node test and miserable
// to find on a device. See scripts/test-batch-queue.mts.
//
// Each item is one photo whose object the user has already chosen. Up to
// `concurrency` items run at once; the rest wait their turn. The queue knows
// nothing about Supabase, files or React: the caller supplies
//   run(payload, signal)  -> does the work, resolves with a result
//   dispose(result)       -> throws a result away (removes its uploaded files)
// ---------------------------------------------------------------------------

export type BatchStatus = 'queued' | 'running' | 'done' | 'failed' | 'added' | 'skipped';

export interface BatchItem<P, R> {
  id: number;
  status: BatchStatus;
  payload: P;
  result: R | null;
  error: string | null;
}

export interface BatchQueueOptions<P, R> {
  run: (payload: P, signal: AbortSignal) => Promise<R>;
  /** Turns a thrown value into words for the learner. Called once per failure. */
  describeError: (err: unknown) => string | Promise<string>;
  /** A result nobody will use (skipped, or finished after being skipped). */
  dispose: (result: R) => void;
  concurrency?: number;
  /** A run that takes longer than this is aborted and reported as failed. */
  timeoutMs?: number;
  timeoutMessage?: string;
}

const isResolved = (s: BatchStatus) => s === 'added' || s === 'skipped';

export class BatchQueue<P, R> {
  private items: BatchItem<P, R>[] = [];
  private controllers = new Map<number, AbortController>();
  // Bumped on every (re)start, so a result from an attempt that has since been
  // skipped or retried is recognised as stale instead of overwriting the new one.
  private attempts = new Map<number, number>();
  private listeners = new Set<() => void>();
  private nextId = 1;
  private closed = false;
  private snapshot: readonly BatchItem<P, R>[] = [];

  private readonly opts: BatchQueueOptions<P, R>;

  constructor(opts: BatchQueueOptions<P, R>) {
    this.opts = opts;
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };

  /** A new array whenever anything changed, so it works with useSyncExternalStore. */
  getSnapshot = () => this.snapshot;

  private emit() {
    this.snapshot = this.items.map((i) => ({ ...i }));
    this.listeners.forEach((fn) => fn());
  }

  private get concurrency() { return this.opts.concurrency ?? 2; }

  private find(id: number) { return this.items.find((i) => i.id === id); }

  enqueue(payload: P): number {
    const id = this.nextId++;
    this.items.push({ id, status: 'queued', payload, result: null, error: null });
    this.emit();
    this.pump();
    return id;
  }

  /** Re-runs a failed item with the same payload. */
  retry(id: number) {
    const item = this.find(id);
    if (!item || item.status !== 'failed') return;
    item.status = 'queued';
    item.error = null;
    this.closed = false;
    this.emit();
    this.pump();
  }

  /** Edits a finished item's result in place (the learner corrected its word or sentence). */
  updateResult(id: number, fn: (result: R) => R) {
    const item = this.find(id);
    if (!item || item.status !== 'done' || !item.result) return;
    item.result = fn(item.result);
    this.emit();
  }

  /** Marks a finished item as saved; its files now belong to the sticker row. */
  markAdded(id: number) {
    const item = this.find(id);
    if (!item || item.status !== 'done') return false;
    item.status = 'added';
    this.emit();
    return true;
  }

  /** Throws the item away. A finished one has its files removed; a running one is aborted. */
  skip(id: number) {
    const item = this.find(id);
    if (!item || isResolved(item.status)) return;
    const wasRunning = item.status === 'running';
    const result = item.result;
    item.status = 'skipped';
    item.result = null;
    item.error = null;
    if (wasRunning) {
      this.attempts.set(id, (this.attempts.get(id) ?? 0) + 1);
      this.controllers.get(id)?.abort();
      this.controllers.delete(id);
    }
    if (result) this.opts.dispose(result);
    this.emit();
    this.pump();
  }

  /** Stops in-flight work (screen going away). Finished results are kept. */
  shutdown() {
    this.closed = true;
    for (const [id, c] of this.controllers) {
      this.attempts.set(id, (this.attempts.get(id) ?? 0) + 1);
      c.abort();
    }
    this.controllers.clear();
    for (const item of this.items) {
      if (item.status === 'running' || item.status === 'queued') {
        item.status = 'failed';
        item.error = 'Stopped before it finished.';
      }
    }
    this.emit();
  }

  /** Undoes shutdown() for a screen that mounts again (React strict mode). */
  reopen() { this.closed = false; }

  private pump() {
    if (this.closed) return;
    let running = this.items.filter((i) => i.status === 'running').length;
    for (const item of this.items) {
      if (running >= this.concurrency) break;
      if (item.status !== 'queued') continue;
      running++;
      this.start(item);
    }
  }

  private start(item: BatchItem<P, R>) {
    const attempt = (this.attempts.get(item.id) ?? 0) + 1;
    this.attempts.set(item.id, attempt);
    const controller = new AbortController();
    this.controllers.set(item.id, controller);
    item.status = 'running';
    this.emit();

    let timedOut = false;
    const timer = this.opts.timeoutMs
      ? setTimeout(() => { timedOut = true; controller.abort(); }, this.opts.timeoutMs)
      : null;
    const current = () => this.attempts.get(item.id) === attempt;

    Promise.resolve()
      .then(() => this.opts.run(item.payload, controller.signal))
      .then(
        (result) => {
          if (timer) clearTimeout(timer);
          if (!current()) { this.opts.dispose(result); return; }
          this.controllers.delete(item.id);
          item.status = 'done';
          item.result = result;
          item.error = null;
          this.emit();
          this.pump();
        },
        async (err) => {
          if (timer) clearTimeout(timer);
          if (!current()) return;
          let message: string;
          if (timedOut) message = this.opts.timeoutMessage ?? 'This took too long. Please try again.';
          else {
            try { message = await this.opts.describeError(err); }
            catch { message = 'Something went wrong. Please try again.'; }
          }
          // Describing the error is async; the item may have been skipped meanwhile.
          if (!current()) return;
          this.controllers.delete(item.id);
          item.status = 'failed';
          item.error = message;
          this.emit();
          this.pump();
        },
      );
  }
}

/** The item the review step should be showing: the first one not yet added or skipped. */
export function nextToReview<P, R>(items: readonly BatchItem<P, R>[]): BatchItem<P, R> | null {
  return items.find((i) => !isResolved(i.status)) ?? null;
}
