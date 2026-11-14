// Round 3: polish of the R3 Crest. node gen3.mjs -> src/g-*.html (rendered by shoot3.sh)
import { writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeCrest, pillPath, extent, curvature, curvJump, minRadius, gapProfile } from './geom.mjs';
import { glyph, cameraGlyph } from './icons-slot.mjs';
const here = dirname(fileURLToPath(import.meta.url));
export const out = (n, s) => writeFileSync(`${here}/${n}.html`, s);

export const COL = { cream: '#FAF4EA', inkOff: '#5A2429', inkOn: '#3A1519', maroon: '#662B31', knock: '#E4A0A1' };
export const CRESTS = {
  A: { type: 'cubic', rise: 14, half: 46, name: 'A  v2 cubic (G1)' },
  B: { type: 'quintic', rise: 14, half: 46, name: 'B  quintic swell (G2, not concentric)' },
  E: { type: 'hermite', rise: 16, gap: 6, th0: 35, half: 44, name: 'E  concentric, gap 6, shoulder 44' },
  G: { type: 'hermite', rise: 15, gap: 5, th0: 30, half: 42, name: 'G  concentric, gap 5, shoulder 42' },
  H: { type: 'hermite', rise: 15.5, gap: 5.5, th0: 33, half: 44, name: 'H  concentric, gap 5.5, shoulder 44' },
};

// ---- shared CSS ----
export const BASE = `
@font-face{font-family:Newsreader;font-weight:500;src:url(../fonts/Newsreader_500Medium.ttf)}
@font-face{font-family:'JetBrains Mono';font-weight:700;src:url(../fonts/JetBrainsMono_700Bold.ttf)}
*{box-sizing:border-box;margin:0}
body{background:#2b2224;font-family:Newsreader;color:#ddd}
.t{font:500 22px Newsreader;color:#e8d9d9;padding:20px 24px 0}
.cap{font:500 13px Newsreader;color:#e8d9d9}
.cell{display:flex;flex-direction:column;gap:6px}
.scr{position:relative;width:393px;height:852px;overflow:hidden;border-radius:44px;background:${COL.cream};box-shadow:0 0 0 8px #111,0 20px 50px rgba(0,0,0,.5)}
.ph{display:flex;flex-direction:column;align-items:center;gap:10px}.ph figcaption{font:500 15px Newsreader;color:#e8d9d9}
.row{display:flex;gap:26px;padding:24px 28px;width:max-content}
.strip{position:relative;width:393px;overflow:hidden;background:${COL.cream}}
.lb{position:absolute;text-align:center;font:500 11px/13px Newsreader;letter-spacing:.1px;color:${COL.inkOff};white-space:nowrap}
.on .lb,.lb.on{color:${COL.inkOn}}
.ic{position:absolute;width:25px;height:25px}
.badge{position:absolute;min-width:16px;height:16px;border-radius:8px;background:#FBF3EA;color:#3A1519;font:700 10.5px/16px 'JetBrains Mono';text-align:center;padding:0 4px;box-shadow:0 0 0 2px #E4A0A1;z-index:3}
`;

// ---- surfaces / discs / indicators (round 3b: flat, matches the app) ----
export const PILL = '#E4A0A1';            // = theme blush / skyDeep (the header band)
export const SHADOWS = {
  SH1: 'drop-shadow(0 6px 14px rgba(138,58,68,.20))',
  SH2: 'drop-shadow(0 8px 10px rgba(102,43,49,.13)) drop-shadow(0 2px 3px rgba(102,43,49,.15))',
  SH3: 'drop-shadow(0 6px 12px rgba(138,58,68,.22)) drop-shadow(0 1px 2px rgba(138,58,68,.20))',
};
export const CREST_K = { type: 'hermite', gap: 5.5, th0: 26, half: 50 };
export const crestFor = (D, cy, gap = 5.5) => ({ ...CREST_K, gap, rise: D / 2 + gap - cy });

/** Render the whole bar. */
export function bar(o) {
  const O = { W: 353, margin: 20, bottom: 26, pitch: 66, label: 'all', indicator: 'none', edge: 'E1', shadow: 'SH1', discActive: 'inverted', discState: 'idle',
    active: 'calendar', badge: '', dt: 1, glyph: 25, fillPill: PILL, ...o };
  // layout presets
  let L = { H: 64, it: 11.5, lt: 40, D: 44, cy: 11, dotTop: 54 };
  if (O.indicator === 'dot' || O.indicator === 'bar') L = { H: 66, it: 10.5, lt: 38, D: 44, cy: 10.5, dotTop: 54 };
  if (O.label === 'none') L = { H: 56, it: 16, lt: 0, D: 44, cy: 10, dotTop: 0 };
  if (O.label === 'active') L = { H: 58, it: 18.5, itOn: 8, lt: 36, D: 44, cy: 10, dotTop: 0 };
  L = { ...L, ...(O.layout || {}) };
  const { H } = L, W = O.W, c = W / 2;
  const cp = O.crest ?? crestFor(L.D, L.cy);
  const y = makeCrest({ discR: L.D / 2, ...cp });
  const rise = Math.ceil(-y(0)) + 3;
  const d = pillPath(W, H, H / 2, y);
  const slots = ['collection', 'calendar', 'scan', 'boards', 'profile'], names = ['Collection', 'Calendar', 'Scan', 'Boards', 'Profile'];
  let html = `<div style="position:absolute;left:${O.margin}px;bottom:${O.bottom}px;width:${W}px;height:${H}px;--dt:${O.dt}">`;
  const edge = O.edge === 'E1' || O.edge === 'E2' ? `<path d="${d}" fill="none" stroke="#D58A8E" stroke-width="2" stroke-linejoin="round"/>` : '';
  const hair = O.edge === 'E2' ? `<defs><linearGradient id="hl" gradientUnits="userSpaceOnUse" x1="0" y1="${-rise}" x2="0" y2="${H}"><stop offset="0" stop-color="#F6CFCF" stop-opacity=".9"/><stop offset="${(rise + 8) / (rise + H)}" stop-color="#F6CFCF" stop-opacity="0"/></linearGradient></defs><path d="${d}" fill="none" stroke="url(#hl)" stroke-width="1"/>` : '';
  html += `<svg style="position:absolute;left:0;top:${-rise}px;overflow:visible;filter:${SHADOWS[O.shadow]}" width="${W}" height="${H + rise}" viewBox="0 ${-rise} ${W} ${H + rise}">${edge}<path d="${d}" fill="${O.fillPill}"/>${hair}</svg>`;
  slots.forEach((k, i) => {
    const on = O.active === k, cx = c + (i - 2) * O.pitch, isScan = k === 'scan';
    const itop = O.label === 'active' ? (on ? L.itOn : L.it) : L.it;
    if (!isScan) {
      html += `<div class="ic" style="left:${cx - 12.5}px;top:${itop - 0.5}px">${glyph(k, on, on ? COL.inkOn : COL.inkOff, PILL)}</div>`;
      if (k === 'collection' && O.badge) html += `<div class="badge" style="left:${cx + 12}px;top:${itop - 7}px">${O.badge}</div>`;
    }
    const showLabel = O.label === 'all' || (O.label === 'sides' && !isScan) || (O.label === 'active' && on);
    if (showLabel) html += `<div class="lb ${on ? 'on' : ''}" style="left:${cx - 40}px;width:80px;top:${L.lt}px;font-size:${11 * O.dt}px">${names[i]}</div>`;
    if (on && !isScan && O.indicator === 'dot') html += `<div style="position:absolute;left:${cx - 2}px;top:${L.dotTop}px;width:4px;height:4px;border-radius:2px;background:${COL.inkOn}"></div>`;
    if (on && !isScan && O.indicator === 'bar') html += `<div style="position:absolute;left:${cx - 8}px;top:${L.dotTop + 1}px;width:16px;height:3px;border-radius:2px;background:${COL.inkOn}"></div>`;
  });
  // disc (flat)
  const D = L.D, st = O.discState;
  let fill = st === 'pressed' ? '#8D4549' : st === 'active' ? '#833F46' : '#9D4D51';
  let inner = st === 'active' ? '#6B3038' : st === 'pressed' ? '#7A383E' : '#833F46';
  let glyphCol = '#fff';
  let ring = '';
  const idleRing = O.idleRing !== false ? ',0 0 0 1.5px rgba(251,243,234,.6)' : '';
  if (st === 'active') {
    if (O.discActive === 'ring') ring = ',0 0 0 3px #FBF3EA';
    if (O.discActive === 'muted') { fill = '#8A5058'; inner = '#6E3F46'; ring = ',0 0 0 2px #FBF3EA'; }
    if (O.discActive === 'inverted') { fill = '#FBF3EA'; inner = '#9D4D51'; glyphCol = '#9D4D51'; ring = ''; }
  }
  const drop = st === 'pressed' ? '0 1px 3px rgba(102,43,49,.25)' : '0 3px 8px rgba(102,43,49,.25)';
  const innerW = st === 'active' && O.discActive === 'inverted' ? 2 : 1;
  html += `<div style="position:absolute;left:${c - D / 2}px;top:${L.cy - D / 2}px;width:${D}px;height:${D}px;border-radius:50%;background:${fill};box-shadow:inset 0 0 0 ${innerW}px ${inner},${drop}${ring}${st === 'active' ? '' : idleRing};display:flex;align-items:center;justify-content:center;transform:scale(${st === 'pressed' ? .94 : 1})">${cameraGlyph(O.glyph, glyphCol)}</div>`;
  html += '</div>';
  return html;
}
export const fadeLayer = (o = {}) => { const bottom = o.bottom ?? 26, H = o.H ?? 64; const h = bottom + H + 14; return `<div style="position:absolute;left:0;right:0;bottom:0;height:${h + 28}px;background:linear-gradient(to bottom,rgba(250,244,234,0) 0,rgba(250,244,234,.92) 28px,rgba(250,244,234,.92) 100%)"></div>`; };

// ---- backdrops ----
export const bcard = (x, y) => `<div style="position:absolute;left:${x}px;top:${y}px;width:171px;height:201px;background:url(../img/15-boards-grid.png) -19.6px -146.5px/393px auto"></div>`;
export const FR = {
  home: { img: '01-home-rest', extra: '', badge: '1', active: 'collection', cap: 'Collection active, due badge 1' },
  calendar: { img: '11-calendar', extra: '', badge: '1', active: 'calendar', cap: 'Calendar active' },
  scan: { img: '13-scan-camera', extra: '', badge: '1', active: 'scan', cap: 'Scan screen, Scan active' },
  scrolled: { img: '15-boards-grid', extra: bcard(19.6, 360) + bcard(202, 360) + bcard(19.6, 575) + bcard(202, 575) + bcard(19.6, 790) + bcard(202, 790), badge: '9+', active: 'boards', cap: 'Boards active, content behind, 9+' },
};
export const phone = (key, o = {}, fade = true) => {
  const f = FR[key];
  return `<figure class="ph"><div class="scr"><div style="position:absolute;inset:0;background:${COL.cream}"></div>
  <div style="position:absolute;left:0;top:0;width:393px;height:718px;background:url(../img/${f.img}.png) top left/393px auto"></div>${f.extra}${fade ? fadeLayer() : ''}${bar({ active: f.active, badge: f.badge, discState: f.active === 'scan' ? 'active' : 'idle', ...o })}
  <div style="position:absolute;left:129.5px;bottom:8px;width:134px;height:5px;border-radius:3px;background:#1a1313"></div></div><figcaption>${f.cap}</figcaption></figure>`;
};
export const busy = (h) => `<div style="position:absolute;inset:0;background:
 linear-gradient(115deg,#3E8F9A 0 18%,transparent 18%),linear-gradient(60deg,#E0A04B 0 34%,transparent 34%),linear-gradient(135deg,#6BA05A 0 55%,transparent 55%),
 linear-gradient(80deg,#C2503F 0 70%,transparent 70%),repeating-linear-gradient(90deg,#44649A 0 46px,#D8C14C 46px 92px,#9A4468 92px 138px,#4D9A7A 138px 184px)"></div>
 <div style="position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.18) 0 2px,transparent 2px 30px)"></div>`;
export const dark = (h) => `<div style="position:absolute;inset:0;background:linear-gradient(90deg,transparent 33%,rgba(255,255,255,.09) 33% calc(33% + 1px),transparent calc(33% + 1px) 66%,rgba(255,255,255,.09) 66% calc(66% + 1px),transparent calc(66% + 1px)),#000"></div><div style="position:absolute;left:30px;right:30px;top:6px;height:2px;background:rgba(255,255,255,.12)"></div>`;
export const cream = () => `<div style="position:absolute;inset:0;background:${COL.cream}"></div>`;

export { makeCrest, pillPath, extent, curvature, curvJump, minRadius, gapProfile, glyph, cameraGlyph };
