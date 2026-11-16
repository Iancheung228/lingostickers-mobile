// WCAG contrast over the token pairs the app actually renders.
//   node --experimental-strip-types scripts/check-contrast.mts
// Exits 1 if any DARK pair is under its threshold. The light palette is frozen
// (light mode must look unchanged), so its sub-threshold pairs are reported as
// LEGACY and never fail the run.
import { lightColors, darkColors, type Palette } from '../constants/palettes.ts';

type RGBA = [number, number, number, number];
function lin(c: number) { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
function parse(s: string): RGBA {
  if (s.startsWith('#')) {
    const h = s.slice(1);
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  const p = s.match(/rgba?\(([^)]+)\)/)![1].split(',').map(x => parseFloat(x));
  return [p[0], p[1], p[2], p[3] ?? 1];
}
function flatten(fg: RGBA, under: number[]): number[] {
  return [0, 1, 2].map(i => fg[i] * fg[3] + under[i] * (1 - fg[3]));
}
function lum(rgb: number[]) { return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]); }
function ratio(fg: string, bg: string, page: string) {
  const b = flatten(parse(bg), parse(page).slice(0, 3));
  const f = flatten(parse(fg), b);
  const [hi, lo] = [lum(f), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [foreground token, background token, threshold, note]
type Pair = [keyof Palette, keyof Palette, number, string];
const T = 4.5, UI = 3;
const pairs: Pair[] = [
  ['inkDark', 'sky', T, 'headings on page'],
  ['inkDark', 'card', T, 'headings on card'],
  ['inkDark', 'cardAlt', T, 'headings on sand well'],
  ['inkMid', 'sky', T, 'body on page'],
  ['inkMid', 'card', T, 'body on card'],
  ['inkMid', 'cardAlt', T, 'body on sand well'],
  ['inkMid', 'terraLight', T, 'body on muted rose'],
  ['inkLight', 'sky', T, 'captions on page'],
  ['inkLight', 'card', T, 'captions on card'],
  ['inkLight', 'cardAlt', T, 'captions on sand'],
  ['inkFaint', 'sky', T, 'placeholder on page'],
  ['inkFaint', 'card', T, 'placeholder on input'],
  ['inkFaint', 'cardAlt', T, 'placeholder on sand'],
  ['maroon', 'skyDeep', T, 'text on the rose band'],
  ['maroon', 'blush', T, 'text on the rose pill'],
  ['white', 'terra', T, 'CTA label'],
  ['white', 'terraDark', T, 'CTA pressed label'],
  ['white', 'blushDeep', T, 'camera button glyph'],
  ['white', 'blush', UI, 'tab icon on the pill (non-text, 3:1)'],
  ['white', 'errorDeep', T, 'grade Again label'],
  ['white', 'successDeep', T, 'grade Easy label'],
  ['card', 'charcoal', T, 'toast text'],
  ['terraInk', 'sky', T, 'accent text on page'],
  ['terraInk', 'card', T, 'accent text on card'],
  ['terraInk', 'cardAlt', T, 'accent text on sand'],
  ['errorInk', 'sky', T, 'error text on page'],
  ['errorInk', 'card', T, 'error text on card'],
  ['errorInk', 'errorLight', T, 'error text on its wash'],
  ['successInk', 'sky', T, 'success text on page'],
  ['successInk', 'card', T, 'success text on card'],
  ['successInk', 'successLight', T, 'success text on its wash'],
  ['sageInk', 'card', T, 'sand-gold text on card'],
  ['sageInk', 'sky', T, 'sand-gold text on page'],
  ['blushDeepInk', 'card', T, 'tab glyph on the focus disc'],
  ['inkMid', 'glass', T, 'body on translucent panel'],
  ['inkDark', 'glass', T, 'heading on translucent panel'],
  ['inkDark', 'roseWash', T, 'heading on rose wash'],
  ['inkMid', 'roseWash', T, 'body on rose wash'],
];

let darkFail = 0;
for (const [name, p] of [['LIGHT', lightColors], ['DARK', darkColors]] as const) {
  console.log(`\n${name}`);
  for (const [fg, bg, min, note] of pairs) {
    const r = ratio(p[fg], p[bg], p.sky);
    const ok = r >= min;
    if (!ok && name === 'DARK') darkFail++;
    const tag = ok ? 'ok' : name === 'LIGHT' ? 'LEGACY' : 'FAIL';
    console.log(`${tag.padEnd(7)}${r.toFixed(2).padStart(6)}  ${String(fg).padEnd(13)} on ${String(bg).padEnd(12)} ${note}`);
  }
}
console.log(`\ndark failures: ${darkFail}`);
process.exit(darkFail ? 1 : 0);
