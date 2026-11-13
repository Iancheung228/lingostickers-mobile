// The tiered hint on the front of a card (A-card 2). The old hint was the first
// character of the stored word, which for "Le Café" is "L": the article, not
// the word. Each tier gives a little more and none of them show the word.

type HintCard = {
  word: string;
  reading?: string | null;
  part_of_speech?: string | null;
  language: string;
  forms?: { l: string; v: string }[] | null;
};

const FR_ARTICLE = /^(l['’]|le\s+|la\s+|les\s+|un\s+|une\s+|des\s+)/i;
const KANA = /[぀-ヿ]/;
const HAN = /[㐀-鿿豈-﫿]/;

export interface FrenchParts {
  /// The word with its article removed.
  bare: string;
  gender: 'masculine' | 'feminine' | 'plural' | null;
}

/** Splits a French headword into the bare word and the gender its article gives. */
export function frenchParts(word: string, forms?: HintCard['forms']): FrenchParts {
  const w = word.trim();
  const m = w.match(FR_ARTICLE);
  const article = m ? m[1].trim().toLowerCase() : '';
  const bare = m ? w.slice(m[0].length).trim() : w;
  let gender: FrenchParts['gender'] = null;
  if (article === 'le' || article === 'un') gender = 'masculine';
  else if (article === 'la' || article === 'une') gender = 'feminine';
  else if (article === 'les' || article === 'des') gender = 'plural';
  if (!gender && forms) {
    const g = forms.find(f => /gender/i.test(f.l))?.v ?? '';
    if (/^m/i.test(g)) gender = 'masculine';
    else if (/^f/i.test(g)) gender = 'feminine';
  }
  return { bare, gender };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const chars = (s: string) => Array.from(s.replace(/\s+/g, ''));

/** Tone digits per syllable of a jyutping reading, e.g. "gaa3 fe1" -> [3, 1]. */
export function jyutpingTones(reading: string): number[] {
  return reading.trim().split(/\s+/).map(s => s.match(/([1-6])$/)?.[1]).filter(Boolean).map(Number);
}

/**
 * The hint tiers for a card, mildest first. Showing tier n shows tiers 1..n.
 *  1. part of speech (and gender, for French) plus how many letters or characters
 *  2. the first letter or character
 *  3. ja: the first kana; yue: the syllable and tone count (absent otherwise)
 */
export function hintTiers(card: HintCard): string[] {
  const pos = card.part_of_speech?.trim().toLowerCase() || null;
  const tiers: string[] = [];

  if (card.language === 'fr') {
    const { bare, gender } = frenchParts(card.word, card.forms);
    const letters = chars(bare).filter(c => /\p{L}/u.test(c));
    const words = bare.split(/\s+/).filter(Boolean).length;
    const lead = [gender, pos].filter(Boolean).join(' ');
    const count = plural(letters.length, 'letter', 'letters');
    tiers.push(`${lead ? `${lead}, ` : ''}${words > 1 ? `${plural(words, 'word', 'words')}, ` : ''}${count}`);
    const first = Array.from(bare)[0];
    if (first) tiers.push(`Starts with ${first.toUpperCase()}`);
    return tiers;
  }

  const all = chars(card.word);
  tiers.push(`${pos ? `${pos}, ` : ''}${plural(all.length, 'character', 'characters')}`);
  if (all[0]) tiers.push(`Starts with ${all[0]}`);

  if (card.language === 'ja') {
    const reading = (card.reading ?? '').trim();
    const firstKana = Array.from(reading).find(c => KANA.test(c));
    // Only worth a tier when the first character is kanji: the kana is new information.
    if (firstKana && all[0] && HAN.test(all[0])) tiers.push(`Reads ${firstKana}…`);
  } else if (card.language === 'yue') {
    const tones = jyutpingTones(card.reading ?? '');
    if (tones.length) tiers.push(`${plural(tones.length, 'syllable', 'syllables')}, tones ${tones.join('-')}`);
  }
  return tiers;
}
