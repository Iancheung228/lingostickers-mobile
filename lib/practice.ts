/**
 * Practice mode: grade cards without touching the schedule.
 *
 * Every write a grade can cause (the optimistic list patch, the DB update, the
 * new-card slot, the undo snapshot) runs inside the closure given to
 * `persistGrade`. It is the ONE guard: in practice the closure is never called.
 * Pure, so scripts/test-review.mts can prove it.
 */
export type SessionMode = 'review' | 'practice';

/** Runs `persist` unless the session is practice. Returns whether it ran. */
export function persistGrade(mode: SessionMode, persist: () => void): boolean {
  if (mode === 'practice') return false;
  persist();
  return true;
}
