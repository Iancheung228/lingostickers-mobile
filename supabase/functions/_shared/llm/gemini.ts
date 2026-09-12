// ---------------------------------------------------------------------------
// Gemini adapter — the primary provider.
//
// Everything unusual in here was measured against the live API on 2026-09-09,
// not inferred from docs. The three that would have cost real debugging time:
//
//  * `mediaResolution` is a WHOLE-REQUEST setting on generateContent.
//    Per-part `media_resolution` is rejected on every 3.x model, so the crop
//    and the scene necessarily share one resolution. LOW = 268 tokens/image;
//    image pixel dimensions do not affect the count at all.
//  * Thinking is ON by default and is pure latency here — this is one
//    structured extraction, not a problem to reason about. `thinkingBudget: 0`
//    cut p50 from 3.0s to 2.3s with no measured quality loss.
//  * A bad API key returns **400 INVALID_ARGUMENT**, not 401. Only
//    `error.details[].reason === 'API_KEY_INVALID'` separates a credential
//    fault from a malformed request, and they need opposite handling.
// ---------------------------------------------------------------------------

import {
  type LlmProvider,
  type LlmRequest,
  type LlmResult,
  type Transport,
  LlmError,
  cleanJsonResponse,
} from './types.ts';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Safety thresholds.
 *
 * These are set to the most permissive setting deliberately. The input is a
 * photograph of an object the user chose to learn the word for, and the
 * output is a vocabulary card; the default thresholds are tuned for
 * open-ended chat and will occasionally refuse an ordinary kitchen knife, a
 * medicine packet or a bottle of wine. A refusal here is a scan the user paid
 * for with a photo and got nothing back from.
 *
 * This lowers *model-level* filtering only. It does not disable Google's
 * prohibited-use enforcement, and the app's own reporting flow
 * (`content_reports`) remains how genuinely bad content is handled.
 */
const SAFETY_CATEGORIES = [
  'HARM_CATEGORY_HARASSMENT',
  'HARM_CATEGORY_HATE_SPEECH',
  'HARM_CATEGORY_SEXUALLY_EXPLICIT',
  'HARM_CATEGORY_DANGEROUS_CONTENT',
] as const;

export interface GeminiOptions {
  apiKey?: string;
  model?: string;
  /** MEDIA_RESOLUTION_LOW | _MEDIUM | _HIGH. Whole-request, not per-image. */
  mediaResolution?: string;
  /** 0 disables reasoning. Anything else is latency we do not need. */
  thinkingBudget?: number;
  transport?: Transport;
}

interface GeminiErrorBody {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    details?: { reason?: string }[];
  };
}

/** Parses Google's "retry after" hint out of a RetryInfo detail or a header. */
function retryAfterMs(response: Response, body: GeminiErrorBody): number | undefined {
  const header = response.headers.get('retry-after');
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return seconds * 1000;
  }
  const raw = JSON.stringify(body?.error?.details ?? []);
  const match = raw.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  if (match) return parseFloat(match[1]) * 1000;
  return undefined;
}

function classify(response: Response, body: GeminiErrorBody): LlmError {
  const err = body?.error ?? {};
  const message = err.message ?? `HTTP ${response.status}`;
  const reasons = (err.details ?? []).map((d) => d?.reason).filter(Boolean);
  const status = response.status;

  // A rejected key arrives as 400 INVALID_ARGUMENT — see the header comment.
  if (reasons.includes('API_KEY_INVALID') || status === 401 || status === 403) {
    return new LlmError('auth', 'gemini', message, { status });
  }
  if (status === 429) {
    return new LlmError('rate_limit', 'gemini', message, {
      status,
      retryAfterMs: retryAfterMs(response, body),
    });
  }
  if (status >= 500) {
    return new LlmError('unavailable', 'gemini', message, { status });
  }
  if (status === 404) {
    // A model id that does not exist is a config fault, not a bad request we
    // should keep retrying against.
    return new LlmError('invalid', 'gemini', `unknown model: ${message}`, { status });
  }
  return new LlmError('invalid', 'gemini', message, { status });
}

export function createGeminiProvider(options: GeminiOptions = {}): LlmProvider {
  const model = options.model ?? 'gemini-3.1-flash-lite';
  const mediaResolution = options.mediaResolution ?? 'MEDIA_RESOLUTION_LOW';
  const thinkingBudget = options.thinkingBudget ?? 0;
  const transport = options.transport ?? fetch;
  const resolveKey = () => options.apiKey ?? Deno.env.get('GEMINI_API_KEY') ?? '';

  return {
    name: 'gemini',
    model,
    isConfigured: () => resolveKey().length > 0,

    async send(request: LlmRequest): Promise<LlmResult> {
      const apiKey = resolveKey();
      if (!apiKey) throw new LlmError('auth', 'gemini', 'GEMINI_API_KEY not set');

      const parts = request.parts.map((part) =>
        part.kind === 'text'
          ? { text: part.text }
          : { inline_data: { mime_type: part.mimeType, data: part.data } },
      );

      const body = {
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: request.temperature,
          maxOutputTokens: request.maxOutputTokens,
          mediaResolution,
          responseMimeType: 'application/json',
          ...(request.responseSchema ? { responseJsonSchema: request.responseSchema } : {}),
          thinkingConfig: { thinkingBudget },
        },
        safetySettings: SAFETY_CATEGORIES.map((category) => ({ category, threshold: 'BLOCK_NONE' })),
      };

      let response: Response;
      try {
        response = await transport(`${ENDPOINT}/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } catch (cause) {
        throw new LlmError('timeout', 'gemini', 'network error calling Gemini', { cause });
      }

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw classify(response, payload as GeminiErrorBody);

      // A prompt refused outright reports no candidate at all.
      const blockReason = payload?.promptFeedback?.blockReason;
      if (blockReason) {
        throw new LlmError('blocked', 'gemini', `prompt blocked: ${blockReason}`, { status: 200 });
      }

      const candidate = payload?.candidates?.[0];
      const finish = candidate?.finishReason;
      if (finish === 'SAFETY' || finish === 'PROHIBITED_CONTENT' || finish === 'IMAGE_SAFETY') {
        throw new LlmError('blocked', 'gemini', `response blocked: ${finish}`, { status: 200 });
      }

      const text = (candidate?.content?.parts ?? [])
        .map((p: { text?: string }) => p?.text ?? '')
        .join('')
        .trim();

      if (!text) {
        // MAX_TOKENS here means the schema did not fit in maxOutputTokens —
        // worth naming, because it looks identical to a flaky empty response
        // and is fixed by a config change rather than a retry.
        throw new LlmError('empty', 'gemini', `no text in response (finishReason=${finish ?? 'none'})`, {
          status: 200,
        });
      }

      const usage = payload?.usageMetadata ?? {};
      return {
        text: cleanJsonResponse(text),
        usage: {
          promptTokens: usage.promptTokenCount ?? 0,
          outputTokens: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
        },
        provider: 'gemini',
        model,
      };
    },
  };
}
