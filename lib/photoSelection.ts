// Pure selection + sampling rules for the in-app photo picker. Framework-free
// (scripts/test-photo-picker.mts). The cap is BATCH_MAX, passed in by callers.

export interface ToggleResult { ids: string[]; /** True when an add was refused because the cap is full. */ capped: boolean }

/** Tap = toggle. Order is tap order (it is the order the batch processes them). */
export function toggleSelection(ids: readonly string[], id: string, max: number): ToggleResult {
  if (ids.includes(id)) return { ids: ids.filter((x) => x !== id), capped: false };
  if (ids.length >= max) return { ids: ids.slice(), capped: true };
  return { ids: [...ids, id], capped: false };
}

/** Confirm button copy: "Use 1 photo" for the single flow, "Make 3 stickers" for a batch. */
export function confirmLabel(count: number): string {
  return count <= 1 ? 'Use 1 photo' : `Make ${count} stickers`;
}

/** True when this asset should be listed given the screenshot rule (screenshots hidden everywhere). */
export function isScreenshot(subtypes: readonly string[] | undefined | null): boolean {
  return !!subtypes && subtypes.includes('screenshot');
}

const DAY = 86_400_000;

/**
 * `count` random [after, before) windows of `windowDays` inside the 12 months
 * before `now`. Shuffle fetches a page per window instead of paging the whole
 * year, so the cost is `count` queries however big the library is.
 */
export function randomWindows(now: number, rng: () => number, count: number, windowDays = 7, spanDays = 365): { after: number; before: number }[] {
  const out: { after: number; before: number }[] = [];
  const room = Math.max(0, spanDays - windowDays);
  for (let i = 0; i < count; i++) {
    const startDaysAgo = windowDays + Math.floor(rng() * (room + 1));
    const before = now - (startDaysAgo - windowDays) * DAY;
    out.push({ after: before - windowDays * DAY, before });
  }
  return out;
}

/** Fisher-Yates, returns a new array. */
export function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Up to `n` distinct items (by key) from the pool, random order. */
export function sampleDistinct<T>(pool: readonly T[], n: number, rng: () => number, key: (t: T) => string): T[] {
  const seen = new Set<string>();
  const uniq: T[] = [];
  for (const t of pool) {
    const k = key(t);
    if (!seen.has(k)) { seen.add(k); uniq.push(t); }
  }
  return shuffled(uniq, rng).slice(0, n);
}
