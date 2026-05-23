import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import UPNG from 'https://esm.sh/upng-js@2.1.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { image, userId } = await req.json();
    if (!image || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing image or userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const base64Data = image.includes(',') ? image.split(',')[1] : image;
    const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    // Run vocab identification and background removal in parallel
    const [vocabResult, bgResult] = await Promise.all([
      identifyWithGroq(base64Data),
      removeBackground(imageBytes),
    ]);

    console.log(`bg removal: ${bgResult.status}`);

    let finalImageBytes: Uint8Array;
    let finalMimeType: string;
    let fileExtension: string;

    if (bgResult.data) {
      try {
        finalImageBytes = addStickerBorder(bgResult.data);
        console.log(`sticker border added: ${finalImageBytes.length} bytes`);
      } catch (err: any) {
        console.warn(`addStickerBorder failed (${err?.message}) — using bg-removed PNG without border`);
        finalImageBytes = bgResult.data;
      }
      finalMimeType = 'image/png';
      fileExtension = 'png';
    } else {
      console.warn('bg removal failed — uploading original jpeg');
      finalImageBytes = imageBytes;
      finalMimeType = 'image/jpeg';
      fileExtension = 'jpg';
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const imagePath = `${userId}/${crypto.randomUUID()}.${fileExtension}`;
    const { error: uploadError } = await supabase.storage
      .from('sticker-images')
      .upload(imagePath, finalImageBytes, { contentType: finalMimeType, upsert: false });

    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

    return new Response(
      JSON.stringify({
        name: vocabResult.name,
        translation: vocabResult.translation,
        pronunciation: vocabResult.pronunciation,
        category: vocabResult.category,
        imagePath,
        _debug_bgStatus: bgResult.status,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('create-sticker error:', err);
    return new Response(
      JSON.stringify({ error: err?.message ?? 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ---------------------------------------------------------------------------
// Background removal — HuggingFace RMBG-1.4
//
// HF segmentation API returns JSON: [{ label, score, mask }]
// where `mask` is a base64-encoded grayscale PNG (white=foreground, black=bg).
// We decode that mask and apply it as the alpha channel to the original JPEG.
//
// Fallback (commented out): Clipdrop remove-background API (100 one-time credits)
// To re-enable: uncomment the clipdropFallback call below and set CLIPDROP_API_KEY secret.
// ---------------------------------------------------------------------------
async function removeBackground(imageBytes: Uint8Array): Promise<{ data: Uint8Array | null; status: string }> {
  const apiKey = Deno.env.get('REMOVEBG_API_KEY');
  if (!apiKey) return { data: null, status: 'no REMOVEBG_API_KEY secret' };

  try {
    const form = new FormData();
    form.append('image_file', new Blob([imageBytes], { type: 'image/jpeg' }), 'image.jpg');
    form.append('size', 'auto');

    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': apiKey },
      body: form,
    });

    if (!response.ok) {
      const body = await response.text();
      return { data: null, status: `remove.bg ${response.status}: ${body.slice(0, 150)}` };
    }

    const buf = await response.arrayBuffer();
    return { data: new Uint8Array(buf), status: `remove.bg ok (${buf.byteLength} bytes)` };

  } catch (err: any) {
    return { data: null, status: `remove.bg threw: ${err?.message}` };
  }
}

// ---------------------------------------------------------------------------
// White sticker border — pure JS, no native deps
//
// Uses a fast O(n) separable dilation: expands the opaque region by
// `borderWidth` pixels in all 4 axis directions, then paints those
// expanded-but-not-original pixels solid white.
// ---------------------------------------------------------------------------
function addStickerBorder(pngBytes: Uint8Array, borderWidth = 14): Uint8Array {
  const img = UPNG.decode(pngBytes.buffer as ArrayBuffer);
  const src = new Uint8Array(UPNG.toRGBA8(img)[0]);
  const sw = img.width;
  const sh = img.height;

  const pad = borderWidth;
  const dw = sw + pad * 2;
  const dh = sh + pad * 2;

  // Alpha mask in padded space
  const alpha = new Uint8Array(dw * dh);
  for (let sy = 0; sy < sh; sy++) {
    for (let sx = 0; sx < sw; sx++) {
      if (src[(sy * sw + sx) * 4 + 3] > 64) {
        alpha[(sy + pad) * dw + (sx + pad)] = 1;
      }
    }
  }

  // Separable dilation (horizontal then vertical passes)
  const borderMask = new Uint8Array(dw * dh);

  for (let y = 0; y < dh; y++) {
    let last = -borderWidth - 1;
    for (let x = 0; x < dw; x++) {
      if (alpha[y * dw + x]) last = x;
      if (x - last <= borderWidth) borderMask[y * dw + x] = 1;
    }
    last = dw + borderWidth + 1;
    for (let x = dw - 1; x >= 0; x--) {
      if (alpha[y * dw + x]) last = x;
      if (last - x <= borderWidth) borderMask[y * dw + x] = 1;
    }
  }
  for (let x = 0; x < dw; x++) {
    let last = -borderWidth - 1;
    for (let y = 0; y < dh; y++) {
      if (alpha[y * dw + x]) last = y;
      if (y - last <= borderWidth) borderMask[y * dw + x] = 1;
    }
    last = dh + borderWidth + 1;
    for (let y = dh - 1; y >= 0; y--) {
      if (alpha[y * dw + x]) last = y;
      if (last - y <= borderWidth) borderMask[y * dw + x] = 1;
    }
  }

  const out = new Uint8Array(dw * dh * 4);
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const mIdx = y * dw + x;
      const dIdx = mIdx * 4;
      if (alpha[mIdx]) {
        const sIdx = ((y - pad) * sw + (x - pad)) * 4;
        out[dIdx]     = src[sIdx];
        out[dIdx + 1] = src[sIdx + 1];
        out[dIdx + 2] = src[sIdx + 2];
        out[dIdx + 3] = src[sIdx + 3];
      } else if (borderMask[mIdx]) {
        out[dIdx]     = 167; // #A7D7C5 mint green — matches app accent colour
        out[dIdx + 1] = 215;
        out[dIdx + 2] = 197;
        out[dIdx + 3] = 255;
      }
    }
  }

  return new Uint8Array(UPNG.encode([out.buffer as ArrayBuffer], dw, dh, 0));
}

// ---------------------------------------------------------------------------
// Clipdrop fallback (disabled — uncomment + set CLIPDROP_API_KEY to re-enable)
// ---------------------------------------------------------------------------
// async function clipdropFallback(imageBytes: Uint8Array): Promise<{ data: Uint8Array | null; status: string }> {
//   const apiKey = Deno.env.get('CLIPDROP_API_KEY');
//   if (!apiKey) return { data: null, status: 'no CLIPDROP_API_KEY' };
//   try {
//     const form = new FormData();
//     form.append('image_file', new Blob([imageBytes], { type: 'image/jpeg' }), 'image.jpg');
//     const response = await fetch('https://clipdrop-api.co/remove-background/v1', {
//       method: 'POST',
//       headers: { 'x-api-key': apiKey },
//       body: form,
//     });
//     if (!response.ok) {
//       const body = await response.text();
//       return { data: null, status: `clipdrop ${response.status}: ${body.slice(0, 120)}` };
//     }
//     const buf = await response.arrayBuffer();
//     return { data: new Uint8Array(buf), status: `clipdrop ok (${buf.byteLength} bytes)` };
//   } catch (err: any) {
//     return { data: null, status: `clipdrop threw: ${err?.message}` };
//   }
// }

// ---------------------------------------------------------------------------
// Groq vision — object identification → French vocabulary
// ---------------------------------------------------------------------------
async function identifyWithGroq(base64Data: string) {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Data}` } },
          {
            type: 'text',
            text: `Identify the main object in this image. Return ONLY a valid JSON object with these exact fields:
{
  "name": "the object name in French with article (e.g. Le Café, La Pomme, Le Chien)",
  "translation": "English translation (e.g. Coffee, Apple, Dog)",
  "pronunciation": "phonetic spelling in English (e.g. luh ka-fay, la pum, luh she-en)",
  "category": "one of exactly: Kitchen, Animals, Study, Nature, Other"
}
Return only the JSON, no markdown, no explanation.`,
          },
        ],
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
