import { supabase } from '@/lib/supabase';
import { UserFacingError } from '@/lib/friendlyError';
import type { StickerDraft } from '@/lib/types';
import { applyCorrection, correctionBody, type Correction } from '@/lib/wordFix';

/**
 * The sticker image already uploaded to the learner's folder: the cutout (.png)
 * or the server's fallback original (.jpg). create-sticker re-asks about it.
 */
export const canCorrect = (draft: Pick<StickerDraft, 'imagePath'>) => /\.(png|jpg)$/.test(draft.imagePath);

/**
 * "That's not what it is": re-runs create-sticker's vocabulary step on the
 * cutout the draft already points at. Nothing is cut or uploaded again, and
 * the draft's image fields come back untouched.
 *
 * Throws on failure; callers show `friendlyError(err, ...)` (lesson 3), never
 * `error.message`.
 */
export async function regenerateCard(args: {
  draft: StickerDraft;
  cropBase64: string | null;
  contextBase64: string | null;
  correction: Correction;
}): Promise<StickerDraft> {
  const { draft, cropBase64, contextBase64, correction } = args;
  if (!cropBase64 || !canCorrect(draft)) {
    // No cutout to re-ask about (background removal fell back to the original
    // photo, or the close-up is gone). A typed meaning still works the way it
    // did before this feature: translate-word swaps the headword, keeping the
    // sentence. Worse than a full regeneration, but far better than refusing
    // the edit outright.
    if ('hint' in correction) return unlessUnchanged(draft, await retranslateWord(draft, correction.hint));
    throw new UserFacingError("Can't change this one any more. Retry the scan instead.");
  }

  const { data, error } = await supabase.functions.invoke('create-sticker', {
    body: correctionBody({
      language: draft.language,
      imagePath: draft.imagePath,
      cropBase64,
      contextBase64,
      correction,
    }),
  });
  // Thrown as-is: the caller runs it through friendlyError (lesson 3).
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  const next = applyCorrection(draft, data);
  return 'hint' in correction ? unlessUnchanged(draft, next) : next;
}

/**
 * A hint that comes back as the same headword (it described the same thing,
 * "a kettle for tea" for a teapot) used to close the sheet with nothing
 * changed, which reads as "it ignored me". Throwing keeps the "What is it?"
 * sheet open with a reason, so the learner can be more specific.
 */
export function unlessUnchanged(draft: StickerDraft, next: StickerDraft): StickerDraft {
  const norm = (w: string) => w.normalize('NFC').trim().toLowerCase();
  if (norm(next.word) !== norm(draft.word)) return next;
  const what = draft.translation?.trim();
  throw new UserFacingError(
    what
      ? `That still comes out as "${what}". Try describing it another way, or type the exact word.`
      : 'That still comes out as the same word. Try describing it another way, or type the exact word.',
  );
}

/** The pre-correction meaning edit: a bare translate-word call, headword only. */
async function retranslateWord(draft: StickerDraft, english: string): Promise<StickerDraft> {
  const { data, error } = await supabase.functions.invoke('translate-word', {
    body: { englishWord: english, language: draft.language },
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return {
    ...draft,
    word: String(data.word ?? draft.word),
    translation: String(data.translation ?? english),
    reading: String(data.reading ?? draft.reading),
    category: data.category ?? draft.category,
  };
}
