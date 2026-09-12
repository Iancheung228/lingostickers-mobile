// ---------------------------------------------------------------------------
// The app-side half of the sentence gloss.
//
// The edge function already validated the gloss against the sentence before
// storing it (supabase/functions/_shared/gloss.ts — keep the two in step,
// they cannot share a file across the Deno/React Native boundary). This half
// exists because a stored gloss can go stale afterwards, and only the app
// knows when:
//
//   * the sentence is hand-editable from the study card, and a learner who
//     rewrites it leaves the old gloss behind still describing the sentence
//     it used to be,
//   * a card won from a challenge, or created by an older build, has no
//     gloss at all.
//
// So nothing renders a gloss without first checking it still fits. A gloss
// that has drifted is not shown — a breakdown that mislabels which characters
// mean what is worse than no breakdown, because the learner has no way to
// tell it is wrong.
// ---------------------------------------------------------------------------

export interface GlossChunk {
  /** The chunk exactly as it appears in the sentence. */
  t: string;
  /** Its meaning here — 1–4 English words, or the job a particle does. */
  g: string;
}

// Mirrors PUNCT in supabase/functions/_shared/gloss.ts. Deliberately does not
// strip ー, 々 or ヽ: they look like punctuation to a regex written for Latin
// text and are letters — コーヒー is not コヒ.
const PUNCT = /[.,!?;:'"‘’“”«»…()\[\]{}<>/\\\-–—。、，！？；：（）〔〕「」『』【】《》〈〉·・～]/gu;

function glossKey(s: string): string {
  return s
    .normalize('NFC')
    .replace(/\s|　/gu, '')
    .replace(PUNCT, '')
    .toLowerCase();
}

/** Narrows an unknown JSONB column to a usable gloss, or null. */
export function parseGloss(raw: unknown): GlossChunk[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const chunks: GlossChunk[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null;
    const t = typeof (item as any).t === 'string' ? (item as any).t.trim() : '';
    const g = typeof (item as any).g === 'string' ? (item as any).g.trim() : '';
    if (!t || !g) return null;
    chunks.push({ t, g });
  }
  return chunks;
}

/** True when these chunks still describe this exact sentence. */
export function glossFits(chunks: GlossChunk[], sentence: string): boolean {
  return glossKey(chunks.map(c => c.t).join('')) === glossKey(sentence);
}

/**
 * The one call a renderer needs: the gloss for this sentence, or null.
 *
 * Both failure modes — absent, and stale — collapse to the same null here on
 * purpose, because the card does the same thing in both cases.
 */
export function glossFor(raw: unknown, sentence: string): GlossChunk[] | null {
  const chunks = parseGloss(raw);
  if (!chunks || !sentence) return null;
  return glossFits(chunks, sentence) ? chunks : null;
}
