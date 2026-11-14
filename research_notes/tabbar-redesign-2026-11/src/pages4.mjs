import { out, BASE, COL, bar, FR, cream, busy, dark, crestFor, fadeLayer, phone, CREST_K, makeCrest, extent, curvature, curvJump, minRadius, gapProfile, PILL } from './gen3.mjs';

const strip = (inner, cap, h = 124, bg = cream()) => `<div class="cell"><div class="strip" style="height:${h}px">${bg}${inner}</div><span class="cap">${cap}</span></div>`;
const grid = (cells, cols = 3, w = 393) => `<div style="display:grid;grid-template-columns:repeat(${cols},${w}px);gap:14px 20px;padding:16px 24px">${cells}</div>`;
const T = (t) => `<div class="t">${t}</div>`;
const page = (n, body) => out(n, `<!doctype html><meta charset=utf-8><style>${BASE}</style>${body}`);

// 1. geometry: old H vs new K (+ variants), 6x with curvature comb
const GC = { 'H (v3.0)': { type: 'hermite', rise: 15.5, gap: 5.5, th0: 33, half: 44, cy: 13, r: 23 },
  'K ±48 swell (chosen)': { ...CREST_K, rise: 16.5, cy: 11, r: 22 }, 'K2 half 46': { type: 'hermite', gap: 5.5, th0: 28, half: 46, rise: 16.5, cy: 11, r: 22 } };
let gc = '';
for (const [k, c] of Object.entries(GC)) {
  const y = makeCrest({ discR: c.r, ...c }); const hi = extent(y); const gs = gapProfile(y, c.cy, c.r).map(a => a[1]);
  let path = 'M-70,40 L-70,0'; for (let x = -70; x <= 70; x += .25) path += ` L${x},${y(x).toFixed(3)}`; path += ' L70,40 Z';
  let comb = ''; for (let x = -68; x <= 68; x += 1.2) { const h = .05, y1 = (y(x + h) - y(x - h)) / (2 * h), kk = curvature(y, x); const n = Math.hypot(y1, 1); const len = Math.min(Math.abs(kk) * 90, 14); if (len < .3) continue; comb += `<line x1="${x}" y1="${y(x)}" x2="${x + y1 / n * len}" y2="${y(x) - 1 / n * len}" stroke="${kk > 0 ? '#c1121f' : '#1d6fb8'}" stroke-width=".35"/>`; }
  gc += `<div class="cell"><svg width="420" height="215" viewBox="-70 -26 140 72" style="background:${COL.cream};border-radius:8px"><path d="${path}" fill="${PILL}"/><circle cx="0" cy="${c.cy}" r="${c.r}" fill="#9D4D51"/>${comb}</svg><span class="cap">${k}</span><span class="cap" style="color:#bbb">curvature step ${curvJump(y, hi).toFixed(4)} | min radius ${minRadius(y, hi).toFixed(1)} | gap ${Math.min(...gs).toFixed(1)}-${Math.max(...gs).toFixed(1)} | reach ±${hi.toFixed(0)}</span></div>`;
}
page('g-curv', T('Crest: v3.0 (H) against the widened swell (K). Red = convex, blue = concave comb.') + grid(gc, 3, 420));

// 2. spacing: pitch 64 vs 66 at 1x / 1.15x / 1.3x
let sp = '';
for (const [pitch, pn] of [[64, 'pitch 64 (v3b)'], [66, 'pitch 66 (chosen)']]) for (const dt of [1, 1.15, 1.3]) sp += strip(bar({ pitch, active: 'collection', badge: '9+', dt, bottom: 16 }), `${pn}, Dynamic Type ${dt}x`, 112);
page('g-space', T('Label gaps: pitch 64 against 66, with a 9+ badge') + grid(sp, 3));

// 3. surface: edge x shadow on cream
let su = '';
for (const e of ['E0', 'E1', 'E2']) for (const s of ['SH1', 'SH2', 'SH3']) su += strip(bar({ active: 'calendar', edge: e, shadow: s, badge: '1', bottom: 18 }), `edge ${e} / shadow ${s}`, 118);
page('g-surface', T('Flat pill: edge treatment (E0 none, E1 1pt outer stroke, E2 stroke + top hairline) x shadow (SH1 single soft, SH2 stacked, SH3 stronger), on cream') + grid(su, 3));
// 3b. chosen edge over busy and dark
let sb = '';
for (const [bn, b] of [['busy photo grid', busy()], ['dark camera frame', dark()]]) for (const s of ['SH1', 'SH3']) sb += strip(bar({ active: 'boards', edge: 'E1', shadow: s, badge: '1', bottom: 18 }), `${bn} / E1 + ${s}`, 118, b);
page('g-surface2', T('Chosen edge over busy photos and the dark camera frame') + grid(sb, 2));

// 4. disc
const dcell = (o, cap) => `<div class="cell"><div style="position:relative;width:150px;height:92px;overflow:hidden;background:${COL.cream};zoom:2">${bar({ bottom: 14, margin: 75 - 176.5, active: 'calendar', ...o })}</div><span class="cap">${cap}</span></div>`;
let dc = '';
for (const [s, o] of [['idle', {}], ['active, ring + glow', { discState: 'active', active: 'scan' }], ['active, ring only', { discState: 'active', active: 'scan', discActive: 'ring' }], ['pressed', { discState: 'pressed' }]]) dc += dcell(o, 'flat disc / ' + s);
page('g-disc', T('Flat centre piece at 6x: idle, active (two treatments), pressed') + grid(dc, 2, 300));
// Scan screen: idle and three active treatments
const scanPh = (o, cap) => `<figure class="ph"><div class="scr" style="height:560px"><div style="position:absolute;inset:0;background:${COL.cream}"></div><div style="position:absolute;left:0;top:-292px;width:393px;height:852px"><div style="position:absolute;left:0;top:0;width:393px;height:718px;background:url(../img/13-scan-camera.png) top left/393px auto"></div>${bar({ ...o })}</div></div><figcaption>${cap}</figcaption></figure>`;
page('g-scanscr', T('Scan screen: the shutter is the page action, the disc is the tab') + `<div class="row">${scanPh({ active: 'calendar' }, 'idle')}${scanPh({ active: 'scan', discState: 'active', discActive: 'ring' }, 'A ring + darker (v3b)')}${scanPh({ active: 'scan', discState: 'active', discActive: 'muted' }, 'B muted + 2 pt ring')}${scanPh({ active: 'scan', discState: 'active', discActive: 'inverted' }, 'C inverted: cream disc, terra glyph')}</div>`);
// disc over busy: stroke or not
let bs = '';
for (const [r, n] of [[false, 'idle disc, no light stroke'], [true, 'idle disc, 1.5 pt light stroke']]) for (const [bn, b] of [['busy photo grid', busy()], ['cream', cream()]]) bs += strip(bar({ active: 'boards', idleRing: r, bottom: 18 }), `${n} / ${bn}`, 118, b);
page('g-discbusy', T('Disc over busy photos: light stroke or not') + grid(bs, 2));

// 5. active state: no indicator vs dot vs bar (8pt clearance)
let ac = '';
for (const [ind, n] of [['none', '(a) filled glyph + label only'], ['dot', '(b) + dot, 8 pt above the pill bottom'], ['bar', '(c) + 16x3 bar, 8 pt above the bottom']]) for (const a of ['calendar', 'boards']) ac += strip(bar({ active: a, indicator: ind, bottom: 16 }), `${n} / ${a}`, 118);
page('g-ind', T('Active state: three codings') + grid(ac, 2));

// 6. fade
const scene = (fade) => { const f = FR.scrolled; return `<div style="position:relative;width:393px;height:310px;overflow:hidden;background:${COL.cream};border-radius:14px"><div style="position:absolute;left:0;top:-542px;width:393px;height:852px"><div style="position:absolute;inset:0;background:${COL.cream}"></div><div style="position:absolute;left:0;top:0;width:393px;height:718px;background:url(../img/${f.img}.png) top left/393px auto"></div>${f.extra}${fade ? fadeLayer() : ''}${bar({ active: 'boards', badge: '9+' })}<div style="position:absolute;left:129.5px;bottom:8px;width:134px;height:5px;border-radius:3px;background:#1a1313"></div></div></div>`; };
page('g-fade', T('Content behind the bar: nothing vs a 28 pt cream fade that stays solid below the pill') + grid(`<div class="cell">${scene(false)}<span class="cap">no fade</span></div><div class="cell">${scene(true)}<span class="cap">cream fade 28 pt, 92% under the bar</span></div>`, 2));

// 7. badge
let bd = '';
for (const [b, a] of [['1', 'calendar'], ['3', 'collection'], ['9+', 'collection'], ['1', 'collection']]) bd += strip(bar({ active: a, badge: b, bottom: 16 }), `badge ${b}, ${a} active`, 112);
page('g-badge', T('Badge: cream, left-anchored, grows right') + grid(bd, 2));

// 8. proportions (flat engine)
const crop = (inner) => `<div style="position:relative;width:393px;height:300px;overflow:hidden;background:${COL.cream};border-radius:14px"><div style="position:absolute;left:0;top:-552px;width:393px;height:852px">${inner}</div></div>`;
const pscene = (o) => { const f = FR.scrolled; return `<div style="position:absolute;inset:0;background:${COL.cream}"></div><div style="position:absolute;left:0;top:0;width:393px;height:718px;background:url(../img/${f.img}.png) top left/393px auto"></div>${f.extra}${fadeLayer()}<div style="position:absolute;left:20px;top:0;width:1px;height:852px;background:rgba(0,120,255,.55)"></div><div style="position:absolute;left:373px;top:0;width:1px;height:852px;background:rgba(0,120,255,.55)"></div>${bar({ active: 'boards', badge: '9+', ...o })}<div style="position:absolute;left:129.5px;bottom:8px;width:134px;height:5px;border-radius:3px;background:#1a1313"></div>`; };
const PV = [['margin 24 (width 345)', { margin: 24, W: 345 }], ['margin 20 (353): ends line up with the cards (chosen)', {}], ['margin 20, bottom 22, height 62', { bottom: 22, layout: { H: 62, it: 10.5, lt: 39 } }], ['margin 20, bottom 30', { bottom: 30 }], ['margin 16 (361)', { margin: 16, W: 361 }], ['margin 20, height 68', { layout: { H: 68, it: 12.5, lt: 42, cy: 12 } }]];
page('g-prop', T('Proportions. Blue lines = the 20 pt content edges.') + grid(PV.map(([n, o]) => `<div class="cell">${crop(pscene(o))}<span class="cap">${n}</span></div>`).join(''), 3));
