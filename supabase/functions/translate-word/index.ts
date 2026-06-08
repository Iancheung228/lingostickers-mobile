const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { englishWord } = await req.json();
    if (!englishWord || typeof englishWord !== 'string' || !englishWord.trim()) {
      return new Response(
        JSON.stringify({ error: 'Missing englishWord' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const vocab = await translateWithGroq(englishWord.trim());

    return new Response(
      JSON.stringify(vocab),
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

// ---------------------------------------------------------------------------
// Groq text completion — English word → French vocabulary
//
// Mirrors the JSON contract of identifyWithGroq in create-sticker, but skips
// the vision step entirely: the user has already told us the English word, we
// just need its French translation, pronunciation, and category.
// ---------------------------------------------------------------------------
async function translateWithGroq(englishWord: string) {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{
        role: 'user',
        content: `Translate the English word "${englishWord}" into French for a vocabulary flashcard. Return ONLY a valid JSON object with these exact fields:
{
  "name": "the word in French with article (e.g. Le Café, La Pomme, Le Chien)",
  "translation": "the English word, capitalized (e.g. Coffee, Apple, Dog)",
  "pronunciation": "phonetic spelling of the French word in English (e.g. luh ka-fay, la pum, luh she-en)",
  "category": "one of exactly: Kitchen, Animals, Study, Nature, Other"
}
Return only the JSON, no markdown, no explanation.`,
      }],
      temperature: 0.1,
    }),
  });

  if (!response.ok) throw new Error(`Groq API error: ${response.status} ${await response.text()}`);
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Empty response from Groq');
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  return JSON.parse(cleaned);
}
