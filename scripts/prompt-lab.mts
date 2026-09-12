// ---------------------------------------------------------------------------
// prompt-lab — run the real sentence prompt against real photographs.
//
//   echo 'GROQ_API_KEY=gsk_…' > .env.groq
//   node --experimental-strip-types scripts/prompt-lab.mts photo.jpg [more.jpg …]
//
//     --langs fr,ja,yue     which languages to generate (default: all three)
//     --counts 0,30,60      simulated collection sizes, i.e. syllabus bands
//     --baseline            also run the pre-rewrite prompt, side by side
//     --out results.json    write the full transcript somewhere
//
// Why this exists: a prompt change is the one kind of change you cannot
// review by reading it. The structural half — did the gloss survive
// validation, did the model report a real grammar key, did it stay inside the
// vocabulary budget — is checked here and reported as pass/fail. The half
// that matters most, whether the sentence is something a person would
// actually say, is printed for a human to read, because nothing else can
// judge it.
//
// It imports the *shipping* module rather than a copy of the prompt, so what
// is tested here is what deploys. That module is written for Deno, hence the
// one-line environment shim below; nothing else about it is adapted.
// ---------------------------------------------------------------------------
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

declare global {
  // eslint-disable-next-line no-var
  var Deno: { env: { get(key: string): string | undefined } };
}

// --- environment ---------------------------------------------------------

/**
 * Reads a key from `.env.<name>` or the process environment.
 *
 * Gemini is the provider the app actually uses; a Groq key is optional and
 * only exercises the failover path.
 */
function loadKey(envVar: string, file: string): string | undefined {
  const fromEnv = process.env[envVar];
  if (fromEnv) return fromEnv;
  let raw = '';
  try {
    raw = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  } catch {
    return undefined;
  }
  return raw.split('\n')
    .map(l => l.trim())
    .find(l => l.startsWith(`${envVar}=`))
    ?.slice(envVar.length + 1)
    .replace(/^["']|["']$/g, '')
    .trim() || undefined;
}

function fail(message: string): never {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

const KEYS: Record<string, string | undefined> = {
  GEMINI_API_KEY: loadKey('GEMINI_API_KEY', '.env.gemini'),
  GROQ_API_KEY: loadKey('GROQ_API_KEY', '.env.groq'),
};
if (!KEYS.GEMINI_API_KEY) {
  fail("No Gemini key. Set GEMINI_API_KEY in the environment, or:  echo 'GEMINI_API_KEY=…' > .env.gemini");
}
globalThis.Deno = { env: { get: (k: string) => KEYS[k] } };

// Imported after the shim is in place — these modules read Deno.env at call
// time, but the import itself is what would fail first if the global were
// missing entirely on some future edit.
const { identifyFromPhoto, translateSentence } = await import('../supabase/functions/_shared/vocab.ts');
const { bandFor, isKnownGrammarKey } = await import('../supabase/functions/_shared/syllabus.ts');
const { glossFor } = await import('../lib/gloss.ts');
type Language = 'fr' | 'ja' | 'yue';

// --- arguments -----------------------------------------------------------

const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const has = (name: string) => argv.includes(`--${name}`);

// Flags that take a value consume the next argument; everything else left
// over is a photo path. Filtering by "doesn't start with --" alone would
// swallow `fr,ja,yue` as a filename.
const VALUE_FLAGS = new Set(['langs', 'counts', 'out', 'delay']);
const photos: string[] = [];
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg.startsWith('--')) {
    if (VALUE_FLAGS.has(arg.slice(2))) i++;
    continue;
  }
  photos.push(arg);
}

const languages = (flag('langs') ?? 'fr,ja,yue').split(',').map(s => s.trim()) as Language[];
const counts = (flag('counts') ?? '0').split(',').map(s => Number(s.trim()));
const withBaseline = has('baseline');
const outPath = flag('out');

if (photos.length === 0) fail('Give me at least one photo path.');

// --- images --------------------------------------------------------------

// Exactly what prepareContextPhoto in app/(tabs)/scan.tsx sends: 640px on the
// long edge at quality 60. Every extra pixel is tokens against a free tier
// that is measured per minute, and an oversized test image doesn't just cost
// more — it changes whether you hit the limit at all, which is the difference
// between testing the prompt and testing the rate limiter.
const SCENE_LONG_EDGE = 640;
const SCENE_QUALITY = 60;
const workDir = mkdtempSync(join(tmpdir(), 'prompt-lab-'));

// The same image goes into both slots — the close-up and the scene.
//
// In the app the close-up is whatever the user boxed or lassoed and the
// device then cut out, and nothing here can reproduce that choice: a centre
// crop of a parking lot is a lamp post, not the car anyone meant. Handing the
// model the whole scene twice makes it pick the salient object itself, which
// is the same job. What matters for a comparison is that the baseline and the
// new prompt receive byte-identical input, and they do.
function toBase64Jpeg(path: string): string {
  const out = join(workDir, `${basename(path).replace(/\W+/g, '_')}.jpg`);
  try {
    execFileSync('sips', [
      '-Z', String(SCENE_LONG_EDGE),
      '-s', 'format', 'jpeg',
      '-s', 'formatOptions', String(SCENE_QUALITY),
      path, '--out', out,
    ], { stdio: 'ignore' });
  } catch {
    fail(`Could not read/convert ${path} — is it an image?`);
  }
  return readFileSync(out).toString('base64');
}

// --- one run -------------------------------------------------------------

interface Row {
  photo: string;
  language: Language;
  stickerCount: number;
  prompt: 'new' | 'baseline';
  offered: string[];
  result: any;
  problems: string[];
  notes: string[];
  /** Set when the call never completed — a rate limit, not a prompt fault. */
  error?: string;
  ms: number;
}

/**
 * Captures the `syllabus: band N (M cards), offered X / Y` line the module
 * logs, which is the only place the two candidate keys are visible from
 * outside — and is exactly the line you would be reading in the function logs
 * when debugging this in production.
 */
async function withCapturedLog<T>(fn: () => Promise<T>): Promise<[T, string[]]> {
  const lines: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => { lines.push(args.map(String).join(' ')); };
  try {
    return [await fn(), lines];
  } finally {
    console.log = original;
  }
}

function countUnits(sentence: string, language: Language): number {
  return language === 'fr'
    ? sentence.trim().split(/\s+/).filter(Boolean).length
    : [...sentence.replace(/[\s。、！？．，]/g, '')].length;
}

function checkNew(result: any, language: Language, stickerCount: number, offered: string[]): { problems: string[]; notes: string[] } {
  const problems: string[] = [];
  const notes: string[] = [];

  for (const field of ['word', 'translation', 'reading', 'sentence', 'sentence_translation', 'category']) {
    if (!result?.[field] || typeof result[field] !== 'string') problems.push(`missing ${field}`);
  }

  // The gloss arrives already validated (vocab.ts nulls anything whose chunks
  // do not reconstruct the sentence), so null here means the model failed the
  // segmentation, not that the field was absent.
  if (!result?.gloss) problems.push('gloss rejected or absent');
  else if (!glossFor(result.gloss, result.sentence)) problems.push('gloss disagrees with the app-side validator');
  else if (result.gloss.length < 3) notes.push(`gloss is only ${result.gloss.length} chunks`);

  if (!result?.grammar_key) problems.push('grammar_key rejected or absent');
  else {
    if (!isKnownGrammarKey(language, result.grammar_key)) problems.push(`grammar_key ${result.grammar_key} is not in the syllabus`);
    else if (offered.length === 2 && !offered.includes(result.grammar_key)) {
      notes.push(`used ${result.grammar_key}, which was not one of the two offered`);
    }
  }

  const insight = typeof result?.sentence_insight === 'string' ? result.sentence_insight.trim() : '';
  if (!insight) problems.push('sentence_insight empty');
  else if (insight.split(/\s+/).length > 26) notes.push(`insight is ${insight.split(/\s+/).length} words`);

  const band = bandFor(stickerCount);
  const units = countUnits(result?.sentence ?? '', language);
  const ceiling = language === 'fr' ? { 1: 10, 2: 14, 3: 18 }[band] : { 1: 14, 2: 20, 3: 28 }[band];
  if (units > ceiling * 1.5) problems.push(`sentence is ${units} ${language === 'fr' ? 'words' : 'chars'}, way over the band-${band} budget of ~${ceiling}`);
  else if (units > ceiling) notes.push(`sentence is ${units} ${language === 'fr' ? 'words' : 'chars'} vs a band-${band} budget of ~${ceiling}`);

  // Not a hard failure: French stores the headword with its article ("Le
  // Café") and the sentence will not repeat it, and CJK headwords can be
  // inflected in context. Worth seeing, though — a sentence that never names
  // its own word is not teaching it.
  const bare = String(result?.word ?? '').replace(/^(le |la |les |l'|un |une |des )/i, '').trim();
  if (bare && result?.sentence && !String(result.sentence).toLowerCase().includes(bare.toLowerCase())) {
    notes.push(`headword "${bare}" does not appear verbatim in the sentence`);
  }

  return { problems, notes };
}

async function run(photo: string, b64: string, language: Language, stickerCount: number, prompt: 'new' | 'baseline'): Promise<Row> {
  const started = Date.now();
  const learner = {
    stickerCount,
    // A plausible collection at this size. Fixed rather than random so two
    // runs of the same cell are comparable.
    knownWords: stickerCount >= 10
      ? FAKE_KNOWN[language].slice(0, Math.min(12, Math.floor(stickerCount / 2)))
      : [],
    recentGrammarKeys: [],
  };

  const identify = prompt === 'new'
    ? identifyFromPhoto
    : (await import(baselineUrl!)).identifyFromPhoto ?? (await import(baselineUrl!)).identifyWithGroq;

  const [result, logs] = await withCapturedLog(() =>
    prompt === 'new'
      ? identify(b64, language, b64, learner)
      : identify(b64, language, b64));

  const offered = (logs.find(l => l.startsWith('syllabus:'))?.match(/offered (\S+) \/ (\S+)/) ?? []).slice(1);

  const { problems, notes } = prompt === 'new'
    ? checkNew(result, language, stickerCount, offered)
    : { problems: [], notes: [] };

  return { photo: basename(photo), language, stickerCount, prompt, offered, result, problems, notes, ms: Date.now() - started };
}

// A learner's existing collection, for the re-exposure rule. Deliberately
// ordinary household vocabulary — the point is to see whether the model
// weaves one in naturally, not whether it can be forced.
const FAKE_KNOWN: Record<Language, { word: string; translation: string }[]> = {
  fr: [
    { word: 'La Table', translation: 'Table' }, { word: 'La Fenêtre', translation: 'Window' },
    { word: 'Le Livre', translation: 'Book' }, { word: 'La Chaise', translation: 'Chair' },
    { word: 'Le Matin', translation: 'Morning' }, { word: 'La Cuisine', translation: 'Kitchen' },
    { word: 'Le Chat', translation: 'Cat' }, { word: "L'Eau", translation: 'Water' },
    { word: 'La Lumière', translation: 'Light' }, { word: 'Le Sac', translation: 'Bag' },
    { word: 'La Porte', translation: 'Door' }, { word: 'Le Papier', translation: 'Paper' },
  ],
  ja: [
    { word: '机', translation: 'Desk' }, { word: '窓', translation: 'Window' },
    { word: '本', translation: 'Book' }, { word: '椅子', translation: 'Chair' },
    { word: '朝', translation: 'Morning' }, { word: '台所', translation: 'Kitchen' },
    { word: '猫', translation: 'Cat' }, { word: '水', translation: 'Water' },
    { word: '光', translation: 'Light' }, { word: '鞄', translation: 'Bag' },
    { word: 'ドア', translation: 'Door' }, { word: '紙', translation: 'Paper' },
  ],
  yue: [
    { word: '枱', translation: 'Table' }, { word: '窗', translation: 'Window' },
    { word: '書', translation: 'Book' }, { word: '櫈', translation: 'Chair' },
    { word: '朝早', translation: 'Morning' }, { word: '廚房', translation: 'Kitchen' },
    { word: '貓', translation: 'Cat' }, { word: '水', translation: 'Water' },
    { word: '燈', translation: 'Light' }, { word: '袋', translation: 'Bag' },
    { word: '門', translation: 'Door' }, { word: '紙', translation: 'Paper' },
  ],
};

// --- the pre-rewrite prompt, for comparison ------------------------------

let baselineUrl: string | undefined;
if (withBaseline) {
  const src = execFileSync('git', ['show', 'HEAD:supabase/functions/_shared/vocab.ts'], { encoding: 'utf8' });
  const path = join(workDir, 'vocab-baseline.ts');
  writeFileSync(path, src);
  baselineUrl = `file://${path}`;
}

// --- output --------------------------------------------------------------

const DIM = '\x1b[2m'; const OFF = '\x1b[0m'; const BOLD = '\x1b[1m';
const RED = '\x1b[31m'; const GREEN = '\x1b[32m'; const YELLOW = '\x1b[33m';

function render(row: Row) {
  const { result: r } = row;
  const head = `${row.photo}  ·  ${row.language}  ·  ${row.stickerCount} cards (band ${bandFor(row.stickerCount)})  ·  ${row.prompt}`;
  console.log(`\n${BOLD}${head}${OFF}  ${DIM}${row.ms}ms${OFF}`);
  console.log(`${DIM}${'─'.repeat(Math.min(head.length, 78))}${OFF}`);
  console.log(`  ${BOLD}${r?.word}${OFF} ${DIM}[${r?.reading}]${OFF} — ${r?.translation}${r?.part_of_speech ? DIM + ' (' + r.part_of_speech + ')' + OFF : ''}`);
  console.log(`  ${BOLD}${r?.sentence}${OFF}`);
  console.log(`  ${DIM}${r?.sentence_translation}${OFF}`);
  if (row.offered.length === 2) console.log(`  ${DIM}offered: ${row.offered.join(' / ')}${OFF}`);
  if (r?.grammar_key) console.log(`  ${DIM}used:${OFF} ${r.grammar_key}`);
  if (r?.gloss) {
    console.log(`  ${DIM}gloss:${OFF} ${r.gloss.map((c: any) => `${c.t}${DIM}(${c.g})${OFF}`).join(' ')}`);
  }
  if (r?.sentence_insight) console.log(`  ${DIM}note:${OFF} ${r.sentence_insight}`);
  for (const n of row.notes) console.log(`  ${YELLOW}~ ${n}${OFF}`);
  for (const p of row.problems) console.log(`  ${RED}✗ ${p}${OFF}`);
  if (row.prompt === 'new' && row.problems.length === 0) console.log(`  ${GREEN}✓ contract clean${OFF}`);
}

// --- go ------------------------------------------------------------------

// vocab.ts caps its own rate-limit retry at 6s deliberately: a user staring at
// a scan must not be made to sit through a 45-second sleep, so production
// fails fast and asks them to try again. A batch script has exactly the
// opposite trade — nobody is waiting, and a run that gives up is a run that
// tells you nothing. So the patience lives out here instead of being tuned
// into the shipping module.
// Measured, not guessed: the free tier reports x-ratelimit-limit-tokens: 8000
// per minute (requests are effectively unlimited at 1000/day). One vision call
// — two 640px images plus ~1300 tokens of prompt — is most of that window on
// its own, so anything under about a minute between calls puts two of them in
// the same bucket and the second one 429s. 30s spacing lost half the run.
const DELAY_MS = Number(flag('delay') ?? 75) * 1000;
const RATE_LIMIT_WAIT_MS = 75_000;
const MAX_ATTEMPTS = 3;

function isRateLimit(message: string): boolean {
  return /rate-limit|rate limit|429/i.test(message);
}

async function runWithBackoff(photo: string, b64: string, language: Language, stickerCount: number, prompt: 'new' | 'baseline'): Promise<Row> {
  let last = '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await run(photo, b64, language, stickerCount, prompt);
    } catch (err: any) {
      last = err?.message ?? String(err);
      if (!isRateLimit(last) || attempt === MAX_ATTEMPTS) break;
      console.log(`  ${DIM}rate-limited, waiting ${RATE_LIMIT_WAIT_MS / 1000}s (attempt ${attempt}/${MAX_ATTEMPTS})${OFF}`);
      await new Promise(r => setTimeout(r, RATE_LIMIT_WAIT_MS));
    }
  }
  return { photo: basename(photo), language, stickerCount, prompt, offered: [], result: null, problems: [], notes: [], error: last, ms: 0 };
}

const rows: Row[] = [];
const prompts: ('new' | 'baseline')[] = withBaseline ? ['baseline', 'new'] : ['new'];

for (const photo of photos) {
  const b64 = toBase64Jpeg(photo);
  for (const language of languages) {
    for (const stickerCount of counts) {
      for (const prompt of prompts) {
        if (rows.length) await new Promise(r => setTimeout(r, DELAY_MS));
        const row = await runWithBackoff(photo, b64, language, stickerCount, prompt);
        rows.push(row);
        if (row.error) console.log(`\n${RED}${basename(photo)} · ${language} · ${prompt}: ${row.error}${OFF}`);
        else render(row);
      }
    }
  }
}

// --- the hand-written-sentence path --------------------------------------

if (languages.length) {
  console.log(`\n${BOLD}translate-sentence (the learner writes their own English)${OFF}`);
  console.log(`${DIM}${'─'.repeat(58)}${OFF}`);
  const english = 'I finally found the book I lost last winter.';
  for (const language of languages) {
    await new Promise(r => setTimeout(r, 1500));
    try {
      const out: any = await translateSentence(english, language);
      const ok = out.gloss ? `${GREEN}✓${OFF}` : `${RED}✗ gloss rejected${OFF}`;
      console.log(`\n  ${language}: ${BOLD}${out.sentence}${OFF} ${ok}`);
      if (out.gloss) console.log(`  ${DIM}gloss:${OFF} ${out.gloss.map((c: any) => `${c.t}${DIM}(${c.g})${OFF}`).join(' ')}`);
      if (out.sentence_insight) console.log(`  ${DIM}note:${OFF} ${out.sentence_insight}`);
      rows.push({ photo: '(typed)', language, stickerCount: 0, prompt: 'new', offered: [], result: out, problems: out.gloss ? [] : ['gloss rejected'], notes: [], ms: 0 });
    } catch (err: any) {
      console.log(`  ${RED}${language}: ${err?.message}${OFF}`);
    }
  }
}

// --- scorecard -----------------------------------------------------------

// Only rows that actually got an answer can say anything about the prompt.
// Counting a rate limit as a contract failure was the first thing this script
// got wrong, and it made a clean run look like a 4/9 disaster.
const answered = rows.filter(r => r.prompt === 'new' && !r.error);
const failed = rows.filter(r => r.prompt === 'new' && r.error);
const clean = answered.filter(r => r.problems.length === 0).length;
const glossOk = answered.filter(r => r.result?.gloss).length;
const vision = answered.filter(r => r.photo !== '(typed)');
const keyOk = vision.filter(r => r.result?.grammar_key).length;

console.log(`\n${BOLD}Scorecard${OFF}  ${DIM}(new prompt, answered calls only)${OFF}`);
console.log(`  contract clean       ${clean}/${answered.length}`);
console.log(`  gloss survived       ${glossOk}/${answered.length}`);
console.log(`  grammar key reported ${keyOk}/${vision.length}`);
if (failed.length) console.log(`  ${YELLOW}never answered       ${failed.length} (rate limits — not a prompt result)${OFF}`);

if (outPath) {
  writeFileSync(outPath, JSON.stringify(rows, null, 2));
  console.log(`\n  full transcript → ${outPath}`);
}

process.exit(answered.some(r => r.problems.length) ? 1 : 0);
