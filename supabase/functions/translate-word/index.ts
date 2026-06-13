import { translateWithGroq, resolveLanguage } from '../_shared/vocab.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { englishWord, language } = await req.json();
    if (!englishWord || typeof englishWord !== 'string' || !englishWord.trim()) {
      return new Response(
        JSON.stringify({ error: 'Missing englishWord' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lang = resolveLanguage(language);
    const vocab = await translateWithGroq(englishWord.trim(), lang);

    return new Response(
      JSON.stringify({ ...vocab, language: lang }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('translate-word error:', err);
    return new Response(
      JSON.stringify({ error: err?.message ?? 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
