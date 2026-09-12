// ---------------------------------------------------------------------------
// Word-by-word gloss — validation, not trust.
//
// The card already shows a sentence and its English. What it has never shown
// is which part of one means which part of the other. In French that costs a
// learner some guesswork; in Japanese and Cantonese it is fatal, because the
// script is unsegmented — a beginner looking at 「机の上にコップがあります」
// cannot even tell where one word stops and the next begins, so the sentence
// is decoration rather than input.
//
// The risk with a model-generated gloss is that a *wrong* segmentation is
// worse than none: it teaches boundaries that do not exist, confidently. So
// nothing here is taken on trust. The chunks must reconstruct the sentence
// they claim to gloss, character for character once spacing and punctuation
// are set aside, or the whole gloss is dropped and the card falls back to the
// state it is in today.
//
// A near-identical `glossFits` lives in `lib/gloss.ts` for the app side,
// which re-runs the same check at render time — a sticker whose sentence was
// later hand-edited still has its old gloss in the row, and that gloss now
// describes a sentence that no longer exists. Keep the two in step.
// ---------------------------------------------------------------------------

export interface GlossChunk {
  /** The chunk exactly as it appears in the sentence. */
  t: string;
  /** Its meaning here — 1–4 English words, or the job a particle does. */
  g: string;
}

// A sentence this app would produce splits into well under forty chunks; a
// longer array means the model has segmented into individual characters or
// gone off the rails, and the row is not worth storing either way.
const MAX_CHUNKS = 40;
// Long enough for "past/completed marker", short enough that the model cannot
// smuggle a whole explanation into a slot the card lays out as one line.
const MAX_GLOSS_LEN = 60;

// Everything that can legitimately differ between the sentence and the
// concatenated chunks without the segmentation itself being wrong: spacing
// (French chunks may or may not carry their space; Japanese has none to
// carry) and punctuation (models routinely drop the final 。 or 。→. ).
//
// Deliberately NOT stripped: ー, 々 and ヽ. They look like punctuation to a
// regex built for Latin text and are letters — コーヒー loses its identity
// without the first.
const PUNCT = /[.,!?;:'"‘’“”«»…()\[\]{}<>/\\\-–—。、，！？；：（）〔〕「」『』【】《》〈〉·・～]/gu;

/**
 * The comparison form: what two strings must share for the gloss to be
 * describing this sentence and not some other one.
 */
export function glossKey(s: string): string {
  return s
    .normalize('NFC')
    .replace(/\s|　/gu, '')
    .replace(PUNCT, '')
    .toLowerCase();
}

/**
 * Coerces the model's `gloss` field into something safe to store, or null.
 *
 * Null is a perfectly good outcome — the card renders exactly as it does
 * today without a gloss — so every check here fails closed rather than
 * trying to repair a partial answer. A gloss that has been patched up to
 * pass validation is no longer evidence that the model segmented correctly.
 */
export function normalizeGloss(raw: unknown, sentence: string): GlossChunk[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length < 2 || raw.length > MAX_CHUNKS) return null;

  const chunks: GlossChunk[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null;
    const t = typeof (item as any).t === 'string' ? (item as any).t.trim() : '';
    const g = typeof (item as any).g === 'string' ? (item as any).g.trim() : '';
    if (!t || !g) return null;
    chunks.push({ t, g: g.length > MAX_GLOSS_LEN ? g.slice(0, MAX_GLOSS_LEN).trimEnd() : g });
  }

  if (glossKey(chunks.map(c => c.t).join('')) !== glossKey(sentence)) return null;

  return chunks;
}

// The instruction and the schema line are kept apart on purpose. An earlier
// version put the whole explanation inside the JSON example, which left the
// model looking at a "shape to copy" that was not valid JSON — an array
// literal followed by two sentences of English, in a block where every other
// entry was "key": "description". The requirements belong in the prose half
// of the prompt; the schema half should only ever show a shape.
//
// Shared so the vision path and the hand-written-sentence path cannot drift
// into asking for two different shapes of the same column.

/** Goes in the instructions, alongside the sentence rules. */
export const GLOSS_RULES = `Split the sentence you just wrote into meaningful chunks, IN ORDER, and give each one its meaning. Concatenating every "t" in order must reproduce the sentence exactly, spacing and punctuation aside — do not skip, reorder, merge or invent anything. Split at word boundaries, and split off any grammatical piece that carries its own job: particles, aspect markers, classifiers, articles, verb endings. Each "g" is 1–4 English words giving the meaning that chunk has IN THIS SENTENCE, or, for a grammatical piece, the job it does — "が" → "subject marker", "咗" → "completed action", "du" → "some (partitive)", "-ais" → "imperfect ending".`;

/** Goes in the JSON schema block, where only a shape belongs. */
export const GLOSS_SCHEMA_LINE = `"gloss": [{"t": "a chunk, copied exactly from the sentence", "g": "what that chunk means here"}]`;
