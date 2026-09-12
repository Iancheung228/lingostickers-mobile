// ---------------------------------------------------------------------------
// Vocab helpers — language-templated prompts for turning an object (image or
// English word) into a vocabulary card.
//
// This module owns *what to ask for* and *how to check the answer*. It owns
// no HTTP: every call goes through `llm/`, which picks a provider, retries and
// fails over. Swapping models is a change there, not here.
//
// Adding a language: add an entry to LANGUAGE_SCHEMAS in `cardSchema.ts`
// describing what "word"/"reading" mean for that language, with concrete
// examples, and a matching syllabus in `syllabus.ts`. The JSON contract stays
// the same across languages so callers never need to branch on language.
//
// The sentence is the part of a card that does the teaching, and it is
// generated under four constraints that pull against each other on purpose:
//
//   * it must be about the learner's own photograph (that is the whole
//     premise of the app — the self-reference effect is why they remember
//     the word at all),
//   * it must demonstrate a grammar structure chosen for them rather than
//     one the model happened to reach for (see `syllabus.ts`),
//   * it must be a thing a person would say rather than a caption, and
//   * it must stay inside a vocabulary budget they can actually use.
//
// Where 1 and 4 conflict the prompt says explicitly which wins, because a
// sentence that is vivid and unusable teaches nothing. Every one of those is
// stated as a numbered, binding rule rather than a preference — an earlier
// version phrased them as encouragement ("is encouraged — but only if the
// scene genuinely supports it") and got, reliably, none of them.
// ---------------------------------------------------------------------------

import {
  type GrammarTarget,
  type Language,
  bandFor,
  budgetFor,
  isKnownGrammarKey,
  pickTargets,
  renderTargetChoice,
} from './syllabus.ts';
import { GLOSS_RULES, type GlossChunk, normalizeGloss } from './gloss.ts';
import {
  type FieldKey,
  CARD_FIELDS,
  HEADWORD_FIELDS,
  LANGUAGE_SCHEMAS,
  renderJsonSchema,
  renderProse,
} from './cardSchema.ts';
import { type CallOptions, type LlmPart, callModel } from './llm/index.ts';

export type { Language } from './syllabus.ts';

/**
 * Output ceilings, per path. These cap the blast radius of a runaway
 * generation; they are not budgets — you are billed for what is produced, not
 * for the ceiling. Set well clear of the largest real answer measured
 * (a full card with a long Cantonese gloss ran to 666 tokens), because a
 * truncated reply under structured output is unparseable JSON, not a short
 * card.
 */
const MAX_TOKENS_CARD = 1400;
const MAX_TOKENS_SENTENCE = 1000;
const MAX_TOKENS_HEADWORD = 400;
const MAX_TOKENS_SYNONYMS = 300;

/** Low, not zero: these are creative writing tasks with one right shape. */
const TEMPERATURE = 0.1;

/**
 * What we know about the learner at the moment of the scan. Read off their
 * own rows in `create-sticker`; absent on the paths that have no user
 * context, in which case the prompt falls back to band 1 and no recycling.
 */
export interface LearnerContext {
  /** How many stickers they already have in this language — drives the band. */
  stickerCount: number;
  /** Recent headwords, for incidental re-exposure. Newest first. */
  knownWords: { word: string; translation: string }[];
  /** Grammar keys the last few scans actually used, so rotation can avoid them. */
  recentGrammarKeys: string[];
}

const EMPTY_LEARNER: LearnerContext = { stickerCount: 0, knownWords: [], recentGrammarKeys: [] };

/** Narrows an arbitrary request value to a supported Language, defaulting to French. */
export function resolveLanguage(language: unknown): Language {
  if (language === 'ja' || language === 'yue') return language;
  return 'fr';
}

/**
 * The learner's own collection, offered back to the model as material.
 *
 * Every card the app makes is a chance to re-expose a word met a week ago, at
 * no extra cost and without the learner being told they are revising — which
 * is the cheapest spacing there is. Capped at a dozen because the point is a
 * plausible pool to draw from, not a vocabulary list to satisfy, and a longer
 * one starts to read as a requirement.
 */
function renderKnownWords(learner: LearnerContext, label: string): string {
  const words = learner.knownWords.slice(0, 12);
  if (words.length < 3) return '';
  const list = words.map(w => `${w.word} (${w.translation})`).join(', ');
  return `

5. REUSE A WORD THEY ALREADY HAVE, IF ONE FITS. This learner has already collected these ${label} words: ${list}. If any of them belongs in this sentence naturally, use it — a card that quietly revises an old word is worth two cards. Never force one in, never let one push the headword out of the subject position, and never mention this list in your output.`;
}

/**
 * Coerces `grammar_key` back to something we can store.
 *
 * Accepts any key in the language's syllabus rather than only the two that
 * were offered: if the model built the sentence around a different structure
 * and said so honestly, that is a true record and the rotation should avoid
 * repeating it. What it must never do is store a key the model invented,
 * because the next scan's no-repeats window and the card's own teaching note
 * are both keyed on this value.
 */
function normalizeGrammarKey(raw: unknown, language: Language): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim();
  return isKnownGrammarKey(language, cleaned) ? cleaned : null;
}

/** The four sentence rules, shared between the with-scene and no-scene paths. */
function sentenceRules(
  language: Language,
  targets: [GrammarTarget, GrammarTarget],
  learner: LearnerContext,
  grounding: string,
): string {
  const { label } = LANGUAGE_SCHEMAS[language];
  const { length, vocabulary } = budgetFor(bandFor(learner.stickerCount), language);

  return `Everything that teaches on this card hangs off one sentence, so write it deliberately. These rules are binding, not preferences:

1. SAY IT, DON'T CAPTION IT. Write something a real person would actually say out loud in this moment — a remark, a question, a request, a plan, a complaint, a reaction. Not a museum label. "I'm going to finish this coffee before it goes cold" is a sentence someone says; "The red cup is on the wooden desk" is a caption nobody has ever uttered. The learner has to be able to USE this sentence, not just read it.

2. ${renderTargetChoice(targets)}

3. ${grounding}

4. KEEP THE VOCABULARY USABLE. ${length} ${vocabulary} If a detail from rule 3 is hard to say in plain words, say it in plainer words — do NOT drop it. Rule 3 is not negotiable and this rule never overrides it; a sentence that could describe any photograph has failed no matter how common its words are.${renderKnownWords(learner, label)}`;
}

/** Wraps a rendered field list in the instruction that has always framed it. */
function schemaBlock(keys: FieldKey[], opts: Parameters<typeof renderProse>[1]): string {
  return `Return ONLY a valid JSON object with these exact fields:
${renderProse(keys, opts)}
Return only the JSON, no markdown, no explanation.`;
}

/**
 * Vision: identify the main object in a photo and produce a vocab card in the
 * target language, including a sentence about the scene. When
 * `scenePhotoBase64` (the full, uncropped photo) is available it's passed
 * alongside the close-up so the sentence can describe the wider scene — not
 * just the isolated object.
 */
export async function identifyFromPhoto(
  base64Data: string,
  language: Language,
  scenePhotoBase64?: string,
  learner: LearnerContext = EMPTY_LEARNER,
  // Injected by scripts/ to capture the assembled prompt, or drive a fake
  // provider, without a network and without knowing any provider's wire
  // format. Production passes nothing.
  callOptions: CallOptions = {},
) {
  const targets = pickTargets(language, learner.stickerCount, learner.recentGrammarKeys);
  console.log(
    `syllabus: band ${bandFor(learner.stickerCount)} (${learner.stickerCount} cards), ` +
    `offered ${targets[0].key} / ${targets[1].key}`,
  );

  const parts: LlmPart[] = [{ kind: 'image', mimeType: 'image/jpeg', data: base64Data }];

  let preamble: string;
  let grounding: string;
  if (scenePhotoBase64) {
    parts.push({ kind: 'image', mimeType: 'image/jpeg', data: scenePhotoBase64 });
    preamble = `The FIRST image is a close-up crop of a single object — this is the ONLY object you are identifying. The SECOND image is the wider, uncropped scene it was found in. The "word", "translation", "reading" and "part_of_speech" fields must describe ONLY the object in the FIRST image, never something else that happens to appear in the second image.`;
    grounding = `GROUND IT IN THIS PHOTOGRAPH — this is the rule the whole card exists for. Look at the SECOND image and weave in TWO concrete details you can genuinely see, from different kinds: the object's real colour, material or condition (worn, chipped, open, half-full); the exact surface, room or place it is in; one specific OTHER object touching or beside it, named; something actually in progress (a hand reaching in, a lid off, a page open); or the light — sun on a roof, a lamp on, dusk through a window. Drop to one detail only if the photograph genuinely offers nothing else. Test it before you answer: could this sentence describe a different photograph of the same kind of object? If yes, it has failed — go back and name what is actually in THIS frame. An opinion ("it looks nice") is not a detail. Never invent something that is not visible, and never reach for stock phrasing like "sitting on the desk, ready for the morning" unless a desk and a morning are genuinely in the picture. The object from the FIRST image stays the subject of the sentence.`;
  } else {
    preamble = `Identify the main object in this image. The "word", "translation", "reading" and "part_of_speech" fields describe that object.`;
    grounding = `GROUND IT IN THIS PHOTOGRAPH — this is the rule the whole card exists for. Weave in TWO concrete details you can genuinely see: the object's real colour, material or condition, and what is immediately around it. Test it before you answer: could this sentence describe a different photograph of the same kind of object? If yes, it has failed. An opinion ("it looks nice") is not a detail. Never invent something that is not visible, and never reach for stock phrasing like "sitting on the desk, ready for the morning" unless a desk and a morning are genuinely in the picture. The object stays the subject of the sentence.`;
  }

  const opts = { language, insight: 'targeted' as const };

  parts.push({
    kind: 'text',
    text: `${preamble}

${sentenceRules(language, targets, learner, grounding)}

Write that sentence ${LANGUAGE_SCHEMAS[language].sentenceNote}.

THEN BREAK IT DOWN. ${GLOSS_RULES}

${schemaBlock(CARD_FIELDS, opts)}`,
  });

  const { text } = await callModel(
    {
      parts,
      responseSchema: renderJsonSchema(CARD_FIELDS, opts),
      maxOutputTokens: MAX_TOKENS_CARD,
      temperature: TEMPERATURE,
    },
    { label: 'identify', ...callOptions },
  );

  const parsed = JSON.parse(text);

  const sentence = typeof parsed?.sentence === 'string' ? parsed.sentence : '';
  const gloss: GlossChunk[] | null = sentence ? normalizeGloss(parsed?.gloss, sentence) : null;
  const grammarKey = normalizeGrammarKey(parsed?.grammar_key, language);
  if (parsed?.gloss && !gloss) console.warn('gloss rejected — chunks do not reconstruct the sentence');
  if (parsed?.grammar_key && !grammarKey) console.warn(`grammar_key rejected — unknown key ${JSON.stringify(parsed.grammar_key)}`);

  return { ...parsed, gloss, grammar_key: grammarKey };
}

/**
 * Text: re-derive a vocab card in the target language for a user-supplied
 * English word — used when the user corrects the detected object.
 *
 * Deliberately kept lean: every caller (scan.tsx's retranslate,
 * StudyCard's regenerateFromMeaning) takes only the headword fields off this
 * and leaves the sentence alone, because the stored sentence describes the
 * user's actual photo and this path has never seen it. So there is no
 * grammar target, no gloss and no learner context here — asking for them
 * would cost tokens and latency on a correction, to produce fields nothing
 * reads.
 */
export async function translateWord(englishWord: string, language: Language, callOptions: CallOptions = {}) {
  const { label } = LANGUAGE_SCHEMAS[language];
  const keys: FieldKey[] = [...HEADWORD_FIELDS, 'category'];
  const opts = { language, insight: 'free' as const };

  const { text } = await callModel(
    {
      parts: [{
        kind: 'text',
        text: `Translate the English word "${englishWord}" into ${label} for a vocabulary flashcard. ${schemaBlock(keys, opts)}`,
      }],
      responseSchema: renderJsonSchema(keys, opts),
      maxOutputTokens: MAX_TOKENS_HEADWORD,
      temperature: TEMPERATURE,
    },
    { label: 'translate-word', ...callOptions },
  );

  return JSON.parse(text);
}

/**
 * Text: list a few other natural ways to say/write the same word, so a
 * challenge's answer check isn't pinned to one exact spelling — used once at
 * send-challenge time, not on every guess.
 *
 * Never throws: a challenge without synonyms is strictly better than a
 * challenge that failed to send.
 */
export async function getAcceptedAnswers(word: string, language: Language, callOptions: CallOptions = {}): Promise<string[]> {
  const { label } = LANGUAGE_SCHEMAS[language];
  try {
    const { text } = await callModel(
      {
        parts: [{
          kind: 'text',
          text: `Given the ${label} word/phrase "${word}", list up to 3 other common, natural ways to say or write the exact same thing in ${label} — true synonyms or commonly accepted alternate spellings, NOT the English translation and NOT a related-but-different word. If there are no reasonable alternatives, return an empty list. Return ONLY a valid JSON object with this exact field:
{
  "synonyms": ["alternative 1", "alternative 2"]
}
Return only the JSON, no markdown, no explanation.`,
        }],
        responseSchema: {
          type: 'object',
          properties: { synonyms: { type: 'array', items: { type: 'string' } } },
          required: ['synonyms'],
          propertyOrdering: ['synonyms'],
        },
        maxOutputTokens: MAX_TOKENS_SYNONYMS,
        temperature: TEMPERATURE,
      },
      { label: 'synonyms', ...callOptions },
    );
    const parsed = JSON.parse(text);
    const synonyms = Array.isArray(parsed?.synonyms) ? parsed.synonyms : [];
    return synonyms.filter((s: unknown): s is string => typeof s === 'string' && s.trim().length > 0);
  } catch (err) {
    console.error('getAcceptedAnswers failed, continuing without synonyms:', err);
    return [];
  }
}

/**
 * Text: translate a user-written/edited English sentence into the target
 * language — used when the user edits the sentence describing their memory.
 *
 * No grammar target here: the learner chose the content, and bending their
 * own sentence to hit a syllabus point would be overwriting what they meant.
 * The gloss still applies, and matters more than usual — this is the sentence
 * they cared enough about to write themselves.
 */
export async function translateSentence(englishSentence: string, language: Language, callOptions: CallOptions = {}) {
  const { label, sentenceNote } = LANGUAGE_SCHEMAS[language];
  const keys: FieldKey[] = ['sentence', 'gloss', 'sentence_insight'];
  const opts = { language, insight: 'free' as const, sentenceAs: 'translation' as const };

  const { text } = await callModel(
    {
      parts: [{
        kind: 'text',
        text: `Translate the following English sentence into natural, conversational ${label} — the way someone would actually say it out loud, not a literal word-for-word rendering: "${englishSentence}"
Write it ${sentenceNote}.

THEN BREAK IT DOWN. ${GLOSS_RULES}

${schemaBlock(keys, opts)}`,
      }],
      responseSchema: renderJsonSchema(keys, opts),
      maxOutputTokens: MAX_TOKENS_SENTENCE,
      temperature: TEMPERATURE,
    },
    { label: 'translate-sentence', ...callOptions },
  );

  const parsed = JSON.parse(text);
  const sentence = typeof parsed?.sentence === 'string' ? parsed.sentence : '';
  const gloss: GlossChunk[] | null = sentence ? normalizeGloss(parsed?.gloss, sentence) : null;
  if (parsed?.gloss && !gloss) console.warn('gloss rejected — chunks do not reconstruct the sentence');

  return { ...parsed, gloss };
}
