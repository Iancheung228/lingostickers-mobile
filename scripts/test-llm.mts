// ---------------------------------------------------------------------------
// Unit tests for the provider layer and the card schema registry.
//
//   node --experimental-strip-types --test scripts/test-llm.mts
//
// No network. Every provider here is driven by a fake transport, and the
// client's sleep is injected, so the retry/failover matrix runs instantly and
// deterministically.
//
// What these are actually protecting, in rough order of how badly it would
// hurt to get wrong:
//
//  1. The prose schema and the JSON schema agreeing. They are rendered from
//     one registry precisely so they cannot drift, and this asserts it for
//     every language and option combination rather than trusting the design.
//  2. Field ORDER. Gemini fills fields in schema order, so a `gloss` placed
//     before `sentence` would gloss a sentence that does not exist yet — and
//     would look like a model quality problem, not a config bug.
//  3. Error classification. Every retry and failover decision hangs off it,
//     and two cases are genuinely counter-intuitive: a bad Gemini API key
//     arrives as 400 INVALID_ARGUMENT (not 401), and Groq's daily-token wall
//     arrives as a 429 that will NOT clear inside a retry loop.
//  4. Failover policy. The dangerous direction is failing over too eagerly:
//     a malformed request that quietly falls back to a weaker model hides our
//     own bug forever.
// ---------------------------------------------------------------------------
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  type FieldKey,
  CARD_FIELDS,
  CATEGORIES,
  HEADWORD_FIELDS,
  PARTS_OF_SPEECH,
  assertFieldOrder,
  renderJsonSchema,
  renderProse,
} from '../supabase/functions/_shared/cardSchema.ts';
import {
  type LlmProvider,
  type LlmRequest,
  type LlmResult,
  LlmError,
  callModel,
  cleanJsonResponse,
  createGeminiProvider,
  createGroqProvider,
  httpStatusFor,
} from '../supabase/functions/_shared/llm/index.ts';
import type { Language } from '../supabase/functions/_shared/syllabus.ts';

const LANGUAGES: Language[] = ['fr', 'ja', 'yue'];
const INSIGHTS = ['targeted', 'free'] as const;

// ---------------------------------------------------------------------------
// 1. cardSchema — the prose and the JSON schema cannot drift
// ---------------------------------------------------------------------------

/** Pulls the field keys back out of the prose block the prompt embeds. */
function keysInProse(prose: string): string[] {
  return [...prose.matchAll(/^\s*"([a-z_]+)":/gm)].map((m) => m[1]);
}

test('schema: prose and JSON schema cover the identical key set', () => {
  const shapes: FieldKey[][] = [CARD_FIELDS, [...HEADWORD_FIELDS, 'category'], ['sentence', 'gloss', 'sentence_insight']];
  for (const language of LANGUAGES) {
    for (const insight of INSIGHTS) {
      for (const keys of shapes) {
        const opts = { language, insight };
        const prose = keysInProse(renderProse(keys, opts));
        const schema = renderJsonSchema(keys, opts) as any;
        assert.deepEqual(prose, keys, `${language}/${insight}: prose keys drifted from the request`);
        assert.deepEqual(Object.keys(schema.properties), keys, `${language}/${insight}: schema keys drifted`);
        assert.deepEqual(schema.propertyOrdering, keys, `${language}/${insight}: ordering drifted`);
        assert.deepEqual(schema.required, keys, `${language}/${insight}: required drifted`);
      }
    }
  }
});

test('schema: sentence is always generated before anything that describes it', () => {
  const schema = renderJsonSchema(CARD_FIELDS, { language: 'fr', insight: 'targeted' }) as any;
  const order: string[] = schema.propertyOrdering;
  const sentenceAt = order.indexOf('sentence');
  for (const dependent of ['sentence_translation', 'grammar_key', 'gloss', 'sentence_insight']) {
    assert.ok(order.indexOf(dependent) > sentenceAt, `${dependent} is ordered before sentence`);
  }
});

test('schema: a bad order is rejected rather than silently shipped', () => {
  const bad: FieldKey[] = ['gloss', 'sentence'];
  assert.throws(() => assertFieldOrder(bad), /generated before "sentence"/);
  assert.throws(() => renderProse(bad, { language: 'fr', insight: 'targeted' }), /before "sentence"/);
  assert.throws(() => renderJsonSchema(bad, { language: 'fr', insight: 'targeted' }), /before "sentence"/);
  // A list with no sentence at all has nothing to depend on it — allowed.
  assert.doesNotThrow(() => assertFieldOrder([...HEADWORD_FIELDS, 'category']));
});

test('schema: closed sets are enforced by the schema, not just described', () => {
  const schema = renderJsonSchema(CARD_FIELDS, { language: 'fr', insight: 'targeted' }) as any;
  assert.deepEqual(schema.properties.part_of_speech.enum, [...PARTS_OF_SPEECH]);
  assert.deepEqual(schema.properties.category.enum, [...CATEGORIES]);
  // The gloss is the one nested shape; its chunks must keep t-before-g.
  assert.deepEqual(schema.properties.gloss.items.required, ['t', 'g']);
});

test('schema: every prose line is a field, not an essay', () => {
  // The gloss instruction once lived inside the JSON example, which left the
  // model copying a "shape" that was not valid JSON.
  const prose = renderProse(CARD_FIELDS, { language: 'fr', insight: 'targeted' });
  for (const line of prose.split('\n').slice(1, -1)) {
    assert.match(line.trim(), /^"[a-z_]+": /, `schema line is not a field: ${line.trim().slice(0, 60)}…`);
  }
});

test('schema: the whole prose block is itself valid JSON', () => {
  // Stronger than the per-line check below, and it catches the specific bug
  // this refactor introduced once already: an unescaped double quote inside a
  // field description ("…would say \"have had\"…") makes the very example the
  // model is told to copy malformed. Every language and both insight modes.
  for (const language of LANGUAGES) {
    for (const insight of INSIGHTS) {
      const block = renderProse(CARD_FIELDS, { language, insight });
      assert.doesNotThrow(
        () => JSON.parse(block),
        `${language}/${insight}: the schema example the model must copy is not valid JSON`,
      );
    }
  }
});

test('schema: word and reading are genuinely per-language', () => {
  const rendered = LANGUAGES.map((language) => renderProse(['word', 'reading'], { language, insight: 'free' }));
  assert.equal(new Set(rendered).size, LANGUAGES.length, 'two languages share a headword description');
  assert.match(rendered[2], /Jyutping/, 'Cantonese lost its Jyutping instruction');
  assert.match(rendered[1], /romaji/, 'Japanese lost its romaji instruction');
});

test('schema: the sentence is described differently when translating one', () => {
  const scan = renderProse(['sentence'], { language: 'fr', insight: 'free' });
  const translated = renderProse(['sentence'], { language: 'fr', insight: 'free', sentenceAs: 'translation' });
  assert.notEqual(scan, translated);
  assert.match(translated, /French translation/);
});

// ---------------------------------------------------------------------------
// 2. Transport fakes
// ---------------------------------------------------------------------------

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

/** Records the request body so tests can assert on the wire shape. */
function captureTransport(responder: () => Response) {
  const calls: { url: string; body: any }[] = [];
  const transport = (async (url: any, init: any) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    return responder();
  }) as unknown as typeof fetch;
  return { calls, transport };
}

const GEMINI_OK = {
  candidates: [{ content: { parts: [{ text: '{"word":"Le Chat"}' }] }, finishReason: 'STOP' }],
  usageMetadata: { promptTokenCount: 1900, candidatesTokenCount: 400, thoughtsTokenCount: 12 },
};

const REQUEST: LlmRequest = {
  parts: [
    { kind: 'image', mimeType: 'image/jpeg', data: 'QUJD' },
    { kind: 'text', text: 'describe it' },
  ],
  responseSchema: { type: 'object', properties: { word: { type: 'string' } } },
  maxOutputTokens: 1400,
  temperature: 0.1,
};

// ---------------------------------------------------------------------------
// 3. Gemini adapter
// ---------------------------------------------------------------------------

test('gemini: builds the request shape the API actually accepts', async () => {
  const { calls, transport } = captureTransport(() => jsonResponse(200, GEMINI_OK));
  const provider = createGeminiProvider({ apiKey: 'k', transport });
  await provider.send(REQUEST);

  const { body, url } = calls[0];
  assert.match(url, /gemini-3\.1-flash-lite:generateContent/);
  assert.deepEqual(body.contents[0].parts[0], { inline_data: { mime_type: 'image/jpeg', data: 'QUJD' } });
  assert.deepEqual(body.contents[0].parts[1], { text: 'describe it' });
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.equal(body.generationConfig.mediaResolution, 'MEDIA_RESOLUTION_LOW');
  assert.equal(body.generationConfig.maxOutputTokens, 1400);
  assert.equal(body.generationConfig.temperature, 0.1);
  assert.ok(body.generationConfig.responseJsonSchema, 'structured output was not requested');
  // Measured: thinking on by default costs ~720ms of p50 for no quality gain.
  assert.equal(body.generationConfig.thinkingConfig.thinkingBudget, 0);
  // A refused scan is a photo the user spent and got nothing for.
  assert.equal(body.safetySettings.length, 4);
  assert.ok(body.safetySettings.every((s: any) => s.threshold === 'BLOCK_NONE'));
});

test('gemini: reasoning tokens are billed output and must be counted', async () => {
  const { transport } = captureTransport(() => jsonResponse(200, GEMINI_OK));
  const result = await createGeminiProvider({ apiKey: 'k', transport }).send(REQUEST);
  assert.equal(result.usage.promptTokens, 1900);
  assert.equal(result.usage.outputTokens, 412, 'thoughtsTokenCount was dropped from the bill');
  assert.equal(result.provider, 'gemini');
});

test('gemini: a rejected API key is auth, not a bad request', async () => {
  // This arrives as 400 INVALID_ARGUMENT. Only the detail reason separates a
  // credential fault (fail over) from our own malformed body (do not).
  const { transport } = captureTransport(() =>
    jsonResponse(400, {
      error: { code: 400, status: 'INVALID_ARGUMENT', message: 'API key not valid.', details: [{ reason: 'API_KEY_INVALID' }] },
    }),
  );
  const err = await createGeminiProvider({ apiKey: 'bad', transport }).send(REQUEST).catch((e) => e);
  assert.ok(err instanceof LlmError);
  assert.equal(err.kind, 'auth');
});

test('gemini: classifies the rest of the status space', async () => {
  const cases: [number, any, string][] = [
    [429, { error: { message: 'quota', details: [{ retryDelay: '7s' }] } }, 'rate_limit'],
    [503, { error: { message: 'high demand' } }, 'unavailable'],
    [500, { error: { message: 'boom' } }, 'unavailable'],
    [404, { error: { message: 'no such model' } }, 'invalid'],
    [400, { error: { message: 'temperature out of range' } }, 'invalid'],
  ];
  for (const [status, body, kind] of cases) {
    const { transport } = captureTransport(() => jsonResponse(status, body));
    const err = await createGeminiProvider({ apiKey: 'k', transport }).send(REQUEST).catch((e) => e);
    assert.equal(err.kind, kind, `HTTP ${status} classified as ${err.kind}`);
  }
});

test('gemini: honours the retryDelay hint buried in error details', async () => {
  const { transport } = captureTransport(() =>
    jsonResponse(429, { error: { message: 'quota', details: [{ retryDelay: '7s' }] } }),
  );
  const err = await createGeminiProvider({ apiKey: 'k', transport }).send(REQUEST).catch((e) => e);
  assert.equal(err.retryAfterMs, 7000);
});

test('gemini: safety refusals are surfaced as blocked, both shapes', async () => {
  const promptBlocked = captureTransport(() => jsonResponse(200, { promptFeedback: { blockReason: 'SAFETY' } }));
  const e1 = await createGeminiProvider({ apiKey: 'k', transport: promptBlocked.transport }).send(REQUEST).catch((e) => e);
  assert.equal(e1.kind, 'blocked');

  const responseBlocked = captureTransport(() => jsonResponse(200, { candidates: [{ finishReason: 'SAFETY' }] }));
  const e2 = await createGeminiProvider({ apiKey: 'k', transport: responseBlocked.transport }).send(REQUEST).catch((e) => e);
  assert.equal(e2.kind, 'blocked');
  // Blocked must never be retried or failed over — see the client tests.
  assert.equal(e2.retryable, false);
  assert.equal(e2.failoverable, false);
});

test('gemini: a truncated reply is empty, and says why', async () => {
  const { transport } = captureTransport(() =>
    jsonResponse(200, { candidates: [{ content: { parts: [] }, finishReason: 'MAX_TOKENS' }] }),
  );
  const err = await createGeminiProvider({ apiKey: 'k', transport }).send(REQUEST).catch((e) => e);
  assert.equal(err.kind, 'empty');
  assert.match(err.message, /MAX_TOKENS/, 'a token-cap truncation is indistinguishable from a flaky empty reply');
});

test('gemini: a network fault is retryable, not a crash', async () => {
  const transport = (async () => {
    throw new TypeError('fetch failed');
  }) as unknown as typeof fetch;
  const err = await createGeminiProvider({ apiKey: 'k', transport }).send(REQUEST).catch((e) => e);
  assert.equal(err.kind, 'timeout');
  assert.equal(err.retryable, true);
});

test('gemini: reports unconfigured when the key is absent', () => {
  assert.equal(createGeminiProvider({ apiKey: '' }).isConfigured(), false);
  assert.equal(createGeminiProvider({ apiKey: 'k' }).isConfigured(), true);
});

// ---------------------------------------------------------------------------
// 4. Groq adapter (failover only)
// ---------------------------------------------------------------------------

test('groq: images go as data URIs in OpenAI message shape', async () => {
  const { calls, transport } = captureTransport(() =>
    jsonResponse(200, { choices: [{ message: { content: '{"ok":1}' } }], usage: { prompt_tokens: 5000, completion_tokens: 300 } }),
  );
  await createGroqProvider({ apiKey: 'k', transport }).send(REQUEST);
  const content = calls[0].body.messages[0].content;
  assert.equal(content[0].image_url.url, 'data:image/jpeg;base64,QUJD');
  assert.equal(content[1].text, 'describe it');
  assert.equal(calls[0].body.reasoning_effort, 'none', 'Qwen would prepend a <think> block');
});

test('groq: the daily-token wall gives no retry hint, so the chain fails over', async () => {
  // Measured 2026-09-08: TPD appears in no header, only in the 429 body, and
  // the API asks for a 34-minute wait that must never become a 34-minute call.
  const { transport } = captureTransport(() =>
    new Response('Rate limit reached ... on tokens per day (TPD): Limit 200000', {
      status: 429,
      headers: { 'retry-after': '2048' },
    }),
  );
  const err = await createGroqProvider({ apiKey: 'k', transport }).send(REQUEST).catch((e) => e);
  assert.equal(err.kind, 'rate_limit');
  assert.equal(err.retryAfterMs, undefined, 'a spent daily budget must not be slept on');
  assert.match(err.message, /daily token budget/);
});

test('groq: an ordinary per-minute 429 keeps its short wait hint', async () => {
  const { transport } = captureTransport(() =>
    new Response('Rate limit reached, please try again in 7.95s', { status: 429 }),
  );
  const err = await createGroqProvider({ apiKey: 'k', transport }).send(REQUEST).catch((e) => e);
  assert.equal(err.retryAfterMs, 7950);
});

// ---------------------------------------------------------------------------
// 5. cleanJsonResponse
// ---------------------------------------------------------------------------

test('cleanJsonResponse strips fences and think blocks', () => {
  assert.equal(cleanJsonResponse('```json\n{"a":1}\n```'), '{"a":1}');
  assert.equal(cleanJsonResponse('<think>hmm</think>{"a":1}'), '{"a":1}');
  assert.equal(cleanJsonResponse('  {"a":1}  '), '{"a":1}');
  assert.equal(cleanJsonResponse('{"a":"```"}'), '{"a":"```"}', 'a fence inside a string was eaten');
});

// ---------------------------------------------------------------------------
// 6. The client: retry and failover policy
// ---------------------------------------------------------------------------

/** A provider that fails a scripted number of times, then succeeds. */
function fakeProvider(name: string, script: (LlmError | 'ok')[]): LlmProvider & { calls: number } {
  let calls = 0;
  const provider = {
    name,
    model: `${name}-test`,
    calls: 0,
    isConfigured: () => true,
    async send(): Promise<LlmResult> {
      const step = script[Math.min(calls, script.length - 1)];
      calls++;
      provider.calls = calls;
      if (step === 'ok') {
        return { text: `{"from":"${name}"}`, usage: { promptTokens: 1, outputTokens: 1 }, provider: name, model: name };
      }
      throw step;
    },
  };
  return provider;
}

const noSleep = async () => {};
const err = (kind: any, provider = 'p', opts = {}) => new LlmError(kind, provider, kind, opts);

test('client: returns the first success without touching the fallback', async () => {
  const primary = fakeProvider('primary', ['ok']);
  const fallback = fakeProvider('fallback', ['ok']);
  const result = await callModel(REQUEST, { providers: [primary, fallback], sleep: noSleep });
  assert.equal(result.text, '{"from":"primary"}');
  assert.equal(fallback.calls, 0, 'the fallback ran when it was not needed');
});

test('client: retries a transient fault on the same provider', async () => {
  const primary = fakeProvider('primary', [err('unavailable'), err('unavailable'), 'ok']);
  const fallback = fakeProvider('fallback', ['ok']);
  const result = await callModel(REQUEST, { providers: [primary, fallback], sleep: noSleep });
  assert.equal(primary.calls, 3);
  assert.equal(result.text, '{"from":"primary"}');
  assert.equal(fallback.calls, 0);
});

test('client: fails over only after retries are spent', async () => {
  const primary = fakeProvider('primary', [err('unavailable')]);
  const fallback = fakeProvider('fallback', ['ok']);
  const result = await callModel(REQUEST, { providers: [primary, fallback], sleep: noSleep });
  assert.equal(primary.calls, 3, 'gave up before exhausting retries');
  assert.equal(result.text, '{"from":"fallback"}');
});

test('client: a malformed request never falls back — that would hide our bug', async () => {
  const primary = fakeProvider('primary', [err('invalid')]);
  const fallback = fakeProvider('fallback', ['ok']);
  const thrown = await callModel(REQUEST, { providers: [primary, fallback], sleep: noSleep }).catch((e) => e);
  assert.ok(thrown instanceof LlmError);
  assert.equal(thrown.kind, 'invalid');
  assert.equal(primary.calls, 1, 'a malformed request was retried');
  assert.equal(fallback.calls, 0, 'a bug in our request was hidden behind the fallback model');
});

test('client: a safety refusal stops the chain and reaches the user', async () => {
  const primary = fakeProvider('primary', [err('blocked')]);
  const fallback = fakeProvider('fallback', ['ok']);
  const thrown = await callModel(REQUEST, { providers: [primary, fallback], sleep: noSleep }).catch((e) => e);
  assert.equal(thrown.kind, 'blocked');
  assert.equal(fallback.calls, 0, 'blocked content was silently re-asked of another vendor');
  assert.match(thrown.userMessage, /different object/);
});

test('client: an auth fault fails over immediately, without retrying', async () => {
  const primary = fakeProvider('primary', [err('auth')]);
  const fallback = fakeProvider('fallback', ['ok']);
  const result = await callModel(REQUEST, { providers: [primary, fallback], sleep: noSleep });
  assert.equal(primary.calls, 1, 'a bad key was retried, which can never help');
  assert.equal(result.text, '{"from":"fallback"}');
});

test('client: unconfigured providers are skipped, not failed through', async () => {
  const unconfigured = { ...fakeProvider('nokey', ['ok']), isConfigured: () => false };
  const fallback = fakeProvider('fallback', ['ok']);
  const result = await callModel(REQUEST, { providers: [unconfigured as LlmProvider, fallback], sleep: noSleep });
  assert.equal(result.text, '{"from":"fallback"}');
});

test('client: with nothing configured, says so instead of hanging', async () => {
  const thrown = await callModel(REQUEST, { providers: [], sleep: noSleep }).catch((e) => e);
  assert.equal(thrown.kind, 'auth');
  assert.match(thrown.message, /no LLM provider is configured/);
});

test('client: a provider asking for 34 minutes is capped at 6 seconds', async () => {
  const waits: number[] = [];
  const primary = fakeProvider('primary', [err('rate_limit', 'p', { retryAfterMs: 2_048_000 }), 'ok']);
  await callModel(REQUEST, {
    providers: [primary],
    sleep: async (ms) => {
      waits.push(ms);
    },
  });
  assert.deepEqual(waits, [6000], 'an unbounded provider hint became an unbounded request');
});

test('client: surfaces the last error when everything fails', async () => {
  const primary = fakeProvider('primary', [err('unavailable', 'primary')]);
  const fallback = fakeProvider('fallback', [err('rate_limit', 'fallback')]);
  const thrown = await callModel(REQUEST, { providers: [primary, fallback], sleep: noSleep }).catch((e) => e);
  assert.equal(thrown.kind, 'rate_limit');
  assert.equal(thrown.provider, 'fallback');
});

test('client: a non-LlmError from a provider is still classified', async () => {
  const broken = {
    name: 'broken',
    model: 'x',
    isConfigured: () => true,
    async send(): Promise<LlmResult> {
      throw new Error('undefined is not a function');
    },
  };
  const fallback = fakeProvider('fallback', ['ok']);
  const result = await callModel(REQUEST, { providers: [broken, fallback], sleep: noSleep });
  assert.equal(result.text, '{"from":"fallback"}');
});

// ---------------------------------------------------------------------------
// 7. What the client sees
// ---------------------------------------------------------------------------

test('errors map to sensible HTTP statuses', () => {
  assert.equal(httpStatusFor('rate_limit'), 429);
  assert.equal(httpStatusFor('unavailable'), 503);
  assert.equal(httpStatusFor('timeout'), 503);
  assert.equal(httpStatusFor('empty'), 503);
  assert.equal(httpStatusFor('blocked'), 422);
  assert.equal(httpStatusFor('auth'), 500);
  assert.equal(httpStatusFor('invalid'), 500);
});

test('no user-facing message leaks provider detail', () => {
  const kinds = ['rate_limit', 'unavailable', 'timeout', 'blocked', 'invalid', 'auth', 'empty'] as const;
  for (const kind of kinds) {
    const message = new LlmError(kind, 'gemini', 'quota exceeded for model gemini-3.1-flash-lite, TPD 200000').userMessage;
    assert.ok(message.length > 0, `${kind} has no user message`);
    for (const leak of ['gemini', 'groq', 'TPD', 'token', 'quota', 'API', 'HTTP']) {
      assert.ok(!message.toLowerCase().includes(leak.toLowerCase()), `${kind} leaks "${leak}" to the user: ${message}`);
    }
  }
});
