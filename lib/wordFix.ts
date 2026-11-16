// ---------------------------------------------------------------------------
// "Not a dog?" — the pure half of fixing a wrong headword on the reveal sheet.
//
// No React, no Supabase, no '@/' imports, so node can test every rule here.
// The call itself lives in lib/regenerateCard.ts.
// ---------------------------------------------------------------------------

import type { StickerDraft, WordAlternative } from './types.ts';

/** The server's own cap; the sheet is a choice, not a list. */
export const MAX_ALTERNATIVES = 3;
/** The server rejects a longer hint, so the field stops it before submit. */
export const MAX_HINT_CHARS = 60;

const FALLBACK_LABEL = 'Wrong word?';
const LABEL_MAX_CHARS = 24;

/**
 * The text of the control under the headword: "Not a dog?".
 *
 * The meaning arrives as English with or without an article ("Dog", "The dog",
 * "an apple"), so the article is dropped and re-chosen, and anything that does
 * not read as a countable thing — a verb ("to run"), a long phrase, nothing —
 * gets the generic label rather than a sentence that half-works.
 */
export function wrongWordLabel(translation: string | null | undefined): string {
  const cleaned = (translation ?? '')
    .trim()
    .replace(/^(?:the|an|a)\s+/i, '')
    .trim()
    .toLowerCase();
  if (!cleaned || cleaned.length > LABEL_MAX_CHARS || /^to\s/.test(cleaned) || /[.!?,;:()]/.test(cleaned)) {
    return FALLBACK_LABEL;
  }
  return `Not ${/^[aeiou]/.test(cleaned) ? 'an' : 'a'} ${cleaned}?`;
}

/**
 * The alternatives off a response, keeping only well-formed entries. Mirrors
 * the server's normalizeAlternatives on purpose: an older or newer backend, or
 * a bad deploy, must degrade to "no chips", never to a broken sheet.
 */
export function parseAlternatives(raw: unknown, headword = ''): WordAlternative[] {
  if (!Array.isArray(raw)) return [];
  const key = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  const seen = new Set<string>(headword ? [key(headword)] : []);
  const out: WordAlternative[] = [];
  for (const entry of raw) {
    const word = typeof entry?.word === 'string' ? entry.word.trim() : '';
    const translation = typeof entry?.translation === 'string' ? entry.translation.trim() : '';
    if (!word || !translation || word.length > 40 || translation.length > 40) continue;
    const k = key(word);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push({ word, translation });
    if (out.length === MAX_ALTERNATIVES) break;
  }
  return out;
}

/** A hint ready to send: trimmed, one line, or null when there is nothing to send. */
export function cleanHintInput(raw: string): string | null {
  const hint = raw.replace(/\s+/g, ' ').trim();
  return hint && hint.length <= MAX_HINT_CHARS ? hint : null;
}

export type Correction = { hint: string } | { chosen: WordAlternative };

/** The request body for a correction (a re-ask about the already-uploaded cutout). */
export function correctionBody(args: {
  language: string;
  imagePath: string;
  cropBase64: string;
  contextBase64?: string | null;
  correction: Correction;
}): Record<string, unknown> {
  const { correction } = args;
  return {
    // The same close-up the first call saw. NOT memoryImage: sending that would
    // upload the whole photo a second time.
    image: `data:image/jpeg;base64,${args.cropBase64}`,
    language: args.language,
    ...(args.contextBase64 ? { contextImage: `data:image/jpeg;base64,${args.contextBase64}` } : {}),
    // The existing cutout: the server skips cutting and storing anything.
    precutImagePath: args.imagePath,
    ...('hint' in correction
      ? { hint: correction.hint }
      : { chosenWord: correction.chosen.word, chosenTranslation: correction.chosen.translation }),
  };
}

/**
 * A regenerated card laid over the draft. Every field the card is made of is
 * replaced together (a half-updated card is the original bug); the image
 * fields, the scene photo and the dates are the draft's own and stay.
 */
export function applyCorrection(draft: StickerDraft, data: Record<string, any>): StickerDraft {
  const word = String(data.word ?? '').trim();
  if (!word) throw new Error('No word came back.');
  // The old headword becomes an offer, so a mis-tap can be undone in one tap.
  const offered = parseAlternatives(
    [...(draft.alternatives ?? []), { word: draft.word, translation: draft.translation }],
    word,
  );
  return {
    ...draft,
    word,
    translation: String(data.translation ?? ''),
    reading: String(data.reading ?? ''),
    sentence: String(data.sentence ?? ''),
    sentenceTranslation: String(data.sentenceTranslation ?? ''),
    sentenceInsight: data.sentenceInsight ?? null,
    sentenceGloss: data.sentenceGloss ?? null,
    grammarKey: data.grammarKey ?? null,
    partOfSpeech: data.partOfSpeech ?? null,
    category: data.category ?? draft.category,
    alternatives: offered,
  };
}
