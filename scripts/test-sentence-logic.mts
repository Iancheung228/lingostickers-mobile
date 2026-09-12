// ---------------------------------------------------------------------------
// Unit tests for the two pure modules behind the sentence rewrite.
//
//   node --experimental-strip-types --test scripts/test-sentence-logic.mts
//
// These are the parts that can be wrong silently. A prompt that produces a
// weak sentence is visible the moment you read one; a gloss validator that
// accepts a mis-segmentation, or a rotation that quietly serves the same
// structure forever, is not.
//
// The gloss cases are the important half, and they are all cases seen in real
// model output: chunks that carry their trailing space and chunks that don't,
// a dropped final 。, a straight apostrophe where the sentence has a curly
// one, a capitalised first chunk. Each of those is a formatting difference
// and must pass. A dropped word, a reordered pair and an invented chunk are
// segmentation errors and must fail — that distinction is the whole job.
// ---------------------------------------------------------------------------
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  type GrammarTarget,
  type Language,
  bandFor,
  budgetFor,
  isKnownGrammarKey,
  pickTargets,
  renderTargetChoice,
} from '../supabase/functions/_shared/syllabus.ts';
import { normalizeGloss } from '../supabase/functions/_shared/gloss.ts';
import { glossFor } from '../lib/gloss.ts';

const LANGUAGES: Language[] = ['fr', 'ja', 'yue'];

// ---------------------------------------------------------------------------
// normalizeGloss — accepts formatting differences, rejects segmentation ones
// ---------------------------------------------------------------------------

const g = (...pairs: [string, string][]) => pairs.map(([t, gl]) => ({ t, g: gl }));

test('gloss: french chunks reconstruct the sentence', () => {
  const sentence = 'Je bois du café tous les matins.';
  const gloss = g(['Je', 'I'], ['bois', 'drink'], ['du', 'some (partitive)'],
    ['café', 'coffee'], ['tous les matins', 'every morning'], ['.', 'full stop']);
  assert.deepEqual(normalizeGloss(gloss, sentence)?.length, 6);
});

test('gloss: a dropped final period is a formatting difference, not an error', () => {
  const sentence = 'Je bois du café.';
  assert.ok(normalizeGloss(g(['Je', 'I'], ['bois', 'drink'], ['du', 'some'], ['café', 'coffee']), sentence));
});

test('gloss: an elision split across two chunks reconstructs', () => {
  const sentence = "J'ai cette tasse depuis trois ans.";
  const gloss = g(["J'", 'I'], ['ai', 'have'], ['cette', 'this'], ['tasse', 'cup'],
    ['depuis', 'for/since'], ['trois ans', 'three years']);
  assert.ok(normalizeGloss(gloss, sentence));
});

test('gloss: a curly apostrophe in the sentence matches a straight one in the chunks', () => {
  const sentence = 'C’est ma tasse.';
  assert.ok(normalizeGloss(g(["C'est", "it is"], ['ma', 'my'], ['tasse', 'cup']), sentence));
});

test('gloss: a capitalised chunk still matches', () => {
  assert.ok(normalizeGloss(g(['LE', 'the'], ['chat', 'cat'], ['dort', 'sleeps']), 'Le chat dort.'));
});

test('gloss: japanese reconstructs without any spaces', () => {
  const sentence = '机の上にコップがあります。';
  const gloss = g(['机', 'desk'], ['の上に', 'on top of'], ['コップ', 'cup'],
    ['が', 'subject marker'], ['あります', 'there is']);
  assert.ok(normalizeGloss(gloss, sentence));
});

test('gloss: the katakana long mark is a letter, not punctuation', () => {
  // Dropping ー from コーヒー is a real segmentation error, and the naive
  // punctuation strip (which eats -, – and —) is exactly what would let it
  // through.
  const sentence = 'コーヒーを飲みます。';
  assert.equal(normalizeGloss(g(['コヒ', 'coffee'], ['を', 'object marker'], ['飲みます', 'drink']), sentence), null);
  assert.ok(normalizeGloss(g(['コーヒー', 'coffee'], ['を', 'object marker'], ['飲みます', 'drink']), sentence));
});

test('gloss: cantonese aspect markers split off cleanly', () => {
  const sentence = '我飲咗成杯咖啡。';
  const gloss = g(['我', 'I'], ['飲', 'drink'], ['咗', 'completed action'],
    ['成杯', 'the whole cup of'], ['咖啡', 'coffee']);
  assert.ok(normalizeGloss(gloss, sentence));
});

test('gloss: a dropped word is rejected', () => {
  assert.equal(normalizeGloss(g(['Je', 'I'], ['café', 'coffee']), 'Je bois du café.'), null);
});

test('gloss: reordered chunks are rejected', () => {
  assert.equal(normalizeGloss(g(['bois', 'drink'], ['Je', 'I']), 'Je bois.'), null);
});

test('gloss: an invented chunk is rejected', () => {
  assert.equal(
    normalizeGloss(g(['Je', 'I'], ['bois', 'drink'], ['souvent', 'often']), 'Je bois.'),
    null,
  );
});

test('gloss: malformed shapes are rejected', () => {
  const s = 'Je bois.';
  assert.equal(normalizeGloss(null, s), null);
  assert.equal(normalizeGloss('Je / bois', s), null);
  assert.equal(normalizeGloss([], s), null);
  assert.equal(normalizeGloss([{ t: 'Je bois', g: 'I drink' }], s), null, 'one chunk is not a breakdown');
  assert.equal(normalizeGloss(g(['Je', 'I'], ['bois', '']), s), null, 'an empty meaning is not a gloss');
  assert.equal(normalizeGloss([{ t: 'Je', g: 'I' }, { t: 'bois' }], s), null);
  assert.equal(normalizeGloss(g(...Array(41).fill(['あ', 'ah']) as [string, string][]), 'あ'.repeat(41)), null);
});

test('gloss: an over-long meaning is truncated rather than rejected', () => {
  const long = 'x'.repeat(200);
  const out = normalizeGloss(g(['Je', 'I'], ['bois', long]), 'Je bois.');
  assert.ok(out);
  assert.equal(out![1].g.length, 60);
});

// ---------------------------------------------------------------------------
// The app-side copy has to agree with the edge-side one, or a gloss that was
// stored will refuse to render.
// ---------------------------------------------------------------------------

test('gloss: lib/gloss.ts agrees with the edge validator on every case above', () => {
  const cases: [unknown, string][] = [
    [g(['Je', 'I'], ['bois', 'drink'], ['du', 'some'], ['café', 'coffee']), 'Je bois du café.'],
    [g(["J'", 'I'], ['ai', 'have'], ['froid', 'cold']), "J'ai froid."],
    [g(['机', 'desk'], ['の上に', 'on'], ['コップ', 'cup'], ['が', 'subj'], ['あります', 'there is']), '机の上にコップがあります。'],
    [g(['我', 'I'], ['飲', 'drink'], ['咗', 'done'], ['咖啡', 'coffee']), '我飲咗咖啡。'],
    [g(['コヒ', 'coffee'], ['を', 'obj'], ['飲みます', 'drink']), 'コーヒーを飲みます。'],
    [g(['Je', 'I'], ['café', 'coffee']), 'Je bois du café.'],
    [g(['bois', 'drink'], ['Je', 'I']), 'Je bois.'],
    ['not an array', 'Je bois.'],
  ];
  for (const [raw, sentence] of cases) {
    const edge = normalizeGloss(raw, sentence) !== null;
    const app = glossFor(raw, sentence) !== null;
    assert.equal(app, edge, `disagreement on ${JSON.stringify(sentence)}`);
  }
});

test('gloss: the app side drops a gloss whose sentence was hand-edited', () => {
  const gloss = g(['Je', 'I'], ['bois', 'drink'], ['du', 'some'], ['café', 'coffee']);
  assert.ok(glossFor(gloss, 'Je bois du café.'));
  assert.equal(glossFor(gloss, 'Je bois du thé.'), null);
  assert.equal(glossFor(gloss, ''), null);
});

// ---------------------------------------------------------------------------
// syllabus — bands, rotation, and the invariants the stored key depends on
// ---------------------------------------------------------------------------

test('bands change hands where they are documented to', () => {
  assert.equal(bandFor(0), 1);
  assert.equal(bandFor(14), 1);
  assert.equal(bandFor(15), 2);
  assert.equal(bandFor(49), 2);
  assert.equal(bandFor(50), 3);
  assert.equal(bandFor(5000), 3);
});

test('every grammar key is globally unique and language-prefixed', () => {
  // Both matter because the keys share one TEXT column across all languages:
  // a collision would make a stored key ambiguous, and the prefix is what
  // makes a row readable without joining anything.
  const seen = new Set<string>();
  for (const language of LANGUAGES) {
    for (const key of keysOf(language)) {
      assert.ok(key.startsWith(`${language}.`), `${key} is not prefixed with ${language}.`);
      assert.ok(!seen.has(key), `duplicate key ${key}`);
      seen.add(key);
    }
  }
  assert.ok(seen.size >= 60, `expected a substantial syllabus, got ${seen.size} targets`);
});

test('isKnownGrammarKey rejects invented and cross-language keys', () => {
  assert.ok(isKnownGrammarKey('fr', 'fr.depuis'));
  assert.ok(!isKnownGrammarKey('ja', 'fr.depuis'));
  assert.ok(!isKnownGrammarKey('fr', 'fr.pluperfect-of-the-moon'));
  assert.ok(!isKnownGrammarKey('fr', ''));
  assert.ok(!isKnownGrammarKey('fr', 42 as unknown as string));
});

test('pickTargets always returns two distinct targets inside the learner band', () => {
  for (const language of LANGUAGES) {
    for (const count of [0, 3, 14, 15, 30, 49, 50, 200]) {
      for (let i = 0; i < 200; i++) {
        const [a, b] = pickTargets(language, count, []);
        assert.notEqual(a.key, b.key, `${language} @ ${count} returned the same target twice`);
        for (const t of [a, b]) {
          assert.ok(t.band <= bandFor(count), `${t.key} is above band ${bandFor(count)}`);
          assert.ok(isKnownGrammarKey(language, t.key));
          assert.ok(t.name && t.brief && t.example, `${t.key} is missing prompt copy`);
        }
      }
    }
  }
});

test('recent keys are excluded while the pool can afford it', () => {
  for (const language of LANGUAGES) {
    // Band 3 has the whole syllabus available, so a six-key window can always
    // be honoured.
    const recent = keysOf(language).slice(0, 6);
    for (let i = 0; i < 300; i++) {
      for (const t of pickTargets(language, 100, recent)) {
        assert.ok(!recent.includes(t.key), `${t.key} was served despite being in the no-repeat window`);
      }
    }
  }
});

test('an exhausted pool falls back rather than failing', () => {
  // A band-1 French learner has eight structures; a window listing every one
  // of them must not empty the pool.
  const everything = keysOf('fr');
  for (let i = 0; i < 100; i++) {
    const [a, b] = pickTargets('fr', 0, everything);
    assert.ok(a && b);
    assert.notEqual(a.key, b.key);
    assert.equal(a.band, 1);
  }
});

test('a mid-band learner keeps meeting earlier structures as well as new ones', () => {
  // The spacing claim in syllabus.ts: lower bands stay in the pool. If they
  // did not, a structure would be taught for fifteen cards and then never
  // appear again.
  const bands = new Set<number>();
  for (let i = 0; i < 500; i++) {
    for (const t of pickTargets('ja', 30, [])) bands.add(t.band);
  }
  assert.deepEqual([...bands].sort(), [1, 2]);
});

test('the current band is favoured over revision, not swamped by it', () => {
  let current = 0;
  let lower = 0;
  const draws = 4000;
  for (let i = 0; i < draws; i++) {
    // Only the primary is counted: the alternate is deliberately drawn from a
    // *different* band, so counting both would wash the weighting out.
    const [primary] = pickTargets('fr', 30, []);
    if (primary.band === 2) current++; else lower++;
  }
  const share = current / (current + lower);
  // Eight band-1 targets entered once, eight band-2 targets entered twice.
  assert.ok(share > 0.55 && share < 0.75, `current-band share was ${share.toFixed(2)}, expected ~0.67`);
});

test('budget copy exists for every band and language, and lengthens with the band', () => {
  for (const language of LANGUAGES) {
    for (const band of [1, 2, 3] as const) {
      const { length, vocabulary } = budgetFor(band, language);
      assert.ok(length.length > 10, `${language} band ${band} has no length guidance`);
      assert.ok(vocabulary.length > 10, `${language} band ${band} has no vocabulary guidance`);
    }
    assert.notEqual(budgetFor(1, language).length, budgetFor(3, language).length);
    // French counts words; the unsegmented scripts cannot, so they count
    // characters. Getting this backwards produces a nonsense instruction.
    const unit = language === 'fr' ? 'words' : 'characters';
    assert.ok(budgetFor(2, language).length.includes(unit), `${language} should budget in ${unit}`);
  }
});

test('the rendered target block names both keys and asks for one back', () => {
  const targets = pickTargets('yue', 100, []) as [GrammarTarget, GrammarTarget];
  const block = renderTargetChoice(targets);
  for (const t of targets) {
    assert.ok(block.includes(`"${t.key}"`), `${t.key} missing from the prompt block`);
    assert.ok(block.includes(t.brief), `${t.key}'s instruction missing from the prompt block`);
  }
  assert.ok(block.includes('grammar_key'), 'the model is never told where to report its choice');
});

/** Every key in a language's syllabus, discovered through the public API. */
function keysOf(language: Language): string[] {
  const found = new Set<string>();
  // pickTargets at band 3 draws from the whole syllabus; enough draws and it
  // has seen all of it. Cheaper than exporting the arrays purely for a test.
  for (let i = 0; i < 20000; i++) {
    for (const t of pickTargets(language, 1000, [])) found.add(t.key);
  }
  return [...found];
}

// ---------------------------------------------------------------------------
// Prompt assembly — the whole text, built by the shipping module, with the
// network stubbed out.
//
// Everything the model reads comes from four places (language schema,
// syllabus pick, band budget, the learner's own words) and none of them is
// legible from any one file. These check that the assembled result actually
// contains what each part promised to contribute — the failure mode being a
// refactor that quietly drops a section and leaves a prompt that still reads
// fine and teaches nothing.
// ---------------------------------------------------------------------------

const { identifyFromPhoto } = await import('../supabase/functions/_shared/vocab.ts');
const { capturingProvider } = await import('./captureProvider.mts');

/** Runs the real prompt builder and returns the text it would have sent. */
async function promptFor(language: Language, stickerCount: number, knownWords: { word: string; translation: string }[] = []) {
  const capture = capturingProvider();
  const realLog = console.log;
  console.log = () => {};
  try {
    await identifyFromPhoto('B64', language, 'SCENE', { stickerCount, knownWords, recentGrammarKeys: [] },
      { providers: [capture.provider], sleep: async () => {} });
  } finally {
    console.log = realLog;
  }
  return capture.prompt();
}

test('the prompt carries every section it is assembled from', async () => {
  for (const language of LANGUAGES) {
    const text = await promptFor(language, 30, [
      { word: 'A', translation: 'a' }, { word: 'B', translation: 'b' }, { word: 'C', translation: 'c' },
    ]);
    assert.match(text, /SAY IT, DON'T CAPTION IT/, `${language}: register rule missing`);
    assert.match(text, /Build the sentence around ONE of these two structures/, `${language}: no grammar target`);
    assert.match(text, /GROUND IT IN THIS PHOTOGRAPH/, `${language}: no photo grounding`);
    assert.match(text, /KEEP THE VOCABULARY USABLE/, `${language}: no vocabulary budget`);
    assert.match(text, /THEN BREAK IT DOWN/, `${language}: no gloss instruction`);
    assert.match(text, /"grammar_key"/, `${language}: never asked for the key back`);
    assert.match(text, /"gloss"/, `${language}: gloss missing from the schema`);
    assert.match(text, /"sentence_insight"/, `${language}: insight missing from the schema`);
    // Two keys offered, and each named in the schema instruction.
    const offered = [...text.matchAll(/• "([a-z]+\.[a-z-]+)"/g)].map(m => m[1]);
    assert.equal(offered.length, 2, `${language}: expected exactly two offered targets, got ${offered.length}`);
    for (const key of offered) assert.ok(isKnownGrammarKey(language, key), `${language}: offered unknown key ${key}`);
    assert.notEqual(offered[0], offered[1]);
  }
});

test('the band budget reaches the prompt, in the right units', async () => {
  const fr1 = await promptFor('fr', 0);
  const fr3 = await promptFor('fr', 200);
  assert.ok(fr1.includes(budgetFor(1, 'fr').length), 'band-1 length budget missing');
  assert.ok(fr3.includes(budgetFor(3, 'fr').length), 'band-3 length budget missing');
  assert.ok(fr1.includes('most common 1000'), 'band-1 frequency ceiling missing');
  assert.ok(fr3.includes('most common 3000'), 'band-3 frequency ceiling missing');
  // The ceiling discriminates by word class, not by a raw count — naming a
  // real thing in the photo has to stay allowed however uncommon the noun is,
  // or the sentence stops being about the photograph. See budgetFor.
  assert.match(fr1, /uncommon ADJECTIVES and VERBS/, 'the ceiling has gone back to banning nouns');

  const ja = await promptFor('ja', 0);
  assert.ok(ja.includes('characters'), 'an unsegmented script must be budgeted in characters');
  assert.ok(!ja.includes('6–10 words'), 'a word budget leaked into a script with no word spacing');
});

test('a brand-new learner is not shown a revision list', async () => {
  const fresh = await promptFor('fr', 0);
  assert.ok(!fresh.includes('REUSE A WORD THEY ALREADY HAVE'), 'offered revision to someone with no cards');

  // Two words is not a pool, it is a requirement in disguise — the model would
  // wedge one in every time.
  const two = await promptFor('fr', 20, [{ word: 'La Table', translation: 'Table' }, { word: 'Le Chat', translation: 'Cat' }]);
  assert.ok(!two.includes('REUSE A WORD THEY ALREADY HAVE'));

  const enough = await promptFor('fr', 20, [
    { word: 'La Table', translation: 'Table' }, { word: 'Le Chat', translation: 'Cat' }, { word: 'Le Livre', translation: 'Book' },
  ]);
  assert.ok(enough.includes('REUSE A WORD THEY ALREADY HAVE'));
  assert.ok(enough.includes('La Table (Table)'), 'known words are not rendered with their meanings');
});

test('grounding beats the vocabulary budget, and says so', async () => {
  // Rule 3 (be specific about THIS photo) and rule 4 (stay inside a common
  // vocabulary) genuinely pull apart, and a prompt that states both as equals
  // gets whichever the model feels like.
  //
  // The first version resolved it the wrong way round — rule 4 won, with
  // "pick a different detail" offered as the escape. Measured against real
  // photographs that produced "Il y a du soleil dans le ciel" and
  // "ビルは高いです": sentences that would fit any photograph ever taken, from
  // an app whose whole premise is that the sentence is about yours. The
  // escape hatch was taken in every single run.
  //
  // So this asserts both directions: that grounding is named as the rule that
  // wins, and that the old wording has not crept back.
  for (const language of LANGUAGES) {
    const text = await promptFor(language, 30);
    assert.match(text, /never overrides it/, `${language}: rule 4 no longer defers to rule 3`);
    assert.ok(!text.includes('THIS ONE WINS'), `${language}: the reversed tie-break is back`);
    assert.ok(!/pick a different detail/.test(text), `${language}: the escape hatch from the photo is back`);
  }
});

test('two details are asked for, not "one or two"', async () => {
  // Offered a range, the model took the minimum in six runs out of six. The
  // old prompt this replaced said "at least TWO" and reliably got two.
  for (const language of LANGUAGES) {
    const text = await promptFor(language, 0);
    assert.match(text, /TWO concrete details/, `${language}: detail count is not pinned at two`);
    assert.ok(!/ONE or TWO concrete details/.test(text), `${language}: the range is back`);
    assert.match(text, /could this sentence describe a different photograph/, `${language}: no self-check on grounding`);
  }
});

test('the schema block shows a shape, not an essay', async () => {
  // The gloss instruction used to live inside the JSON example, which left
  // the model copying a "shape" that was not valid JSON. Everything between
  // the braces should now be one "key": value line each.
  const text = await promptFor('fr', 0);
  const block = text.slice(text.lastIndexOf('{'), text.lastIndexOf('}') + 1);
  for (const line of block.split('\n').slice(1, -1)) {
    assert.match(line.trim(), /^"[a-z_]+": /, `schema line is not a field: ${line.trim().slice(0, 60)}…`);
  }
});
