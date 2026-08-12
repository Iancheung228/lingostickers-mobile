import jpeg from 'https://esm.sh/jpeg-js@0.4.4';

// ---------------------------------------------------------------------------
// pickDominantColor — a representative "ambient" color for a JPEG photo.
//
// Used to tint StickerDetailView's word card to match each sticker's memory
// photo. Deliberately a plain RGB mean rather than pickBorderColor's
// weighted-hue-circular-mean approach (see create-sticker/index.ts):
// pickBorderColor works because a bg-removed cutout is usually one coherent
// subject, so averaging hue makes sense. A full photo has many unrelated
// hues (sky + skin + clothing + background), and circular-averaging those
// can land on a hue nothing in the photo actually has (e.g. red + green +
// blue canceling toward gray/nonsense). A filtered RGB mean has no such
// cancellation failure mode.
//
// Near-black/near-white pixels are excluded so blown highlights or deep
// shadow noise don't wash the result toward gray — the caller (lib/color.ts
// on the client) is responsible for turning this into a UI-safe pastel;
// this function's job is just to be a faithful summary of the photo.
// ---------------------------------------------------------------------------
export function pickDominantColor(jpegBytes: Uint8Array): string {
  const decoded = jpeg.decode(jpegBytes, { useTArray: true });
  const { width, height, data } = decoded;

  // Sample on a grid rather than every pixel — plenty representative for an
  // "ambient color" estimate, and much cheaper on a ~1280px-long-side photo.
  const STRIDE = 4;

  const filtered = sumFiltered(data, width, height, STRIDE);
  const { sumR, sumG, sumB, count } = filtered.count > 0
    ? filtered
    // Whole photo was extreme (near-solid black or white) — fall back to an
    // unfiltered average rather than returning nothing.
    : sumAll(data, width, height, STRIDE);

  if (count === 0) return '#9AA5B1';

  return rgbToHex(
    Math.round(sumR / count),
    Math.round(sumG / count),
    Math.round(sumB / count),
  );
}

function sumFiltered(data: Uint8Array, width: number, height: number, stride: number) {
  let sumR = 0, sumG = 0, sumB = 0, count = 0;
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const idx = (y * width + x) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      const lightness = (Math.max(r, g, b) + Math.min(r, g, b)) / 2 / 255;
      if (lightness < 0.06 || lightness > 0.94) continue;
      sumR += r; sumG += g; sumB += b; count++;
    }
  }
  return { sumR, sumG, sumB, count };
}

function sumAll(data: Uint8Array, width: number, height: number, stride: number) {
  let sumR = 0, sumG = 0, sumB = 0, count = 0;
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const idx = (y * width + x) * 4;
      sumR += data[idx]; sumG += data[idx + 1]; sumB += data[idx + 2]; count++;
    }
  }
  return { sumR, sumG, sumB, count };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}
