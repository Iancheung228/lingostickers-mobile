// ---------------------------------------------------------------------------
// Shared Groq vocab helpers — language-templated prompts for turning an
// object (image or English word) into a vocabulary card.
//
// Adding a language: add an entry to LANGUAGE_SCHEMAS describing what
// "word"/"reading" mean for that language, with concrete examples. The JSON
// contract (word/translation/reading/category) stays the same across
// languages so callers never need to branch on language.
// ---------------------------------------------------------------------------

export type Language = 'fr' | 'ja' | 'yue';

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
  "sentence": "a short, natural French sentence describing this object in the scene it was photographed in (e.g. 'Le café est posé sur le bureau, prêt pour le matin.')",
  "sentence_translation": "English translation of the sentence (e.g. 'The coffee is sitting on the desk, ready for the morning.')",
  "category": "one of exactly: Kitchen, Animals, Study, Nature, Other"
}`,
  },
  ja: {
    label: 'Japanese',
    schemaDescription: `{
  "word": "the object name in Japanese, written naturally with kanji/katakana/hiragana as appropriate (e.g. コーヒー, りんご, 犬)",
  "translation": "English translation (e.g. Coffee, Apple, Dog)",
  "reading": "romaji reading of the Japanese word, using macrons for long vowels (e.g. kōhī, ringo, inu)",
  "sentence": "a short, natural Japanese sentence describing this object in the scene it was photographed in (e.g. 'コーヒーがデスクの上に置いてあります。')",
  "sentence_translation": "English translation of the sentence (e.g. 'The coffee is sitting on the desk.')",
  "category": "one of exactly: Kitchen, Animals, Study, Nature, Other"
}`,
  },
  yue: {
    label: 'Cantonese',
    schemaDescription: `{
  "word": "the object name in Cantonese, written in Traditional Chinese characters as used in Hong Kong (e.g. 咖啡, 蘋果, 狗)",
  "translation": "English translation (e.g. Coffee, Apple, Dog)",
  "reading": "Jyutping romanization of the Cantonese word, with tone numbers (e.g. gaa3 fe1, ping4 gwo2, gau2)",
  "sentence": "a short, natural Cantonese sentence (written in Traditional Chinese characters, colloquial Cantonese grammar/vocabulary — not Standard Written Chinese) describing this object in the scene it was photographed in (e.g. '杯咖啡放喺張枱度，準備好聽朝飲。')",
  "sentence_translation": "English translation of the sentence (e.g. 'The coffee is sitting on the desk, ready for the morning.')",
  "category": "one of exactly: Kitchen, Animals, Study, Nature, Other"
}`,
  },
};

// Narrows an arbitrary request value to a supported Language, defaulting to
// French — keeps callers from having to validate/throw on bad input.
export function resolveLanguage(language: unknown): Language {
  if (language === 'ja' || language === 'yue') return language;
  return 'fr';
}

function cleanJsonResponse(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '')
    .trim();
}

// Groq's free-tier TPM budget is small enough that a single vision request
// (base64 image(s) + prompt) can trip it on its own — this isn't a symptom
// of stacked calls, just normal token pressure. The 429 body tells us
// exactly how long to wait ("please try again in 7.95s"), so retry that
// wait instead of failing the whole scan over a few-second token-bucket dip.
const GROQ_MAX_RETRIES = 2;
const GROQ_RETRY_CAP_MS = 15_000; // never wait longer than this per attempt, however long the API asks

function parseRetryAfterMs(response: Response, bodyText: string): number {
  const headerVal = response.headers.get('retry-after');
  if (headerVal) {
    const seconds = Number(headerVal);
    if (!Number.isNaN(seconds)) return seconds * 1000;
  }
  const match = bodyText.match(/try again in ([\d.]+)s/i);
  if (match) return parseFloat(match[1]) * 1000;
  return 2000; // couldn't parse a wait time — small fallback delay before retrying
}

async function callGroq(apiKey: string, messages: unknown): Promise<string> {
  for (let attempt = 0; attempt <= GROQ_MAX_RETRIES; attempt++) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen/qwen3.6-27b',
        messages,
        temperature: 0.1,
        // This model reasons by default, prepending a <think>...</think> block
        // to its response — 'none' + 'hidden' keep the content field pure JSON.
        reasoning_effort: 'none',
        reasoning_format: 'hidden',
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error('Empty response from Groq');
      return cleanJsonResponse(text);
    }

    const bodyText = await response.text();

    if (response.status === 429) {
      if (attempt < GROQ_MAX_RETRIES) {
        const waitMs = Math.min(parseRetryAfterMs(response, bodyText), GROQ_RETRY_CAP_MS);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }
      throw new Error("We're being rate-limited right now — please wait a few seconds and try again.");
    }

    throw new Error(`Groq API error: ${response.status} ${bodyText}`);
  }

  // Unreachable — the loop always returns or throws — but keeps TypeScript
  // happy about every code path returning a value.
  throw new Error('Groq API error: exhausted retries');
}

// Vision: identify the main object in a photo and produce a vocab card in
// the target language, including a sentence about the scene. When
// `memoryBase64Data` (the full, uncropped photo) is available, it's passed
// alongside the close-up so the sentence can describe the wider scene —
// not just the isolated object.
export async function identifyWithGroq(base64Data: string, language: Language, memoryBase64Data?: string) {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  const { label, schemaDescription } = LANGUAGE_SCHEMAS[language];
  const content: unknown[] = [
    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Data}` } },
  ];

  let instructions: string;
  if (memoryBase64Data) {
    content.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${memoryBase64Data}` } });
    instructions = `The FIRST image is a close-up crop of a single object — this is the ONLY object you are identifying. The SECOND image is the wider, uncropped scene it was found in, provided purely for background context. The "word", "translation", and "reading" fields must describe ONLY the object in the FIRST image, never something else that happens to appear in the second image. Once you've identified that object, write a short, natural "sentence" in ${label} describing that exact same object as it appears in the wider scene (the second image) — what it's near, what's happening, who might be using it — but the object itself must stay the one from the first image.`;
  } else {
    instructions = `Identify the main object in this image, then write a short, natural sentence in ${label} describing the object in this scene.`;
  }

  content.push({
    type: 'text',
    text: `${instructions} Return ONLY a valid JSON object with these exact fields:
${schemaDescription}
Return only the JSON, no markdown, no explanation.`,
  });

  const text = await callGroq(apiKey, [{ role: 'user', content }]);
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

// Text: list a few other natural ways to say/write the same word, so a
// challenge's answer check isn't pinned to one exact spelling — used once at
// send-challenge time, not on every guess.
export async function getAcceptedAnswersWithGroq(word: string, language: Language): Promise<string[]> {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) return [];

  const { label } = LANGUAGE_SCHEMAS[language];
  try {
    const text = await callGroq(apiKey, [{
      role: 'user',
      content: `Given the ${label} word/phrase "${word}", list up to 3 other common, natural ways to say or write the exact same thing in ${label} — true synonyms or commonly accepted alternate spellings, NOT the English translation and NOT a related-but-different word. If there are no reasonable alternatives, return an empty list. Return ONLY a valid JSON object with this exact field:
{
  "synonyms": ["alternative 1", "alternative 2"]
}
Return only the JSON, no markdown, no explanation.`,
    }]);
    const parsed = JSON.parse(text);
    const synonyms = Array.isArray(parsed?.synonyms) ? parsed.synonyms : [];
    return synonyms.filter((s: unknown): s is string => typeof s === 'string' && s.trim().length > 0);
  } catch (err) {
    console.error('getAcceptedAnswersWithGroq failed, continuing without synonyms:', err);
    return [];
  }
}

// Text: translate a user-written/edited English sentence into the target
// language — used when the user edits the sentence describing their memory.
export async function translateSentenceWithGroq(englishSentence: string, language: Language) {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  const { label } = LANGUAGE_SCHEMAS[language];
  const text = await callGroq(apiKey, [{
    role: 'user',
    content: `Translate the following English sentence into natural, conversational ${label}: "${englishSentence}"
Return ONLY a valid JSON object with this exact field:
{
  "sentence": "the ${label} translation"
}
Return only the JSON, no markdown, no explanation.`,
  }]);

  return JSON.parse(text);
}
