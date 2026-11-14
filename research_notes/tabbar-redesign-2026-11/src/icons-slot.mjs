// THE ICON SLOT. Every glyph in the round-3 mockups is drawn through these two functions.
// Source of truth: ../icons-v3/icons.json (the icon artist's set; the Profile optical-weight
// tweak is written back there). Override for experiments with ICONS_JSON=/path/to/icons.json.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const J = JSON.parse(readFileSync(process.env.ICONS_JSON ?? resolve(here, '../icons-v3/icons.json'), 'utf8'));
export const SW = J.meta.strokeWidth;
/** 24 x 24 grid glyph at `size` pt (1 unit = 1 pt at 24), centred in its 25 pt box. Tokens: ink, ko. */
export function glyph(name, filled, ink, ko, size = 24) {
  const col = t => t === 'ink' ? ink : t === 'ko' ? ko : 'none';
  const parts = J.glyphs[name][filled ? 'active' : 'inactive'].map(p => `<path d="${p.d}" fill="${col(p.fill)}" stroke="${col(p.stroke)}" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  const off = (25 - size) / 2;
  return `<svg width="${size}" height="${size}" viewBox="${J.meta.viewBox}" style="position:absolute;left:${off}px;top:${off}px">${parts}</svg>`;
}
/** Camera for the Scan disc: one evenodd path, the lens is a real hole (the disc shows through). */
export function cameraGlyph(size, body = '#fff') {
  return `<svg width="${size}" height="${size}" viewBox="${J.meta.viewBox}"><path d="${J.camera.d}" fill="${body}" fill-rule="evenodd"/></svg>`;
}
