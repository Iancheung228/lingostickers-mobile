// ---------------------------------------------------------------------------
// Provider-neutral types for the one model call this app makes.
//
// `vocab.ts` builds prompts and parses cards; it should not know what an
// `inline_data` part or a `max_completion_tokens` is. Everything below is the
// vocabulary both sides share, so swapping providers is an adapter change and
// nothing else. (Swapping providers is not hypothetical here: the app moved
// off Groq because its only vision models were Preview-status.)
// ---------------------------------------------------------------------------

/** One piece of a request. Images are raw base64 — no data: URI prefix. */
export type LlmPart =
  | { kind: 'text'; text: string }
  | { kind: 'image'; mimeType: string; data: string };

export interface LlmRequest {
  parts: LlmPart[];
  /**
   * JSON Schema the reply must satisfy. Providers that support native
   * structured output enforce it; the rest ignore it, which is safe because
   * the same shape is always also stated as prose inside the prompt
   * (see `cardSchema.ts` — both are rendered from one registry).
   */
  responseSchema?: Record<string, unknown>;
  maxOutputTokens: number;
  temperature: number;
}

export interface LlmUsage {
  promptTokens: number;
  /** Completion tokens including any the provider spent on hidden reasoning. */
  outputTokens: number;
}

export interface LlmResult {
  /** The model's text, already stripped of markdown fences and think-blocks. */
  text: string;
  usage: LlmUsage;
  provider: string;
  model: string;
}

/**
 * Why a call failed, in the only terms the caller needs: may I retry, may I
 * try another provider, and what do I tell the user?
 */
export type LlmErrorKind =
  /** Rate or quota limit. Retryable; `retryAfterMs` is set when known. */
  | 'rate_limit'
  /** Provider is up but this request could not be served (5xx). Retryable. */
  | 'unavailable'
  /** Network fault or abort. Retryable. */
  | 'timeout'
  /** A safety filter refused the content. NOT retryable and NOT worth
   *  failing over — another provider will very likely refuse it too, and the
   *  user needs to be told rather than silently served something else. */
  | 'blocked'
  /** We sent something malformed. Our bug — never fail over, or the bug hides. */
  | 'invalid'
  /** Missing or rejected credentials. Config fault; failing over is worth a try. */
  | 'auth'
  /** 2xx but nothing usable came back. Retryable once — often a truncation. */
  | 'empty';

const RETRYABLE: ReadonlySet<LlmErrorKind> = new Set<LlmErrorKind>([
  'rate_limit',
  'unavailable',
  'timeout',
  'empty',
]);

/** Kinds where trying a different provider is sensible after retries run out. */
const FAILOVERABLE: ReadonlySet<LlmErrorKind> = new Set<LlmErrorKind>([
  'rate_limit',
  'unavailable',
  'timeout',
  'empty',
  'auth',
]);

export class LlmError extends Error {
  readonly kind: LlmErrorKind;
  readonly provider: string;
  readonly status?: number;
  readonly retryAfterMs?: number;

  constructor(
    kind: LlmErrorKind,
    provider: string,
    message: string,
    opts: { status?: number; retryAfterMs?: number; cause?: unknown } = {},
  ) {
    super(message, { cause: opts.cause });
    this.name = 'LlmError';
    this.kind = kind;
    this.provider = provider;
    this.status = opts.status;
    this.retryAfterMs = opts.retryAfterMs;
  }

  get retryable(): boolean {
    return RETRYABLE.has(this.kind);
  }

  get failoverable(): boolean {
    return FAILOVERABLE.has(this.kind);
  }

  /**
   * What the person holding the phone should see. Never the raw provider
   * message — those name models and quotas and mean nothing to a learner.
   */
  get userMessage(): string {
    switch (this.kind) {
      case 'rate_limit':
        return "We're a bit busy right now — give it a few seconds and try again.";
      case 'unavailable':
      case 'timeout':
      case 'empty':
        return "We couldn't read that photo just now. Please try again.";
      case 'blocked':
        return "We couldn't make a card from that photo. Try a different object.";
      case 'auth':
      case 'invalid':
        return 'Something went wrong on our side. Please try again shortly.';
    }
  }
}

export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  /** False when the provider's key is absent, so the chain can skip it. */
  isConfigured(): boolean;
  send(request: LlmRequest): Promise<LlmResult>;
}

/** Injectable so tests can drive providers without a network. */
export type Transport = typeof fetch;

/**
 * Strips the wrappers models put around JSON: markdown fences, and the
 * <think> block reasoning models emit even when asked not to.
 *
 * Kept provider-neutral because both adapters need it — Gemini can still
 * fence when `responseMimeType` is unset, and Groq's Qwen reasons by default.
 */
export function cleanJsonResponse(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

/**
 * What HTTP status a client should see for a given failure.
 *
 * Lives beside the taxonomy rather than in the edge functions so every
 * endpoint answers the same way, and so it can be tested without pulling in
 * a Supabase client.
 */
export function httpStatusFor(kind: LlmErrorKind): number {
  switch (kind) {
    case 'rate_limit': return 429;
    case 'unavailable':
    case 'timeout':
    case 'empty': return 503;
    case 'blocked': return 422;
    case 'auth':
    case 'invalid': return 500;
  }
}
