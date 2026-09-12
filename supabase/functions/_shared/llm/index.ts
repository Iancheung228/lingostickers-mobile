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

export interface CallOptions {
  /** Overrides the default chain. Used by tests; production passes nothing. */
  providers?: LlmProvider[];
  /** Injected so retry logic is testable without real waiting. */
  sleep?: (ms: number) => Promise<void>;
  /** Tags log lines so a slow path can be found in the function logs. */
  label?: string;
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
 * The production provider chain, read from the environment.
 *
 * `GEMINI_MODEL`, `GEMINI_MEDIA_RESOLUTION` and `GEMINI_THINKING_BUDGET` are
 * env-tunable on purpose: they are the settings most likely to need changing
 * against real traffic, and a secret change is far cheaper than a redeploy.
 * `LLM_FALLBACK=off` drops Groq.
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
  if ((Deno.env.get('LLM_FALLBACK') ?? 'groq') !== 'off') {
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

  if (providers.length === 0) {
    throw new LlmError('auth', 'none', 'no LLM provider is configured (set GEMINI_API_KEY)');
  }

  let lastError: LlmError | undefined;

  for (const provider of providers) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const startedAt = Date.now();
      try {
        const result = await provider.send(request);
        console.log(
          `${tag}${provider.name}/${provider.model} ok in ${Date.now() - startedAt}ms ` +
            `(${result.usage.promptTokens}+${result.usage.outputTokens} tok` +
            `${attempt > 0 ? `, attempt ${attempt + 1}` : ''})`,
        );
        return result;
      } catch (raw) {
        const error =
          raw instanceof LlmError
            ? raw
            : new LlmError('unavailable', provider.name, String((raw as Error)?.message ?? raw), { cause: raw });
        lastError = error;
        console.warn(`${tag}${provider.name} ${error.kind}${error.status ? ` ${error.status}` : ''}: ${error.message}`);

        // Our bug, or a decision about the content — stop the whole chain.
        if (!error.failoverable && !error.retryable) throw error;

        const canRetry = error.retryable && attempt < MAX_ATTEMPTS - 1;
        if (!canRetry) break; // fall through to the next provider

        await sleep(backoffFor(error, attempt));
      }
    }
  }

  throw lastError ?? new LlmError('unavailable', 'none', 'all providers failed');
}
