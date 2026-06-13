// ---------------------------------------------------------------------------
// Shared Groq vocab helpers — language-templated prompts for turning an
// object (image or English word) into a vocabulary card.
//
// Adding a language: add an entry to LANGUAGE_SCHEMAS describing what
// "word"/"reading" mean for that language, with concrete examples. The JSON
// contract (word/translation/reading/category) stays the same across
// languages so callers never need to branch on language.
// ---------------------------------------------------------------------------

export type Language = 'fr' | 'ja';

interface LanguageSchema {
  label: string;
  schemaDescription: string;
}

const LANGUAGE_SCHEMAS: Record<Language, LanguageSchema> = {
  fr: {
    label: 'French',
    schemaDescription: `{
  "word": "the object name in French with article (e.g. Le Café, La Pomme, Le Chien)",
  "translation": "English translation (e.g. Coffee, Apple, Dog)",
  "reading": "phonetic spelling of the French word in English (e.g. luh ka-fay, la pum, luh she-en)",
  "category": "one of exactly: Kitchen, Animals, Study, Nature, Other"
}`,
  },
  ja: {
    label: 'Japanese',
    schemaDescription: `{
  "word": "the object name in Japanese, written naturally with kanji/katakana/hiragana as appropriate (e.g. コーヒー, りんご, 犬)",
  "translation": "English translation (e.g. Coffee, Apple, Dog)",
  "reading": "romaji reading of the Japanese word, using macrons for long vowels (e.g. kōhī, ringo, inu)",
  "category": "one of exactly: Kitchen, Animals, Study, Nature, Other"
}`,
  },
};

// Narrows an arbitrary request value to a supported Language, defaulting to
// French — keeps callers from having to validate/throw on bad input.
export function resolveLanguage(language: unknown): Language {
  return language === 'ja' ? 'ja' : 'fr';
}

function cleanJsonResponse(text: string): string {
  return text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
}

async function callGroq(apiKey: string, messages: unknown): Promise<string> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages,
      temperature: 0.1,
    }),
  });

  if (!response.ok) throw new Error(`Groq API error: ${response.status} ${await response.text()}`);
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Empty response from Groq');
  return cleanJsonResponse(text);
}

// Vision: identify the main object in a photo and produce a vocab card in
// the target language.
export async function identifyWithGroq(base64Data: string, language: Language) {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  const { schemaDescription } = LANGUAGE_SCHEMAS[language];
  const text = await callGroq(apiKey, [{
    role: 'user',
    content: [
      { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Data}` } },
      {
        type: 'text',
        text: `Identify the main object in this image. Return ONLY a valid JSON object with these exact fields:
${schemaDescription}
Return only the JSON, no markdown, no explanation.`,
      },
    ],
  }]);

  return JSON.parse(text);
}

// Text: re-derive a vocab card in the target language for a user-supplied
// English word — used when the user corrects the detected object.
export async function translateWithGroq(englishWord: string, language: Language) {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  const { label, schemaDescription } = LANGUAGE_SCHEMAS[language];
  const text = await callGroq(apiKey, [{
    role: 'user',
    content: `Translate the English word "${englishWord}" into ${label} for a vocabulary flashcard. Return ONLY a valid JSON object with these exact fields:
${schemaDescription}
Return only the JSON, no markdown, no explanation.`,
  }]);

  return JSON.parse(text);
}
