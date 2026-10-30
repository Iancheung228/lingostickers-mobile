// ---------------------------------------------------------------------------
// The one entry point for every model call this app makes.
//
// Two layers of resilience, deliberately different:
//
//   retry     — same provider, for faults that pass on their own (a 503, a
//               per-minute bucket, a truncated reply). Bounded and capped,
//               because the user is watching a spinner: a scan that succeeds
//               after 45 seconds of sleeping is worse than one that says
//               "try again". Cap is 6s per wait, 3 attempts.
//   timeout   — every attempt has its own timer, and the whole call has a
//               deadline. Without them a stalled connection is not an error
//               at all, just a spinner: scene prompts measured 1.6-2s
//               normally and 23-46s three times, with nothing in between.
//               A stall cut at 12s and retried costs ~14s, not 46.
//   failover  — next provider, once retries are spent. Protects against a
//               sustained outage of one vendor.
//
// What must NOT fail over is as important as what must. A malformed request
// ('invalid') is our own bug, and failing over would hide it behind a
// second-choice model forever. A safety refusal ('blocked') is a decision
// about the content: another provider will very likely refuse it too, and the
// user is owed an answer rather than a silent substitution. `LlmError`
// carries that policy on the error itself so it cannot be re-litigated here.
// ---------------------------------------------------------------------------

import { createGeminiProvider } from './gemini.ts';
import { createGroqProvider } from './groq.ts';
import { type LlmProvider, type LlmRequest, type LlmResult, LlmError } from './types.ts';

export * from './types.ts';
export { createGeminiProvider } from './gemini.ts';
export { createGroqProvider } from './groq.ts';

const MAX_ATTEMPTS = 3;
const MAX_BACKOFF_MS = 6_000;
/** p50 is ~2s and a cold function ~5.6s; 12s is a stall, not a slow answer. */
const ATTEMPT_TIMEOUT_MS = 12_000;
/** The whole call, across retries and providers. Past this, say "try again". */
const DEADLINE_MS = 30_000;
/** Not worth starting an attempt that has less than this left to run in. */
const MIN_ATTEMPT_MS = 3_000;

export interface CallOptions {
  /** Overrides the default chain. Used by tests; production passes nothing. */
  providers?: LlmProvider[];
  /** Injected so retry logic is testable without real waiting. */
  sleep?: (ms: number) => Promise<void>;
  /** Tags log lines so a slow path can be found in the function logs. */
  label?: string;
  /** Overrides for tests, so a stall can be simulated in milliseconds. */
  attemptTimeoutMs?: number;
  deadlineMs?: number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Exponential backoff, unless the provider told us exactly how long to wait.
 * Capped either way — a provider asking for 34 minutes (Groq does this when
 * the daily budget is gone) must not become a 34-minute request.
 */
function backoffFor(error: LlmError, attempt: number): number {
  const hinted = error.retryAfterMs;
  const computed = 500 * 2 ** attempt;
  return Math.min(hinted ?? computed, MAX_BACKOFF_MS);
}

/**
 * Runs one attempt under its own timer. The signal lets a real fetch actually
 * stop; the race enforces the limit even on a provider that ignores it.
 */
async function withTimeout(provider: LlmProvider, request: LlmRequest, ms: number): Promise<LlmResult> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      // Reject before aborting: the abort makes `send` reject too, with
      // whatever its fetch threw, and the race keeps whichever came first.
      reject(new LlmError('timeout', provider.name, `no response within ${ms}ms`));
      controller.abort();
    }, ms);
  });
  try {
    return await Promise.race([provider.send(request, controller.signal), expired]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The production provider chain, read from the environment.
 *
 * `GEMINI_MODEL`, `GEMINI_MEDIA_RESOLUTION` and `GEMINI_THINKING_BUDGET` are
 * env-tunable on purpose: they are the settings most likely to need changing
 * against real traffic, and a secret change is far cheaper than a redeploy.
 * Groq joins only with `LLM_FALLBACK=groq`: it is not a disclosed processor
 * (see the header of groq.ts), so the safe default is to fail rather than
 * send a photo there.
 */
export function defaultProviders(): LlmProvider[] {
  const thinking = Number(Deno.env.get('GEMINI_THINKING_BUDGET') ?? '0');
  const chain: LlmProvider[] = [
    createGeminiProvider({
      model: Deno.env.get('GEMINI_MODEL') ?? undefined,
      mediaResolution: Deno.env.get('GEMINI_MEDIA_RESOLUTION') ?? undefined,
      thinkingBudget: Number.isFinite(thinking) ? thinking : 0,
    }),
  ];
  if (Deno.env.get('LLM_FALLBACK') === 'groq') {
    chain.push(createGroqProvider({ model: Deno.env.get('GROQ_MODEL') ?? undefined }));
  }
  return chain;
}

/**
 * Sends one request, retrying and failing over per the policy above.
 *
 * Throws the LAST error seen, which is the one the user's failure is actually
 * attributable to — callers surface `error.userMessage`.
 */
export async function callModel(request: LlmRequest, options: CallOptions = {}): Promise<LlmResult> {
  const providers = (options.providers ?? defaultProviders()).filter((p) => p.isConfigured());
  const sleep = options.sleep ?? defaultSleep;
  const tag = options.label ? `${options.label}: ` : '';
  const attemptTimeout = options.attemptTimeoutMs ?? ATTEMPT_TIMEOUT_MS;
  const deadlineMs = options.deadlineMs ?? DEADLINE_MS;
  const calledAt = Date.now();
  const remaining = () => deadlineMs - (Date.now() - calledAt);
  const minAttempt = Math.min(MIN_ATTEMPT_MS, attemptTimeout);

  if (providers.length === 0) {
    throw new LlmError('auth', 'none', 'no LLM provider is configured (set GEMINI_API_KEY)');
  }

  let lastError: LlmError | undefined;

  for (const provider of providers) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (lastError && remaining() < minAttempt) {
        console.warn(`${tag}gave up after ${Date.now() - calledAt}ms: deadline reached`);
        throw lastError;
      }
      const startedAt = Date.now();
      try {
        const result = await withTimeout(provider, request, Math.min(attemptTimeout, remaining()));
        // After a retry or failover, the total is the number the user felt.
        console.log(
          `${tag}${provider.name}/${provider.model} ok in ${Date.now() - startedAt}ms ` +
            `(${result.usage.promptTokens}+${result.usage.outputTokens} tok` +
            `${lastError ? `, attempt ${attempt + 1}, ${Date.now() - calledAt}ms in all` : ''})`,
        );
        return result;
      } catch (raw) {
        const error =
          raw instanceof LlmError
            ? raw
            : new LlmError('unavailable', provider.name, String((raw as Error)?.message ?? raw), { cause: raw });
        lastError = error;
        console.warn(
          `${tag}${provider.name} ${error.kind}${error.status ? ` ${error.status}` : ''} ` +
            `after ${Date.now() - startedAt}ms: ${error.message}`,
        );

        // Our bug, or a decision about the content — stop the whole chain.
        if (!error.failoverable && !error.retryable) throw error;

        const canRetry = error.retryable && attempt < MAX_ATTEMPTS - 1;
        if (!canRetry) break; // fall through to the next provider

        // A wait that would eat the time the next attempt needs is not a wait.
        const wait = backoffFor(error, attempt);
        if (remaining() - wait < minAttempt) break;
        await sleep(wait);
      }
    }
  }

  throw lastError ?? new LlmError('unavailable', 'none', 'all providers failed');
}
