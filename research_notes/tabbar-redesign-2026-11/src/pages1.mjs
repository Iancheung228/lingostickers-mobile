import { out, BASE, COL, CRESTS, bar, phone, FR, busy, dark, cream, makeCrest, extent, curvature, curvJump, minRadius, gapProfile } from './gen3.mjs';
import { writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));

// 1. crest candidates at 6x with curvature comb
const cells = Object.entries(CRESTS).map(([k, c]) => {
  const y = makeCrest({ discR: 23, ...c });
  const hi = extent(y); const gs = gapProfile(y, 13, 23).map(a => a[1]);
  let path = 'M-62,40 L-62,0'; for (let x = -62; x <= 62; x += .25) path += ` L${x},${y(x).toFixed(3)}`; path += ' L62,40 Z';
  let comb = ''; for (let x = -60; x <= 60; x += 1.2) { const h = .05, y1 = (y(x + h) - y(x - h)) / (2 * h), kk = curvature(y, x); const n = Math.hypot(y1, 1), nx = y1 / n, ny = -1 / n; const len = Math.min(Math.abs(kk) * 90, 14); if (len < .3) continue; const px = x, py = y(x); comb += `<line x1="${px}" y1="${py}" x2="${px + nx * len}" y2="${py + ny * len}" stroke="${kk > 0 ? '#c1121f' : '#1d6fb8'}" stroke-width=".35"/>`; }
  const note = `jump ${curvJump(y, hi).toFixed(4)} | min radius ${minRadius(y, hi).toFixed(1)} | gap ${Math.min(...gs).toFixed(1)}-${Math.max(...gs).toFixed(1)} | reach ±${hi.toFixed(0)}`;
  return `<div class="cell"><svg width="372" height="260" viewBox="-62 -28 124 70" style="background:${COL.cream};border-radius:8px"><path d="${path}" fill="#E4A0A1"/><circle cx="0" cy="13" r="23" fill="#92454A"/><circle cx="0" cy="13" r="23" fill="none" stroke="rgba(255,236,230,.55)" stroke-width="1.5"/>${comb}<line x1="-62" y1="0" x2="62" y2="0" stroke="#000" stroke-opacity=".2" stroke-width=".2" stroke-dasharray="1 1"/></svg><span class="cap">${CRESTS[k].name}</span><span class="cap" style="color:#bbb">${note}</span></div>`;
}).join('');
out('g-curv', `<!doctype html><meta charset=utf-8><style>${BASE}</style><div class="t">Crest candidates at 6x. Red comb = convex curvature, blue = concave; comb length is proportional to |curvature|. A visible step in the comb is a G2 break.</div><div style="display:grid;grid-template-columns:repeat(3,372px);gap:18px 20px;padding:20px 24px">${cells}</div>`);

// 2. proportions
const crop = (inner) => `<div style="position:relative;width:393px;height:310px;overflow:hidden;background:${COL.cream};border-radius:14px"><div style="position:absolute;left:0;top:-542px;width:393px;height:852px">${inner}</div></div>`;
const scene = (o) => { const f = FR.scrolled; return `<div style="position:absolute;inset:0;background:${COL.cream}"></div><div style="position:absolute;left:0;top:0;width:393px;height:742px;background:url(../img/${f.img}.png) top left/393px auto"></div>${f.extra}<div style="position:absolute;left:20px;top:0;width:1px;height:852px;background:rgba(0,120,255,.55)"></div><div style="position:absolute;left:373px;top:0;width:1px;height:852px;background:rgba(0,120,255,.55)"></div>${bar({ active: 'boards', badge: '9+', crest: 'G', ...o })}<div style="position:absolute;left:129.5px;bottom:8px;width:134px;height:5px;border-radius:3px;background:#1a1313"></div>`; };
const PV = [
  ['margin 24 (width 345), bottom 26, H 64 (v2)', { margin: 24, W: 345, bottom: 26, H: 64 }],
  ['margin 20 (width 353): pill edges line up with the cards', { margin: 20, W: 353, bottom: 26, H: 64 }],
  ['margin 20, bottom 22, H 62', { margin: 20, W: 353, bottom: 22, H: 62 }],
  ['margin 20, bottom 30, H 64', { margin: 20, W: 353, bottom: 30, H: 64 }],
  ['margin 16 (width 361), bottom 26, H 64', { margin: 16, W: 361, bottom: 26, H: 64 }],
  ['margin 20, bottom 26, H 66', { margin: 20, W: 353, bottom: 26, H: 66 }],
];
out('g-prop', `<!doctype html><meta charset=utf-8><style>${BASE}</style><div class="t">Proportions. Blue lines = the screen's 20 pt content edges.</div><div style="display:grid;grid-template-columns:repeat(3,393px);gap:18px 20px;padding:20px 24px">${PV.map(([n, o]) => `<div class="cell">${crop(scene(o))}<span class="cap">${n}</span></div>`).join('')}</div>`);

// 3. surface
const BG = { cream: cream(), busy: busy(), dark: dark() };
const sh = ['S1', 'S2', 'S3', 'S4'];
let sf = '';
for (const [bn, b] of Object.entries(BG)) for (const s of sh) sf += `<div class="cell"><div class="strip" style="height:128px">${b}${bar({ active: 'calendar', shadow: s, crest: 'G', bottom: 20, badge: '1', margin: 20, W: 353 })}</div><span class="cap">${bn} / ${s}</span></div>`;
const surf2 = [['g1 rim .5 (v2)', { grad: 'g1', rimTop: .5 }], ['g2 stronger top light', { grad: 'g2', rimTop: .5 }], ['g3 flatter', { grad: 'g3', rimTop: .8 }], ['g1 rim .9 / 1.5pt', { grad: 'g1', rimTop: .9, rimW: 1.5 }]];
out('g-surface', `<!doctype html><meta charset=utf-8><style>${BASE}</style><div class="t">Shadow over cream / busy photo grid / dark camera frame (rows), four shadows (columns)</div><div style="display:grid;grid-template-columns:repeat(4,393px);gap:14px 18px;padding:20px 24px">${sf}</div>
<div class="t">Gradient and rim light on cream</div><div style="display:grid;grid-template-columns:repeat(4,393px);gap:14px 18px;padding:20px 24px">${surf2.map(([n, o]) => `<div class="cell"><div class="strip" style="height:128px">${cream()}${bar({ active: 'calendar', crest: 'G', bottom: 20, badge: '1', margin: 20, W: 353, ...o })}</div><span class="cap">${n}</span></div>`).join('')}</div>`);

// 4. disc 6x
const dcell = (o, cap) => `<div class="cell"><div style="position:relative;width:150px;height:92px;overflow:hidden;background:${COL.cream};zoom:2">${bar({ active: 'calendar', crest: 'G', bottom: 14, margin: 75 - 176.5, W: 353, ...o })}</div><span class="cap">${cap}</span></div>`;
let dc = '';
for (const d of ['A', 'B', 'C']) for (const s of ['idle', 'active', 'pressed']) dc += dcell({ disc: d, discState: s }, `disc ${d} / ${s}`);
for (const g of [24, 26, 28]) dc += dcell({ disc: 'B', glyph: g }, `disc B, camera ${g} pt`);
out('g-disc', `<!doctype html><meta charset=utf-8><style>${BASE}</style><div class="t">Centre piece at 6x</div><div style="display:grid;grid-template-columns:repeat(3,300px);gap:16px 18px;padding:20px 24px">${dc}</div>`);

// 5. indicators
let ic = '';
for (const v of ['bar', 'pill', 'dot', 'cap', 'glow']) for (const a of ['calendar', 'boards']) ic += `<div class="cell"><div class="strip" style="height:112px">${cream()}${bar({ active: a, indicator: v, crest: 'G', bottom: 14, margin: 20, W: 353 })}</div><span class="cap">indicator ${v} / ${a}</span></div>`;
out('g-ind', `<!doctype html><meta charset=utf-8><style>${BASE}</style><div class="t">Active indicators on the crest bar</div><div style="display:grid;grid-template-columns:repeat(2,393px);gap:14px 18px;padding:20px 24px">${ic}</div>`);
