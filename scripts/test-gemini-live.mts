// ---------------------------------------------------------------------------
// Live end-to-end tests against the real provider.
//
//   GEMINI_API_KEY=… node --experimental-strip-types --test scripts/test-gemini-live.mts
//   LIVE_LANGS=fr,ja,yue  … widen the language matrix (default: fr)
//
// These cost real API calls, so they are opt-in: with no key present every
// test skips rather than fails, and CI stays green without credentials.
//
// This is the half `test-llm.mts` cannot cover. The unit tests prove we build
// a correct request and classify every failure; only this proves the request
// we build is one the provider actually accepts, that structured output really
// constrains the reply, and that the card which comes back is usable. Every
// assertion here is a property of a *shippable card*, not of a HTTP response.
//
// Photographs are downloaded once into scripts/fixtures/.cache (gitignored)
// and cropped with `sips` (macOS). Without sips the scan tests skip.
// ---------------------------------------------------------------------------
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { SCAN_CASES, type ScanCase } from './fixtures/scanCases.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, 'fixtures', '.cache');

const HAS_KEY = Boolean(process.env.GEMINI_API_KEY);
const HAS_SIPS = (() => {
  try {
    execFileSync('sips', ['--help'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

const LANGS = (process.env.LIVE_LANGS ?? 'fr').split(',') as ('fr' | 'ja' | 'yue')[];

// The edge functions read Deno.env; under node we hand them the same names.
(globalThis as any).Deno = {
  env: { get: (k: string) => process.env[k] },
};

const { identifyFromPhoto, translateWord, translateSentence, getAcceptedAnswers } = await import(
  '../supabase/functions/_shared/vocab.ts'
);
const { isKnownGrammarKey } = await import('../supabase/functions/_shared/syllabus.ts');
const { normalizeGloss } = await import('../supabase/functions/_shared/gloss.ts');
const { CATEGORIES, PARTS_OF_SPEECH } = await import('../supabase/functions/_shared/cardSchema.ts');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

async function download(url: string, to: string): Promise<void> {
  if (existsSync(to)) return;
  const res = await fetch(url, { headers: { 'User-Agent': 'tabi-stickers-tests/1.0' } });
  if (!res.ok) throw new Error(`fixture download failed (${res.status}): ${url}`);
  writeFileSync(to, Buffer.from(await res.arrayBuffer()));
}

function dimensions(file: string): [number, number] {
  const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file]).toString();
  return [Number(out.match(/pixelWidth: (\d+)/)![1]), Number(out.match(/pixelHeight: (\d+)/)![1])];
}

/**
 * Reproduces exactly what the app sends: a tight q92 crop of the user's
 * selection, and the wider scene capped at 640px. Both matter — the crop says
 * WHICH object, the scene is what the sentence describes.
 */
function buildPair(kase: ScanCase): { crop: string; scene: string } {
  const source = join(CACHE, `${kase.name}.jpg`);
  const crop = join(CACHE, `${kase.name}_crop.jpg`);
  const scene = join(CACHE, `${kase.name}_scene.jpg`);
  if (!existsSync(crop)) {
    const [w, h] = dimensions(source);
    const [x0, y0, x1, y1] = kase.box;
    // --cropOffset is measured from the top-left, not from the centre.
    const args = [
      '-c', String(Math.round((y1 - y0) * h)), String(Math.round((x1 - x0) * w)),
      '--cropOffset', String(Math.round(y0 * h)), String(Math.round(x0 * w)),
      '-s', 'format', 'jpeg', '-s', 'formatOptions', '92',
      source, '--out', crop,
    ];
    execFileSync('sips', args, { stdio: 'ignore' });
  }
  if (!existsSync(scene)) {
    execFileSync('sips', ['-Z', '640', '-s', 'format', 'jpeg', '-s', 'formatOptions', '60', source, '--out', scene], { stdio: 'ignore' });
  }
  return { crop, scene };
}

const b64 = (f: string) => readFileSync(f).toString('base64');

if (HAS_KEY && HAS_SIPS) {
  mkdirSync(CACHE, { recursive: true });
  await Promise.all(SCAN_CASES.map((c) => download(c.url, join(CACHE, `${c.name}.jpg`))));
}

const skip = !HAS_KEY
  ? 'no GEMINI_API_KEY — set it to run the live suite'
  : !HAS_SIPS
    ? 'sips not available (macOS only) — cannot build crop fixtures'
    : false;

// ---------------------------------------------------------------------------
// Card-shape assertions, applied to every scan
// ---------------------------------------------------------------------------

const normalize = (s: unknown) =>
  String(s ?? '').toLowerCase().replace(/^(the|a|an)\s+/, '').replace(/[.,!]/g, '').trim();

function assertUsableCard(card: any, language: string, label: string) {
  // 1. Structured output should make an unparseable or partial card impossible.
  for (const field of ['word', 'translation', 'part_of_speech', 'reading', 'sentence', 'sentence_translation', 'sentence_insight', 'category']) {
    assert.ok(typeof card[field] === 'string' && card[field].length > 0, `${label}: "${field}" missing or empty`);
  }

  // 2. Closed sets are declared as enums in the schema — the provider should
  //    be enforcing them, so a violation means the schema was not applied.
  assert.ok(
    (PARTS_OF_SPEECH as readonly string[]).includes(card.part_of_speech),
    `${label}: part_of_speech "${card.part_of_speech}" is outside the enum — is responseJsonSchema being sent?`,
  );
  assert.ok(
    (CATEGORIES as readonly string[]).includes(card.category),
    `${label}: category "${card.category}" is outside the enum`,
  );

  // 3. A stored grammar_key drives the next scan's no-repeat window and the
  //    card's teaching note. An invented one poisons both.
  assert.ok(card.grammar_key, `${label}: grammar_key was rejected as unknown`);
  assert.ok(isKnownGrammarKey(language as any, card.grammar_key), `${label}: grammar_key "${card.grammar_key}" is not in the syllabus`);

  // 4. The gloss must reconstruct the sentence, or it teaches boundaries that
  //    do not exist. vocab.ts nulls it when it fails; that is a failed card.
  assert.ok(Array.isArray(card.gloss) && card.gloss.length > 0, `${label}: gloss was rejected — chunks do not reconstruct the sentence`);
  assert.deepEqual(
    normalizeGloss(card.gloss, card.sentence)?.length,
    card.gloss.length,
    `${label}: gloss does not re-validate against its own sentence`,
  );

  // 5. A vocabulary card whose example sentence omits the word being taught
  //    is not a vocabulary card. (Caught fr.pronom-cod doing exactly this.)
  const stem = language === 'fr'
    ? String(card.word).toLowerCase().replace(/^(le|la|les|l'|un|une|des)\s*/, '').trim()
    : String(card.word).trim();
  assert.ok(
    String(card.sentence).toLowerCase().includes(stem.toLowerCase()),
    `${label}: headword "${card.word}" does not appear in its own example sentence: "${card.sentence}"`,
  );
}

// ---------------------------------------------------------------------------
// The scan cases
// ---------------------------------------------------------------------------

for (const kase of SCAN_CASES) {
  for (const language of LANGS) {
    test(`live scan: ${kase.name} (${language}) — ${kase.why}`, { skip }, async () => {
      const { crop, scene } = buildPair(kase);
      const card: any = await identifyFromPhoto(b64(crop), language, b64(scene), {
        stickerCount: 60,
        knownWords: [],
        recentGrammarKeys: [],
      });

      const label = `${kase.name}/${language}`;
      assertUsableCard(card, language, label);

      // The finding that decided the migration: does it name the object the
      // user actually selected, rather than the most eye-catching thing?
      const got = normalize(card.translation);
      assert.ok(
        kase.expect.some((want) => got === want || got.includes(want) || want.includes(got)),
        `${label}: identified "${card.word}" (${card.translation}) — expected one of: ${kase.expect.join(', ')}`,
      );
    });
  }
}

// ---------------------------------------------------------------------------
// The other three endpoints — text-only, and easy to forget in a migration
// ---------------------------------------------------------------------------

test('live: translateWord returns only headword fields', { skip }, async () => {
  const card: any = await translateWord('bicycle', 'fr');
  for (const field of ['word', 'translation', 'part_of_speech', 'reading', 'category']) {
    assert.ok(card[field], `translateWord: "${field}" missing`);
  }
  assert.match(normalize(card.translation), /bicycle|bike/);
  // This path deliberately asks for no sentence; generating one would be
  // tokens and latency spent on fields both callers throw away.
  assert.equal(card.sentence, undefined, 'translateWord regressed into generating a sentence');
});

test('live: translateSentence glosses what it actually wrote', { skip }, async () => {
  const out: any = await translateSentence('I drink coffee every morning.', 'fr');
  assert.ok(out.sentence?.length > 0);
  assert.ok(Array.isArray(out.gloss) && out.gloss.length > 0, 'gloss was rejected');
  assert.deepEqual(normalizeGloss(out.gloss, out.sentence)?.length, out.gloss.length);
  assert.ok(out.sentence_insight?.length > 0);
});

test('live: getAcceptedAnswers returns plausible synonyms, never throws', { skip }, async () => {
  const synonyms = await getAcceptedAnswers('Le Vélo', 'fr');
  assert.ok(Array.isArray(synonyms), 'must always return an array');
  for (const s of synonyms) assert.equal(typeof s, 'string');
});

test('live: an unusable model config surfaces as a clean error, not a crash', { skip }, async () => {
  const { createGeminiProvider, LlmError } = await import('../supabase/functions/_shared/llm/index.ts');
  const provider = createGeminiProvider({ model: 'gemini-does-not-exist' });
  const thrown = await provider
    .send({ parts: [{ kind: 'text', text: 'hi' }], maxOutputTokens: 16, temperature: 0 })
    .catch((e) => e);
  assert.ok(thrown instanceof LlmError, 'a bad model id escaped as a raw error');
  assert.equal(thrown.kind, 'invalid');
});
