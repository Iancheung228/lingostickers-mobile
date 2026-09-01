/**
 * Console diagnostics that compile away outside development.
 *
 * The scan and cutout paths are heavily instrumented — stage timings, pass
 * order, gate scores, upload throughput — and that instrumentation is worth
 * keeping: it is the feedback loop for tuning the cutout gate against real
 * photos, and analytics arrives far too late to explain the scan you are
 * looking at right now.
 *
 * What it should not do is run in a release build, where nobody can read it
 * and every call still pays to format its own string. `__DEV__` is a literal
 * the bundler substitutes, so in production these bodies are dead code the
 * minifier drops entirely.
 *
 * Use these instead of bare `console.*` for anything diagnostic. A message a
 * *user* needs belongs on screen, not in a log — see the retry states in
 * collection.tsx and day/[date].tsx.
 */
export function debugLog(...args: unknown[]): void {
  if (__DEV__) console.log(...args);
}

export function debugWarn(...args: unknown[]): void {
  if (__DEV__) console.warn(...args);
}
