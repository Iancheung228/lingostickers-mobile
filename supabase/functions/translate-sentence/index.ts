import { translateSentence, resolveLanguage } from '../_shared/vocab.ts';
import { requireUserId, consumeQuota, serviceClient, errorResponse } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_SENTENCE_CHARS = 300;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const userId = await requireUserId(req);

    const { englishSentence, language } = await req.json();
    if (!englishSentence || typeof englishSentence !== 'string' || !englishSentence.trim()) {
      return new Response(
        JSON.stringify({ error: 'Missing englishSentence' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // Every other text endpoint bounds its input before paying for a model
    // call (translate-word 60, create-card 120). A sentence about one scene
    // is well under this; anything longer is not a sentence the card can show.
    if (englishSentence.trim().length > MAX_SENTENCE_CHARS) {
      return new Response(
        JSON.stringify({ error: `Keep the sentence under ${MAX_SENTENCE_CHARS} characters.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Claimed before the model call — see create-sticker for the reasoning.
    await consumeQuota(serviceClient(), userId, 'translate-sentence');

    const lang = resolveLanguage(language);
    const result = await translateSentence(englishSentence.trim(), lang);

    return new Response(
      JSON.stringify({ ...result, language: lang }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('translate-sentence error:', err);
    return errorResponse(err, corsHeaders);
  }
});
