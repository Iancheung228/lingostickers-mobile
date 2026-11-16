// ---------------------------------------------------------------------------
// Does the sentence actually use the headword?
//
// A card is one word and one sentence that is supposed to teach it. When the
// model is steered to a different word (a hint, a tapped alternative) it can
// swap the headword and keep writing about the old one — "Le Chien" over a
// sentence about a toy town — which teaches a wrong pairing confidently
// (lesson #13: anything the model produces that must correspond to something
// has to be checked against it, and dropped whole when it doesn't).
//
// The check is deliberately a *substring* test on a normalised form, and
// deliberately lenient where the language inflects, because a false rejection
// costs the learner a retry while a false accept costs them a wrong card —
// and the second is far rarer than it sounds: the failure we are catching is
// the model writing about a different noun altogether, not a different ending.
//
// Pure TypeScript, no Deno APIs, so node can test it directly.
// ---------------------------------------------------------------------------

import type { Language } from './syllabus.ts';

/** Straightens apostrophes (l’arbre → l'arbre) and lowercases. */
function base(text: string): string {
  return text.normalize('NFC').replace(/[‘’ʼ]/g, "'").toLowerCase();
}

/** Drops accents: `fenêtre` and `fenetre` are the same word to this check. */
function fold(text: string): string {
  return text.normalize('NFKD').replace(/[̀-ͯ]/g, '').normalize('NFC');
}

/** Katakana → hiragana, so コーヒー and こーひー compare equal. */
function toHiragana(text: string): string {
  return text.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

// Longest first so `les` is not eaten as `le` + "s…". `l'` has no space after it.
const FRENCH_ARTICLE = /^(?:l'|les |des |une |un |le |la |du |d')\s*/;

/**
 * The part of a headword that must show up in its sentence, as alternatives
 * (a headword like "Le Chien (m.)" may carry a gloss, or "a / b" several forms).
 */
function candidates(word: string, language: Language): string[] {
  const noParens = word.replace(/[(（][^)）]*[)）]/g, ' ');
  const parts = noParens.split(/[/／、;；]/).map((p) => p.trim()).filter(Boolean);
  return parts
    .map((part) => {
      let w = base(part);
      if (language === 'fr') w = w.replace(FRENCH_ARTICLE, '');
      return w.replace(/[\s'.!?¿¡…]+$/g, '').trim();
    })
    .filter(Boolean);
}

/** Letters and digits only, for comparing across punctuation and spacing. */
function squash(text: string, language: Language): string {
  // Spaces are kept for French so "pomme de terre" is matched as a phrase;
  // Japanese and Cantonese are not written with spaces at all.
  if (language === 'fr') return text.replace(/[^\p{L}\p{N}\s']+/gu, ' ').replace(/\s+/g, ' ').trim();
  return text.replace(/[^\p{L}\p{N}]+/gu, '');
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matches(sentence: string, stem: string, language: Language): boolean {
  if (!stem) return false;
  if (sentence.includes(stem)) return true;
  // French nouns change their ending (cheval → chevaux, animal → animaux).
  // For a single long-enough word, the stem minus its last two letters, at the
  // start of a word, is still a decisive match.
  if (language === 'fr' && !stem.includes(' ') && stem.length >= 5) {
    const cut = stem.slice(0, stem.length - 2);
    return new RegExp(`(^|[^\\p{L}])${escapeRegExp(cut)}`, 'u').test(sentence);
  }
  return false;
}

/**
 * True when `sentence` contains `word` (or an inflected form of it), allowing
 * for the article the headword carries, elision (`l'arbre`), accents, kana
 * script and punctuation. An empty word or sentence is never a match.
 */
export function sentenceContainsHeadword(sentence: string, word: string, language: Language): boolean {
  if (!sentence.trim() || !word.trim()) return false;
  const prep = (t: string) => squash(language === 'ja' ? toHiragana(base(t)) : base(t), language);
  const hay = prep(sentence);
  const hayFolded = fold(hay);
  return candidates(word, language).some((cand) => {
    const stem = prep(cand);
    return matches(hay, stem, language) || matches(hayFolded, fold(stem), language);
  });
}

/**
 * True when two headwords are the same word apart from article, case, accents
 * and punctuation ("Le Chien" / "chien"). Used to check the model kept the
 * headword the learner tapped instead of swapping in one of its own.
 */
export function sameHeadword(a: string, b: string, language: Language): boolean {
  const norm = (w: string) =>
    candidates(w, language).map((c) => fold(squash(language === 'ja' ? toHiragana(c) : c, language)));
  const left = norm(a);
  const right = norm(b);
  return left.some((l) => right.includes(l));
}
