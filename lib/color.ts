// Turns a photo's raw dominant color (computed server-side, see
// supabase/functions/_shared/imageColor.ts) into the app's existing tonal
// roles — kept separate from extraction so this tuning can be adjusted
// without redeploying an edge function or backfilling stored colors.
//
// The app's fixed palette (constants/theme.ts) already lives in one hue
// family (~198–201°, the "sky" cyan) expressed at a handful of L/S bands —
// sky/cardAlt for airy surfaces, skyDeep/skyNight for a recessed panel,
// terraLight/terraDark for an accent pill. Rather than inventing a new
// scheme, these functions replicate those same bands but let the HUE float
// to match each sticker's memory photo — same system, personalized per
// photo. Every band is clamped into a moderate, pastel-safe range (never
// the raw extracted saturation/lightness) so the result stays legible and
// tasteful across every possible source hue, not just the cyan the fixed
// palette was hand-tuned for.
//
// Two hue families are used:
//  - SAME hue as the photo, for structural/passive surfaces (page
//    background, panel, cards, tags) — recedes, harmonizes.
//  - COMPLEMENTARY hue (+180°), for interactive/CTA elements (buttons,
//    icons) — pops, stays legible, mirrors the same "coordinated
//    complementary accent" trick create-sticker's pickBorderColor already
//    uses for sticker borders.
//
// Deliberately NOT themed: anything carrying semantic meaning elsewhere in
// the app (colors.error for delete/recording/favorited, colors.sage for
// "your" voice recording vs "AI"'s pronunciation) — recoloring those would
// break conventions the rest of the app relies on.

type Band = { hueShift?: number; minS: number; maxS: number; minL: number; maxL: number };

const ROLES = {
  // Page background, hero gradient terminus, card faces, tag chips —
  // lightest, most restrained band. Same as this file's original
  // getPastelSurfaceColor.
  surface: { minS: 0, maxS: 0.4, minL: 0.93, maxL: 0.97 },
  // Recessed panel fill — a shade deeper, like skyDeep.
  panel: { minS: 0, maxS: 0.5, minL: 0.85, maxL: 0.9 },
  // Panel border — deeper still, like skyNight.
  panelBorder: { minS: 0, maxS: 0.55, minL: 0.74, maxL: 0.82 },
  // CTA pill backgrounds (challenge button, AI pronunciation) — complementary
  // hue, light. Saturation is floored (not just capped) so it always reads
  // as intentionally colored rather than fading to gray on a muted photo.
  accentSurface: { hueShift: 180, minS: 0.35, maxS: 0.55, minL: 0.87, maxL: 0.92 },
  // CTA icons/text/borders — complementary hue. The starting lightness band
  // is just a seed; getAccentTint darkens further as needed (see below) to
  // *guarantee* WCAG contrast against accentSurface, since HSL lightness
  // alone is not a reliable proxy for perceptual contrast — green/cyan
  // hues read much lighter than red/blue at the same L (validated by
  // scripting the actual contrast ratio across a hue sweep before shipping
  // this; a fixed L band alone failed the 3:1 minimum on most hues).
  accent: { hueShift: 180, minS: 0.45, maxS: 0.7, minL: 0.55, maxL: 0.68 },
} as const satisfies Record<string, Band>;

const ACCENT_MIN_CONTRAST = 3.5;
const ACCENT_MIN_LIGHTNESS = 0.18;
const ACCENT_DARKEN_STEP = 0.03;

function tint(hex: string | null | undefined, fallback: string, band: Band): string {
  if (!hex) return fallback;
  const rgb = hexToRgb(hex);
  if (!rgb) return fallback;

  const [h, s, l] = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const shiftedH = ((h + (band.hueShift ?? 0)) % 360 + 360) % 360;
  const clampedS = clamp(s, band.minS, band.maxS);
  const clampedL = clamp(l, band.minL, band.maxL);

  const { r, g, b } = hslToRgb(shiftedH, clampedS, clampedL);
  return rgbToHex(r, g, b);
}

export const getSurfaceTint = (hex: string | null | undefined, fallback: string) => tint(hex, fallback, ROLES.surface);
export const getPanelTint = (hex: string | null | undefined, fallback: string) => tint(hex, fallback, ROLES.panel);
export const getPanelBorderTint = (hex: string | null | undefined, fallback: string) => tint(hex, fallback, ROLES.panelBorder);
export const getAccentSurfaceTint = (hex: string | null | undefined, fallback: string) => tint(hex, fallback, ROLES.accentSurface);

// Same hue/saturation as ROLES.accent's seed, but darkened step-by-step
// until it actually clears ACCENT_MIN_CONTRAST against this sticker's own
// accentSurface color — darkening at fixed hue/saturation monotonically
// lowers relative luminance for every hue, so this always converges.
export function getAccentTint(hex: string | null | undefined, fallback: string, fallbackSurface: string): string {
  if (!hex) return fallback;
  const rgb = hexToRgb(hex);
  if (!rgb) return fallback;

  const against = hexToRgb(getAccentSurfaceTint(hex, fallbackSurface))!;

  const [h, s] = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const shiftedH = ((h + (ROLES.accent.hueShift ?? 0)) % 360 + 360) % 360;
  const clampedS = clamp(s, ROLES.accent.minS, ROLES.accent.maxS);

  let l = ROLES.accent.maxL;
  let candidate = hslToRgb(shiftedH, clampedS, l);
  while (contrastRatio(candidate, against) < ACCENT_MIN_CONTRAST && l > ACCENT_MIN_LIGHTNESS) {
    l -= ACCENT_DARKEN_STEP;
    candidate = hslToRgb(shiftedH, clampedS, l);
  }
  return rgbToHex(candidate.r, candidate.g, candidate.b);
}

function relativeLuminance(r: number, g: number, b: number): number {
  const [R, G, B] = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(c1: { r: number; g: number; b: number }, c2: { r: number; g: number; b: number }): number {
  const L1 = relativeLuminance(c1.r, c1.g, c1.b), L2 = relativeLuminance(c2.r, c2.g, c2.b);
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!match) return null;
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')}`;
}

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

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
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
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}
