import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import UPNG from 'https://esm.sh/upng-js@2.1.0';
import { identifyWithGroq, resolveLanguage } from '../_shared/vocab.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { image, userId, language, memoryImage } = await req.json();
    if (!image || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing image or userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lang = resolveLanguage(language);
    const base64Data = image.includes(',') ? image.split(',')[1] : image;
    const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    const memoryBase64Data: string | undefined = memoryImage
      ? (memoryImage.includes(',') ? memoryImage.split(',')[1] : memoryImage)
      : undefined;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Run vocab identification, background removal, and the memory-photo
    // upload in parallel
    const [vocabResult, bgResult, memoryPhotoPath] = await Promise.all([
      identifyWithGroq(base64Data, lang, memoryBase64Data),
      removeBackground(imageBytes),
      uploadMemoryPhoto(supabase, memoryImage, userId),
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

    const bgIssue = bgResult.data ? null : classifyBgIssue(bgResult.status);

    const imagePath = `${userId}/${crypto.randomUUID()}.${fileExtension}`;
    const { error: uploadError } = await supabase.storage
      .from('sticker-images')
      .upload(imagePath, finalImageBytes, { contentType: finalMimeType, upsert: false });

    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

    return new Response(
      JSON.stringify({
        language: lang,
        word: vocabResult.word,
        translation: vocabResult.translation,
        reading: vocabResult.reading,
        sentence: vocabResult.sentence,
        sentenceTranslation: vocabResult.sentence_translation,
        category: vocabResult.category,
        imagePath,
        memoryPhotoPath,
        bgIssue,
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
// Memory photo — the full, uncropped scene the sticker was found in.
//
// Optional: uploads the raw photo so the app can "flip" a sticker to reveal
// the original moment. Failures here are non-fatal — the sticker is still
// created without a memory photo to flip to.
// ---------------------------------------------------------------------------
async function uploadMemoryPhoto(
  supabase: ReturnType<typeof createClient>,
  memoryImage: string | undefined,
  userId: string
): Promise<string | null> {
  if (!memoryImage) return null;

  try {
    const base64Data = memoryImage.includes(',') ? memoryImage.split(',')[1] : memoryImage;
    const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    const path = `${userId}/${crypto.randomUUID()}-memory.jpg`;
    const { error } = await supabase.storage
      .from('sticker-images')
      .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });

    if (error) {
      console.warn(`memory photo upload failed: ${error.message}`);
      return null;
    }
    return path;
  } catch (err: any) {
    console.warn(`memory photo upload threw: ${err?.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// uint8ToBase64 — chunked to avoid call-stack overflow on larger images
// ---------------------------------------------------------------------------
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// ---------------------------------------------------------------------------
// Background removal — Replicate (primary) with remove.bg fallback
//
// Replicate runs a rembg-family model for ~$0.004/image (vs remove.bg's
// $0.20+/image paid tiers / 50-image free cap) — see the "Background Removal"
// appendix in ROADMAP.md for the cost research behind this chain.
// remove.bg stays as a fallback for when Replicate is unconfigured, errors,
// or doesn't finish within its sync wait window — its 50/month free credits
// should comfortably cover that edge case alone.
// ---------------------------------------------------------------------------
async function removeBackground(imageBytes: Uint8Array): Promise<{ data: Uint8Array | null; status: string }> {
  const replicateResult = await removeBackgroundReplicate(imageBytes);
  if (replicateResult.data) return replicateResult;

  const removeBgResult = await removeBackgroundRemoveBg(imageBytes);
  if (removeBgResult.data) {
    return { data: removeBgResult.data, status: `${removeBgResult.status} (after replicate: ${replicateResult.status})` };
  }

  return { data: null, status: `replicate: ${replicateResult.status} | remove.bg: ${removeBgResult.status}` };
}

// Cache of resolved model -> version-id lookups, kept across warm
// invocations of the same Deno isolate to avoid an extra round-trip on
// every request.
const replicateVersionCache = new Map<string, string>();

// Resolves a "owner/name" model to its latest version hash. cjwbw/rembg is a
// community (non-"official") model, so Replicate's /v1/predictions endpoint
// requires a version hash rather than just "owner/name".
async function resolveReplicateVersion(apiKey: string, model: string): Promise<{ versionId: string | null; status?: string }> {
  const cached = replicateVersionCache.get(model);
  if (cached) return { versionId: cached };

  const response = await fetch(`https://api.replicate.com/v1/models/${model}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    const body = await response.text();
    return { versionId: null, status: `replicate model lookup ${response.status}: ${body.slice(0, 150)}` };
  }

  const modelInfo = await response.json();
  const versionId = modelInfo?.latest_version?.id;
  if (!versionId) return { versionId: null, status: 'replicate model lookup: no latest_version.id' };

  replicateVersionCache.set(model, versionId);
  return { versionId };
}

// ---------------------------------------------------------------------------
// Background removal — Replicate
//
// Runs a rembg-family model via Replicate's synchronous ("Prefer: wait") API,
// passing the JPEG as a base64 data URI (fine for inputs under ~1MB — our
// resized photos are well under that). REPLICATE_MODEL lets the model be
// swapped (e.g. for a higher-quality BiRefNet-based one) without a code
// change; defaults to cjwbw/rembg. REPLICATE_VERSION can pin an exact
// version hash, skipping the model-version lookup entirely.
// ---------------------------------------------------------------------------
async function removeBackgroundReplicate(imageBytes: Uint8Array): Promise<{ data: Uint8Array | null; status: string }> {
  const apiKey = Deno.env.get('REPLICATE_API_TOKEN');
  if (!apiKey) return { data: null, status: 'no REPLICATE_API_TOKEN secret' };

  const model = Deno.env.get('REPLICATE_MODEL') ?? 'cjwbw/rembg';
  const dataUri = `data:image/jpeg;base64,${uint8ToBase64(imageBytes)}`;

  try {
    let versionId = Deno.env.get('REPLICATE_VERSION') ?? null;
    if (!versionId) {
      const versionResult = await resolveReplicateVersion(apiKey, model);
      if (!versionResult.versionId) {
        return { data: null, status: versionResult.status ?? 'replicate: could not resolve model version' };
      }
      versionId = versionResult.versionId;
    }

    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait=20',
      },
      body: JSON.stringify({ version: versionId, input: { image: dataUri } }),
    });

    if (!response.ok) {
      const body = await response.text();
      return { data: null, status: `replicate ${response.status}: ${body.slice(0, 150)}` };
    }

    const prediction = await response.json();
    if (prediction.status !== 'succeeded') {
      return { data: null, status: `replicate ${prediction.status}: ${prediction.error ?? 'did not complete within 20s'}` };
    }

    const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
    if (!outputUrl) return { data: null, status: 'replicate succeeded with no output' };

    const imageResponse = await fetch(outputUrl, { headers: { 'Authorization': `Bearer ${apiKey}` } });
    if (!imageResponse.ok) return { data: null, status: `replicate output fetch ${imageResponse.status}` };

    const buf = await imageResponse.arrayBuffer();
    return { data: new Uint8Array(buf), status: `replicate ok (${buf.byteLength} bytes)` };

  } catch (err: any) {
    return { data: null, status: `replicate threw: ${err?.message}` };
  }
}

// ---------------------------------------------------------------------------
// Background removal — remove.bg (fallback)
//
// POSTs the JPEG to api.remove.bg and gets back a cut-out PNG (transparent
// bg). 50 free images/month — kept as a fallback for when Replicate is
// unavailable. See the "Background Removal" appendix in ROADMAP.md.
// ---------------------------------------------------------------------------
async function removeBackgroundRemoveBg(imageBytes: Uint8Array): Promise<{ data: Uint8Array | null; status: string }> {
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
// Turn a raw bg-removal failure status into a friendly, user-facing notice —
// so the app can tell the user *why* they got their full photo back instead
// of a clean cutout (rate limit vs. transient outage vs. misconfiguration),
// rather than silently degrading.
// ---------------------------------------------------------------------------
function classifyBgIssue(status: string): { kind: string; message: string } | null {
  if (status.includes(' ok')) return null;

  if (/\b429\b/.test(status)) {
    return {
      kind: 'limit',
      message: "Background removal hit its usage limit, so we used your original photo. Try again later for a clean cutout.",
    };
  }
  if (/\b40[13]\b/.test(status)) {
    return {
      kind: 'config',
      message: "Background removal is temporarily unavailable, so we used your original photo instead.",
    };
  }
  if (/\b5\d\d\b/.test(status)) {
    return {
      kind: 'temporary',
      message: "The background removal service is having issues right now, so we used your original photo. Try scanning again in a few minutes for a clean cutout.",
    };
  }
  return {
    kind: 'unknown',
    message: "We couldn't cleanly cut out your photo this time, so we used the original. Try scanning again.",
  };
}

// ---------------------------------------------------------------------------
// rgb <-> hsl helpers for picking a border colour that suits the subject
// ---------------------------------------------------------------------------
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

// ---------------------------------------------------------------------------
// Pick a border colour that suits the traced-out subject.
//
// Defaults to white. Only deviates when the subject has a clear, saturated
// hue — in which case we use a soft pastel of the *complementary* hue, which
// reads as an intentional, coordinated colour rather than a clashing outline.
// Washed-out, very light, or very dark subjects keep the white default since
// a tinted border would look muddy against them.
// ---------------------------------------------------------------------------
function pickBorderColor(src: Uint8Array, sw: number, sh: number): [number, number, number] {
  const WHITE: [number, number, number] = [255, 255, 255];

  let sumSin = 0, sumCos = 0, sumSat = 0, sumLight = 0, count = 0;
  for (let i = 0; i < sw * sh; i++) {
    const idx = i * 4;
    if (src[idx + 3] > 64) {
      const [h, s, l] = rgbToHsl(src[idx], src[idx + 1], src[idx + 2]);
      const rad = (h * Math.PI) / 180;
      // weight hue by saturation so vivid pixels dominate the average
      sumSin += Math.sin(rad) * s;
      sumCos += Math.cos(rad) * s;
      sumSat += s;
      sumLight += l;
      count++;
    }
  }
  if (count === 0) return WHITE;

  const avgSat = sumSat / count;
  const avgLight = sumLight / count;

  // Low-saturation (greyscale-ish), near-white, or near-black subjects:
  // a tinted border would look muddy — keep the clean white default.
  if (avgSat < 0.18 || avgLight > 0.85 || avgLight < 0.15) return WHITE;

  const avgHue = (Math.atan2(sumSin, sumCos) * 180) / Math.PI;
  const hue = avgHue < 0 ? avgHue + 360 : avgHue;
  const complementHue = (hue + 180) % 360;

  // Soft pastel of the complementary hue — coordinated, not clashing.
  return hslToRgb(complementHue, 0.45, 0.82);
}

// ---------------------------------------------------------------------------
// Sticker border — pure JS, no native deps
//
// Uses a fast O(n) separable dilation: expands the opaque region by
// `borderWidth` pixels in all 4 axis directions, then paints those
// expanded-but-not-original pixels with a colour chosen to complement the
// subject (see pickBorderColor — defaults to white).
// ---------------------------------------------------------------------------
function addStickerBorder(pngBytes: Uint8Array, borderWidth = 14): Uint8Array {
  const img = UPNG.decode(pngBytes.buffer as ArrayBuffer);
  const src = new Uint8Array(UPNG.toRGBA8(img)[0]);
  const sw = img.width;
  const sh = img.height;

  const [borderR, borderG, borderB] = pickBorderColor(src, sw, sh);

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
        out[dIdx]     = borderR;
        out[dIdx + 1] = borderG;
        out[dIdx + 2] = borderB;
        out[dIdx + 3] = 255;
      }
    }
  }

  return new Uint8Array(UPNG.encode([out.buffer as ArrayBuffer], dw, dh, 0));
}
