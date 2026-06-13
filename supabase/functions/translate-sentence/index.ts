import { translateSentenceWithGroq, resolveLanguage } from '../_shared/vocab.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { englishSentence, language } = await req.json();
    if (!englishSentence || typeof englishSentence !== 'string' || !englishSentence.trim()) {
      return new Response(
        JSON.stringify({ error: 'Missing englishSentence' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lang = resolveLanguage(language);
    const result = await translateSentenceWithGroq(englishSentence.trim(), lang);

    return new Response(
      JSON.stringify({ ...result, language: lang }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('translate-sentence error:', err);
    return new Response(
      JSON.stringify({ error: err?.message ?? 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
