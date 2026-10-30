// ---------------------------------------------------------------------------
// Scene prompts — one photo, many words.
//
// A scan used to ask a photo exactly one question ("what is this object?"),
// which is why the collection was all nouns. A scene prompt asks a different
// question of the same photo — what is happening in it, what things are like,
// what you would say there — so one photograph can teach verbs, adjectives,
// positions and idioms as well.
//
// The prompts are data. Adding one is a new entry here; nothing else changes.
// The label is what the learner taps; `ask` is the question the model is
// given. `pos` is what the prompt is for, and `accepts` is enforced: the model
// labels every chip, and a chip whose own label is off-type is dropped (see
// docs/lessons.md §13). Asking alone was not enough. Measured 2026-10-30,
// "What's it like?" in Japanese returned 陶器 (a noun) and "Say it like a
// local" in Cantonese returned slang. Fewer chips is the right failure: a
// scene that only supports one verb should not be forced to produce five.
//
// No Deno APIs at module scope, so `node --experimental-strip-types` can
// import this directly (scripts/test-any-word.mts).
// ---------------------------------------------------------------------------

import { PARTS_OF_SPEECH } from './cardSchema.ts';

type PartOfSpeech = (typeof PARTS_OF_SPEECH)[number];

export type ScenePromptId =
  | 'what-is-it'
  | 'happening'
  | 'like'
  | 'how'
  | 'where'
  | 'local'
  | 'say-here'
  | 'custom';

export interface ScenePrompt {
  id: ScenePromptId;
  /** What the learner taps. */
  label: string;
  /** Which part of speech this prompt usually yields. */
  pos: PartOfSpeech | 'any';
  /** The labels a chip may carry and still answer this prompt. Absent = any. */
  accepts?: PartOfSpeech[];
  /** The question put to the model, about the scene or the marked part of it. */
  ask: string;
}

export const SCENE_PROMPTS: ScenePrompt[] = [
  {
    id: 'what-is-it',
    label: 'What is it?',
    pos: 'noun',
    accepts: ['noun'],
    ask: 'Name the distinct, clearly visible objects. One noun per object; never two words for the same thing.',
  },
  {
    id: 'happening',
    label: "What's happening?",
    pos: 'verb',
    // A verb-object compound (飲茶, faire la vaisselle) is honestly a phrase.
    accepts: ['verb', 'phrase'],
    ask: 'Give the actions going on, or the actions a person would naturally do with what is here (pour, sip, wipe, wait). Verbs only.',
  },
  {
    id: 'like',
    label: "What's it like?",
    pos: 'adjective',
    accepts: ['adjective'],
    ask: 'Describe what you can actually see: colour, material, texture, condition, size, temperature, mood. Adjectives only, and only ones the photo genuinely shows. An adjective describes a thing; it never names one. Where the language says a quality with a noun (a material, in Japanese or Cantonese), leave that quality out rather than give the noun.',
  },
  {
    id: 'how',
    label: 'How?',
    pos: 'adverb',
    accepts: ['adverb', 'phrase'],
    ask: 'Give adverbs of manner, time or degree that fit what is happening or would happen here (slowly, carefully, already, too). Adverbs only.',
  },
  {
    id: 'where',
    label: 'Where is it?',
    pos: 'phrase',
    ask: 'Give the words for where things are relative to each other — prepositions and short position phrases (next to, on top of, behind, in the corner).',
  },
  {
    id: 'local',
    label: 'Say it like a local',
    pos: 'idiom',
    accepts: ['idiom'],
    ask: 'Give idioms and set expressions a native speaker would genuinely use in or about this situation: fixed expressions whose meaning is more than their words, of the kind an idiom dictionary lists (French expressions idiomatiques, Japanese 慣用句 and ことわざ, Cantonese 俗語 and spoken 成語). Real, common expressions only. Never a literal phrase dressed up as an idiom, and never slang: a single trendy word or an intensifier is not an idiom.',
  },
  {
    id: 'say-here',
    label: 'What would you say here?',
    pos: 'phrase',
    ask: 'Give short, useful things a person would actually say out loud in this situation — a request, a question, a reaction. Each one complete and sayable as it stands.',
  },
  {
    id: 'custom',
    label: 'Ask your own…',
    pos: 'any',
    ask: "Answer the learner's own question about this photo, given below between the markers.",
  },
];

export function findScenePrompt(id: unknown): ScenePrompt | null {
  return SCENE_PROMPTS.find((p) => p.id === id) ?? null;
}

/** Longest custom question accepted. Long enough for a real question, short enough to stay a question. */
export const CUSTOM_MAX_CHARS = 80;

/**
 * The learner's own question, made safe to put in a prompt — or null if it is
 * not usable. It is passed as data between markers and never concatenated
 * into the instruction, so the only work here is to stop it escaping those
 * markers (newlines, the marker itself) and to bound it.
 */
export function cleanCustomQuestion(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/[\r\n\t]+/g, ' ').replace(/"""/g, '"').replace(/\s{2,}/g, ' ').trim();
  if (!cleaned || cleaned.length > CUSTOM_MAX_CHARS) return null;
  return cleaned;
}

/** How many chips one prompt returns. */
export const MIN_CANDIDATES = 3;
export const MAX_CANDIDATES = 6;

// French articles and elisions a learner may or may not include. "la tasse"
// and "tasse" are the same word for the purpose of not offering it twice.
// The article must end in a space or an apostrophe, or "lait" loses its "la".
// The reflexive se/s' is deliberately not here: se lever and lever are
// different verbs.
const LEADING_ARTICLE = /^(?:(?:le|la|les|un|une|des|du|de la)\s+|(?:l|de l)'\s*)/;

/**
 * A comparison key for "is this the same word?": case, accents, surrounding
 * punctuation and a leading article do not count. Accents are stripped only
 * from Latin letters (U+0300–U+036F) — the Japanese voicing marks are a
 * different block and are left alone, so か and が stay different words.
 */
export function wordKey(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .trim()
    .replace(LEADING_ARTICLE, '')
    .replace(/^[\s.,!?¡¿。、！？「」"']+|[\s.,!?¡¿。、！？「」"']+$/g, '');
}

export interface SceneCandidate {
  word: string;
  translation: string;
  part_of_speech: (typeof PARTS_OF_SPEECH)[number];
  reading: string;
}

/**
 * The model's chips, made safe to show: well-formed entries only, nothing the
 * learner already has (the avoid list) or was already offered in this reply,
 * nothing whose own label is outside `accepts`, and at most MAX_CANDIDATES.
 * An unknown part of speech is coerced to 'phrase' rather than dropping a good
 * word over a label.
 */
export function normalizeCandidates(raw: unknown, avoid: string[], accepts?: PartOfSpeech[]): SceneCandidate[] {
  const list = Array.isArray((raw as any)?.candidates) ? (raw as any).candidates : [];
  const seen = new Set(avoid.map(wordKey).filter(Boolean));
  const out: SceneCandidate[] = [];
  for (const c of list) {
    if (out.length >= MAX_CANDIDATES) break;
    const word = typeof c?.word === 'string' ? c.word.trim() : '';
    const translation = typeof c?.translation === 'string' ? c.translation.trim() : '';
    if (!word || !translation) continue;
    const key = wordKey(word);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const pos = (PARTS_OF_SPEECH as readonly string[]).includes(c?.part_of_speech) ? c.part_of_speech : 'phrase';
    if (accepts && !accepts.includes(pos)) continue;
    const reading = typeof c?.reading === 'string' ? c.reading.trim() : '';
    out.push({ word, translation, part_of_speech: pos, reading });
  }
  return out;
}

/** The avoid list as sent by a client: strings only, bounded, so it cannot balloon the prompt. */
export function cleanAvoidList(raw: unknown, max = 60): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((w): w is string => typeof w === 'string' && w.trim().length > 0 && w.length <= 60)
    .map((w) => w.trim())
    .slice(0, max);
}
