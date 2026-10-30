// ---------------------------------------------------------------------------
// scene-words — ask one scene prompt of a photo, get back words to choose.
//
//   { scene, crop?, promptId, custom?, language, avoid? }
//     → { prompt, candidates: [{ word, translation, part_of_speech, reading }] }
//
// The chips only. Each chip the learner keeps becomes a full card through
// create-card, so sentences are never generated for words nobody picked.
// See _shared/scenePrompts.ts for the prompts themselves.
// ---------------------------------------------------------------------------
import { sceneWords, resolveLanguage } from '../_shared/vocab.ts';
import { cleanAvoidList, cleanCustomQuestion, findScenePrompt } from '../_shared/scenePrompts.ts';
import { readImage, ImageError } from '../_shared/requestImages.ts';
import { requireUserId, consumeQuota, serviceClient, errorResponse } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function badRequest(message: string, status = 400): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const userId = await requireUserId(req);

    const body = await req.json();

    const prompt = findScenePrompt(body?.promptId);
    if (!prompt) return badRequest('Unknown prompt');

    const custom = prompt.id === 'custom' ? cleanCustomQuestion(body?.custom) : null;
    if (prompt.id === 'custom' && !custom) return badRequest('Ask a question of up to 80 characters.');

    let scene: string | undefined;
    let crop: string | undefined;
    try {
      scene = readImage(body?.scene, 'scene');
      crop = readImage(body?.crop, 'crop');
    } catch (err) {
      if (err instanceof ImageError) return badRequest(err.message, err.status);
      throw err;
    }
    if (!scene) return badRequest('Missing scene');

    const lang = resolveLanguage(body?.language);
    const avoid = cleanAvoidList(body?.avoid);

    // Claimed before the model call — see create-sticker for the reasoning.
    await consumeQuota(serviceClient(), userId, 'scene-words');

    const candidates = await sceneWords({ scene, crop }, prompt, lang, { custom, avoid });

    return new Response(
      JSON.stringify({ prompt: prompt.id, language: lang, candidates }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('scene-words error:', err);
    return errorResponse(err, corsHeaders);
  }
});
