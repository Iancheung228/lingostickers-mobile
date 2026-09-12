// ---------------------------------------------------------------------------
// One registry of card fields, rendered two ways.
//
// A card's shape is stated twice on every request: once as prose inside the
// prompt ("return JSON with these exact fields…") and once as a JSON Schema
// the provider enforces natively. Those two descriptions must agree. Written
// as separate literals they drift — someone adds a field to the prose and the
// schema silently rejects it, or adds it to the schema and the model is never
// told what to put there.
//
// So neither is written by hand. Both are rendered from FIELDS below, off the
// same ordered list of keys the caller asks for. `scripts/test-llm.mts`
// asserts the two renderings always cover the identical key set.
//
// ORDER IS LOAD-BEARING. Gemini fills fields in schema order, so `sentence`
// must be generated before `gloss`, `grammar_key` and `sentence_insight` —
// all three describe a sentence that does not exist yet otherwise.
// `assertFieldOrder` enforces that, and is called on every render.
// ---------------------------------------------------------------------------

import { GLOSS_SCHEMA_LINE } from './gloss.ts';
import type { Language } from './syllabus.ts';

export type FieldKey =
  | 'word'
  | 'translation'
  | 'part_of_speech'
  | 'reading'
  | 'sentence'
  | 'sentence_translation'
  | 'grammar_key'
  | 'gloss'
  | 'sentence_insight'
  | 'category';

/** The headword block, in the order a card reads. */
export const HEADWORD_FIELDS: FieldKey[] = ['word', 'translation', 'part_of_speech', 'reading'];

/** Everything a full scan asks for. */
export const CARD_FIELDS: FieldKey[] = [
  ...HEADWORD_FIELDS,
  'sentence',
  'sentence_translation',
  'grammar_key',
  'gloss',
  'sentence_insight',
  'category',
];

export const PARTS_OF_SPEECH = ['noun', 'verb', 'adjective', 'adverb', 'phrase'] as const;
export const CATEGORIES = ['Kitchen', 'Animals', 'Study', 'Nature', 'Other'] as const;

/** Fields that must not be generated before `sentence` exists. */
const SENTENCE_DEPENDENTS: FieldKey[] = ['sentence_translation', 'grammar_key', 'gloss', 'sentence_insight'];

export interface LanguageSchema {
  label: string;
  /** How to write the sentence's script, where that needs saying. */
  sentenceNote: string;
  /** Genuinely per-language: what "word" and "reading" mean here. */
  word: string;
  reading: string;
}

export const LANGUAGE_SCHEMAS: Record<Language, LanguageSchema> = {
  fr: {
    label: 'French',
    sentenceNote: 'in French',
    word: 'the object name in French with article (e.g. Le Café, La Pomme, Le Chien)',
    reading: 'phonetic spelling of the French word in English (e.g. luh ka-fay, la pum, luh she-en)',
  },
  ja: {
    label: 'Japanese',
    sentenceNote: 'in Japanese, written naturally with kanji and kana',
    word: 'the object name in Japanese, written naturally with kanji/katakana/hiragana as appropriate (e.g. コーヒー, りんご, 犬)',
    reading: 'romaji reading of the Japanese word, using macrons for long vowels (e.g. kōhī, ringo, inu)',
  },
  yue: {
    label: 'Cantonese',
    sentenceNote:
      'in written colloquial Cantonese — Traditional Chinese characters, spoken Cantonese grammar and vocabulary, NOT Standard Written Chinese',
    word: 'the object name in Cantonese, written in Traditional Chinese characters as used in Hong Kong (e.g. 咖啡, 蘋果, 狗)',
    reading: 'Jyutping romanization of the Cantonese word, with tone numbers (e.g. gaa3 fe1, ping4 gwo2, gau2)',
  },
};

// The insight used to be a three-way fallback: name the grammar if you can,
// otherwise name a bonus word, otherwise say something true about the
// headword. That structure existed because the model had already written the
// sentence by the time it was asked, so the honest answer was often "nothing
// in particular". Now the structure is chosen before the sentence is written,
// so the note has exactly one job and no escape hatches to police.
const INSIGHT_TARGETED =
  // The inner quotes are escaped because this description is embedded inside
  // a JSON example in the prompt — unescaped, the example the model is asked
  // to copy is itself malformed JSON. `test-llm.mts` parses the whole block.
  'one English sentence, under 18 words, teaching the structure you named in grammar_key and pointing at where it happens in THIS sentence (e.g. \'Depuis takes the present tense here, where English would say \\"have had\\".\'). Never a generic fact, never a structure you did not actually use, never empty.';

// The hand-written-sentence path has no chosen structure — the learner picked
// the content — so here the note genuinely is descriptive.
const INSIGHT_FREE =
  'one short English note, under 18 words, about THIS translation as written: name the grammar pattern it uses and say what that pattern does, or, if the sentence turns on one word choice a learner would get wrong, explain that choice. Never a generic fact, never empty.';

export interface RenderOptions {
  language: Language;
  /** Which flavour of the teaching note to ask for. */
  insight?: 'targeted' | 'free';
  /**
   * How to describe `sentence`. 'about-photo' is the scan path, where the
   * sentence is invented about a scene; 'translation' is the path where the
   * learner supplied an English sentence to render.
   */
  sentenceAs?: 'about-photo' | 'translation';
}

interface FieldSpec {
  /** The description that goes in the prompt's JSON example. */
  prose: string;
  /** JSON Schema fragment the provider enforces. */
  json: Record<string, unknown>;
}

function specFor(key: FieldKey, opts: RenderOptions): FieldSpec {
  const lang = LANGUAGE_SCHEMAS[opts.language];
  switch (key) {
    case 'word':
      return { prose: lang.word, json: { type: 'string' } };
    case 'translation':
      return { prose: 'English translation (e.g. Coffee, Apple, Dog)', json: { type: 'string' } };
    case 'part_of_speech':
      return {
        prose: `the headword's part of speech in lowercase English, one of exactly: ${PARTS_OF_SPEECH.join(', ')}`,
        json: { type: 'string', enum: [...PARTS_OF_SPEECH] },
      };
    case 'reading':
      return { prose: lang.reading, json: { type: 'string' } };
    case 'sentence':
      return {
        prose:
          opts.sentenceAs === 'translation'
            ? `the ${lang.label} translation`
            : `the sentence, ${lang.sentenceNote}`,
        json: { type: 'string' },
      };
    case 'sentence_translation':
      return { prose: 'natural English translation of the sentence', json: { type: 'string' } };
    case 'grammar_key':
      return {
        prose: 'the key of the structure you built the sentence around, copied exactly from the two offered above',
        json: { type: 'string' },
      };
    case 'gloss':
      return {
        // The prose form is a whole "key": value line already, because the
        // gloss example has to show a nested shape. renderProse detects that.
        prose: GLOSS_SCHEMA_LINE,
        json: {
          type: 'array',
          items: {
            type: 'object',
            properties: { t: { type: 'string' }, g: { type: 'string' } },
            required: ['t', 'g'],
            propertyOrdering: ['t', 'g'],
          },
        },
      };
    case 'sentence_insight':
      return {
        prose: opts.insight === 'free' ? INSIGHT_FREE : INSIGHT_TARGETED,
        json: { type: 'string' },
      };
    case 'category':
      return {
        prose: `one of exactly: ${CATEGORIES.join(', ')}`,
        json: { type: 'string', enum: [...CATEGORIES] },
      };
  }
}

/**
 * Rejects a field list that asks for something about the sentence before the
 * sentence itself. Called by both renderers, so an unsafe order cannot reach
 * a provider from either direction.
 */
export function assertFieldOrder(keys: FieldKey[]): void {
  const sentenceAt = keys.indexOf('sentence');
  if (sentenceAt === -1) return; // no sentence asked for; nothing to depend on it
  for (const dependent of SENTENCE_DEPENDENTS) {
    const at = keys.indexOf(dependent);
    if (at !== -1 && at < sentenceAt) {
      throw new Error(
        `card schema: "${dependent}" is generated before "sentence", so it would describe a sentence that does not exist yet`,
      );
    }
  }
}

/** The JSON example embedded in the prompt. */
export function renderProse(keys: FieldKey[], opts: RenderOptions): string {
  assertFieldOrder(keys);
  const lines = keys.map((key) => {
    const { prose } = specFor(key, opts);
    // GLOSS_SCHEMA_LINE already carries its own key and shape.
    return prose.startsWith('"') ? prose : `"${key}": "${prose}"`;
  });
  return `{\n  ${lines.join(',\n  ')}\n}`;
}

/** The JSON Schema a provider enforces natively. */
export function renderJsonSchema(keys: FieldKey[], opts: RenderOptions): Record<string, unknown> {
  assertFieldOrder(keys);
  const properties: Record<string, unknown> = {};
  for (const key of keys) properties[key] = specFor(key, opts).json;
  return {
    type: 'object',
    properties,
    // Everything is required: a card missing its headword or its sentence is
    // not a partial card, it is a failed scan. `reading` included — a learner
    // who cannot pronounce the word has half a card.
    required: [...keys],
    propertyOrdering: [...keys],
  };
}
