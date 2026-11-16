import { supabase } from '@/lib/supabase';
import { UserFacingError } from '@/lib/friendlyError';
import type { StickerDraft } from '@/lib/types';
import { applyCorrection, correctionBody, type Correction } from '@/lib/wordFix';

/** The cutout is the one uploaded file we can re-ask about; see create-sticker. */
export const canCorrect = (draft: Pick<StickerDraft, 'imagePath'>) => /\.png$/.test(draft.imagePath);

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
  // Without the close-up the model would be asked about nothing; say so in
  // words rather than sending a request that cannot work.
  if (!cropBase64 || !canCorrect(draft)) {
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
  return applyCorrection(draft, data);
}
