// translate-word — the headword fields for a corrected card, in either direction.
//
//   { englishWord, language } → the target-language word for an English meaning
//   { word, language }        → reading, meaning and part of speech for a
//                                target-language word the learner typed
import { translateWord, describeWord, resolveLanguage } from '../_shared/vocab.ts';

/** A word or short phrase, not a paragraph. Matches the editor's own cap. */
const MAX_CHARS = 60;
import { requireUserId, consumeQuota, serviceClient, errorResponse } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const userId = await requireUserId(req);

    const { englishWord, word, language } = await req.json();
    // Newlines and the fence marker would let a typed word escape its quotes.
    const clean = (v: unknown) =>
      typeof v === 'string' ? v.replace(/[\r\n]+/g, ' ').replace(/"""/g, '"').trim() : '';
    const english = clean(englishWord);
    const target = clean(word);
    const input = english || target;
    if (!input || input.length > MAX_CHARS) {
      return new Response(
        JSON.stringify({ error: input ? `Keep it under ${MAX_CHARS} characters.` : 'Missing word' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Claimed before the model call — see create-sticker for the reasoning.
    await consumeQuota(serviceClient(), userId, 'translate-word');

    const lang = resolveLanguage(language);
    const vocab = english ? await translateWord(english, lang) : await describeWord(target, lang);

    return new Response(
      JSON.stringify({ ...vocab, language: lang }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('translate-word error:', err);
    return errorResponse(err, corsHeaders);
  }
});
