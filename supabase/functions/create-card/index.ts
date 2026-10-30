// ---------------------------------------------------------------------------
// create-card — a full card for any word, phrase or idiom.
//
// Two callers:
//   * Quick Add: { text, language } — the learner typed something, in English
//     or the target language.
//   * Scene prompts: { text, language, scene, crop?, chosen } — the learner
//     picked a chip that scene-words offered, and the sentence should be
//     about their photo.
//
// Returns card fields only. Saving the row (and uploading any image) stays
// with the client, as it does after create-sticker.
// ---------------------------------------------------------------------------
import { createCard, resolveLanguage, type ChosenHeadword } from '../_shared/vocab.ts';
import { PARTS_OF_SPEECH } from '../_shared/cardSchema.ts';
import { loadLearnerContext } from '../_shared/learner.ts';
import { readImage, ImageError } from '../_shared/requestImages.ts';
import { requireUserId, consumeQuota, serviceClient, errorResponse } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** A word, a phrase or an idiom — not a paragraph. */
const MAX_TEXT_CHARS = 120;

function badRequest(message: string, status = 400): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/** A scene chip as sent back by the client — only its two descriptive fields, bounded. */
function readChosen(raw: any): ChosenHeadword | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const translation = typeof raw.translation === 'string' ? raw.translation.replace(/[\r\n"]+/g, ' ').trim().slice(0, 80) : '';
  const pos = (PARTS_OF_SPEECH as readonly string[]).includes(raw.part_of_speech) ? raw.part_of_speech : 'phrase';
  return translation ? { translation, part_of_speech: pos } : undefined;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const userId = await requireUserId(req);

    const body = await req.json();
    const text = typeof body?.text === 'string' ? body.text.replace(/[\r\n]+/g, ' ').replace(/"""/g, '"').trim() : '';
    if (!text) return badRequest('Missing text');
    if (text.length > MAX_TEXT_CHARS) return badRequest(`Keep it under ${MAX_TEXT_CHARS} characters — a word, a phrase or an idiom.`);

    let scene: string | undefined;
    let crop: string | undefined;
    try {
      scene = readImage(body?.scene, 'scene');
      crop = readImage(body?.crop, 'crop');
    } catch (err) {
      if (err instanceof ImageError) return badRequest(err.message, err.status);
      throw err;
    }
    // A crop is only meaningful as a part of a scene.
    if (crop && !scene) return badRequest('A crop needs its scene');

    const lang = resolveLanguage(body?.language);
    const supabase = serviceClient();
    const learnerPromise = loadLearnerContext(supabase, userId, lang);

    // Claimed before the model call — see create-sticker for the reasoning.
    await consumeQuota(supabase, userId, 'create-card');

    const card = await createCard(
      text,
      lang,
      { images: scene ? { scene, crop } : undefined, chosen: readChosen(body?.chosen) },
      await learnerPromise,
    );

    return new Response(
      JSON.stringify({ ...card, language: lang }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('create-card error:', err);
    return errorResponse(err, corsHeaders);
  }
});
