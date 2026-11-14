import { isNetworkError } from '@/lib/friendlyError';

// The one place a failed scan becomes one of B-core 2's six error rows (lesson
// 3: remap once, at the boundary, never show `error.message`). scan.tsx throws a
// ScanFailure carrying the HTTP status the edge function answered with; this
// file decides which row it is and what copy and recoveries go with it.

export type ScanErrorKind = 'cutout' | 'offline' | 'busy' | 'nothing' | 'blocked' | 'limit';
export type ScanAction = 'retry' | 'pickAgain' | 'wholePhoto' | 'typeWord' | 'retake' | 'ok';

export class ScanFailure extends Error {
  readonly status?: number;
  readonly kind?: ScanErrorKind;
  constructor(message: string, opts: { status?: number; kind?: ScanErrorKind } = {}) {
    super(message);
    this.name = 'ScanFailure';
    this.status = opts.status;
    this.kind = opts.kind;
  }
}

export interface ScanErrorCopy {
  title: string;
  /** Second line, when the title alone leaves the user guessing what is safe. */
  actions: { action: ScanAction; label: string }[];
}

// Exact copy from B-core section 2. The first action is the primary button.
export const SCAN_ERRORS: Record<ScanErrorKind, ScanErrorCopy> = {
  cutout: {
    title: "Couldn't cut that out.",
    actions: [
      { action: 'retry', label: 'Try again' },
      { action: 'pickAgain', label: 'Pick the object again' },
      { action: 'wholePhoto', label: 'Use the whole photo' },
    ],
  },
  offline: {
    title: "You're offline. Your photo is kept.",
    actions: [{ action: 'retry', label: 'Try again' }],
  },
  busy: {
    title: 'The word service is busy. Your sticker is safe.',
    actions: [
      { action: 'retry', label: 'Try again' },
      { action: 'typeWord', label: 'Type the word instead' },
    ],
  },
  nothing: {
    title: "We couldn't tell what this is.",
    actions: [
      { action: 'pickAgain', label: 'Pick the object again' },
      { action: 'typeWord', label: 'Type the word instead' },
    ],
  },
  blocked: {
    title: "That photo couldn't be used. Try a different one.",
    actions: [{ action: 'retake', label: 'Retake' }],
  },
  limit: {
    title: "You've used today's scans. They reset tomorrow.",
    actions: [{ action: 'ok', label: 'OK' }],
  },
};

/** Kinds where the cutout is worth keeping for "Type the word instead". */
export function keepsCutout(kind: ScanErrorKind): boolean {
  return kind === 'busy' || kind === 'nothing';
}

export function classifyScanFailure(
  err: unknown,
  ctx: { lookingUpWord: boolean; timedOut: boolean },
): ScanErrorKind {
  if (ctx.timedOut) return 'busy';
  const f = err instanceof ScanFailure ? err : null;
  if (f?.kind) return f.kind;
  const msg = err instanceof Error ? err.message : '';
  const status = f?.status;
  if (status === 429 && /daily limit|tomorrow/i.test(msg)) return 'limit';
  if (status === 422) return 'blocked';
  if (
    (err instanceof Error && err.name === 'FunctionsFetchError') ||
    /failed to send a request|network request failed/i.test(msg) ||
    (!status && isNetworkError(err))
  ) return 'offline';
  if (/couldn'?t tell|can'?t tell|nothing recogni/i.test(msg)) return 'nothing';
  return ctx.lookingUpWord ? 'busy' : 'cutout';
}
