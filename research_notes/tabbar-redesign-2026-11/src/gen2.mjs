// Round 2: refinements of the CURRENT rose pill. node gen2.mjs -> v2-{1,2,3}.html, v2d-{1,2,3}.html, v2z-{1,2,3}.html
import { writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICONS, CAM_BODY } from './gen.mjs';
const here = dirname(fileURLToPath(import.meta.url));

const C = {
  cream: '#FAF4EA', blush: '#E4A0A1', terra: '#9D4D51', terraDark: '#833F46', maroon: '#662B31',
  inkOff: '#5A2429', inkOn: '#3A1519',
};
const SW = 1.75;
const icon = (name, filled, color, ko, size = 25) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round" style="color:${color}">${filled ? ICONS[name].fill(ko) : ICONS[name].out()}</svg>`;
const camera = (size, body, lens, sw = 1.8) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="${sw}"><path d="${CAM_BODY}" fill="${body}" stroke="${body}"/><circle cx="12" cy="13.2" r="3.4" stroke="${lens}" fill="none"/></svg>`;

const SLOTS = [['collection', 'Collection'], ['calendar', 'Calendar'], ['scan', 'Scan'], ['boards', 'Boards'], ['profile', 'Profile']];
const W = 345;

const PILL_BG = `linear-gradient(180deg,#E9ABAC 0%,#E4A0A1 45%,#E09A9B 100%)`;
const PILL_SHADOW = `0 6px 14px rgba(102,43,49,.17),0 1px 2px rgba(102,43,49,.14)`;
const RIM = `inset 0 1px 0 rgba(255,255,255,.42),inset 0 -1px 0 rgba(102,43,49,.09)`;

const BASE_CSS = `
.wrap{position:absolute;left:24px;width:${W}px}
.pill{position:absolute;left:0;right:0;bottom:0;display:flex}
.it{flex:1;display:flex;flex-direction:column;align-items:center;position:relative}
.ic{width:25px;height:25px;display:flex;align-items:center;justify-content:center;position:relative}
.lb{font:500 calc(11px*var(--dt)) /13px Newsreader;letter-spacing:.1px;color:${C.inkOff};white-space:nowrap}
.it.on .lb{color:${C.inkOn}}
.badge{position:absolute;left:calc(50% + 6px);top:-5px;min-width:17px;height:17px;border-radius:9px;background:${C.maroon};color:${C.cream};font:700 10.5px/17px 'JetBrains Mono';text-align:center;padding:0 4px;box-shadow:0 0 0 2px #E7A5A6}
`;

const badgeHtml = (b) => b ? `<span class="badge">${b}</span>` : '';

const DIRS = {
  1: {
    name: 'R1 · Same bar, done right',
    H: 64, bottom: 26,
    css: `
    .pill{height:64px;border-radius:32px;background:${PILL_BG};box-shadow:${PILL_SHADOW},${RIM}}
    .it{padding-top:11px}.lb{margin-top:3px}
    .cap{position:absolute;top:-3px;left:50%;margin-left:-26px;width:52px;height:31px;border-radius:16px;background:rgba(250,244,234,.62);box-shadow:inset 0 0 0 1px rgba(255,255,255,.45)}
    .ic svg{position:relative;z-index:1}
    .disc{position:absolute;left:50%;margin-left:-22px;top:-10px;width:44px;height:44px;border-radius:50%;background:linear-gradient(180deg,#A5565A,#94474C);
      box-shadow:0 0 0 3px ${C.cream},0 6px 12px rgba(102,43,49,.30),inset 0 1px 0 rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center}
    .disc.on{background:linear-gradient(180deg,#93454A,#7E3A40)}
    .disc.on{box-shadow:0 0 0 3px ${C.cream},0 0 0 4.5px #9D4D51,0 6px 12px rgba(102,43,49,.30)}
    `,
    bar(active, badge) {
      const it = ([k, l]) => {
        const on = active === k;
        if (k === 'scan') return `<div class="it ${on ? 'on' : ''}"><div class="ic"></div><div class="lb">${l}</div><div class="disc ${on ? 'on' : ''}">${camera(24, '#fff', on ? '#7E3A40' : '#94474C')}</div></div>`;
        return `<div class="it ${on ? 'on' : ''}"><div class="ic">${on ? '<div class="cap"></div>' : ''}${icon(k, on, on ? C.inkOn : C.inkOff, '#F4D3CC')}${k === 'collection' ? badgeHtml(badge) : ''}</div><div class="lb">${l}</div></div>`;
      };
      return SLOTS.map(it).join('');
    },
  },
  2: {
    name: 'R2 · Ringless disc, tinted capsule',
    H: 66, bottom: 24,
    css: `
    .pill{height:66px;border-radius:33px;background:${PILL_BG};box-shadow:${PILL_SHADOW},${RIM};padding:0 5px}
    .it{padding-top:11px}.lb{margin-top:4px}
    .slotcap{position:absolute;top:5px;bottom:5px;left:2px;right:2px;border-radius:28px;background:rgba(250,244,234,.50);box-shadow:inset 0 1px 0 rgba(255,255,255,.55),0 1px 2px rgba(102,43,49,.10)}
    .ic,.lb{z-index:1}
    .disc{position:absolute;left:50%;margin-left:-23px;top:-11px;width:46px;height:46px;border-radius:50%;background:linear-gradient(180deg,#A85A5E,#92454A);
      box-shadow:0 0 0 2px rgba(250,244,234,.55),0 8px 14px rgba(157,77,81,.45),0 1px 2px rgba(102,43,49,.3),inset 0 1px 0 rgba(255,255,255,.28);display:flex;align-items:center;justify-content:center}
    .disc.on{background:linear-gradient(180deg,#94474C,#7B383E)}
    .disc.on{box-shadow:0 0 0 2px rgba(250,244,234,.9),0 0 0 3.5px rgba(157,77,81,.7),0 8px 14px rgba(157,77,81,.45)}
    `,
    bar(active, badge) {
      const it = ([k, l]) => {
        const on = active === k;
        if (k === 'scan') return `<div class="it ${on ? 'on' : ''}"><div class="ic"></div><div class="lb">${l}</div><div class="disc ${on ? 'on' : ''}">${camera(24, '#fff', on ? '#7B383E' : '#92454A')}</div></div>`;
        return `<div class="it ${on ? 'on' : ''}">${on ? '<div class="slotcap"></div>' : ''}<div class="ic">${icon(k, on, on ? C.inkOn : C.inkOff, '#EFC9C3')}${k === 'collection' ? badgeHtml(badge) : ''}</div><div class="lb">${l}</div></div>`;
      };
      return SLOTS.map(it).join('');
    },
  },
  3: {
    name: 'R3 · Crest, one silhouette',
    H: 64, bottom: 26,
    css: `
    .pill{height:64px;background:none}
    .shape{position:absolute;left:0;top:-14px;width:${W}px;height:78px;filter:drop-shadow(0 6px 6px rgba(102,43,49,.16)) drop-shadow(0 1px 1px rgba(102,43,49,.14))}
    .it{padding-top:11px}.lb{margin-top:3px}
    .it.on:not(.scan)::after{content:"";position:absolute;bottom:4px;width:16px;height:3px;border-radius:2px;background:${C.inkOn}}
    .it,.ic,.lb{z-index:1}
    .disc{position:absolute;left:50%;margin-left:-23px;top:-10px;width:46px;height:46px;border-radius:50%;background:linear-gradient(180deg,#A85A5E,#92454A);
      box-shadow:0 4px 8px rgba(102,43,49,.30),inset 0 1px 0 rgba(255,255,255,.28),0 0 0 1.5px rgba(255,236,230,.55);display:flex;align-items:center;justify-content:center;z-index:2}
        .disc.on{background:linear-gradient(180deg,#94474C,#7B383E);box-shadow:0 4px 8px rgba(102,43,49,.30),inset 0 1px 0 rgba(255,255,255,.2),0 0 0 3px rgba(250,244,234,.85)}
    `,
    bar(active, badge) {
      const c = W / 2, r = 32, H = 64;
      const d = `M${r},0 H${c - 46} C${c - 34},0 ${c - 24},-14 ${c},-14 C${c + 24},-14 ${c + 34},0 ${c + 46},0 H${W - r} A${r},${r} 0 0 1 ${W - r},${H} H${r} A${r},${r} 0 0 1 ${r},0 Z`;
      const shape = `<svg class="shape" viewBox="0 -14 ${W} 78" width="${W}" height="78"><defs><linearGradient id="g3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EBAEAF"/><stop offset=".5" stop-color="#E4A0A1"/><stop offset="1" stop-color="#E09A9B"/></linearGradient><linearGradient id="r3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#662B31" stop-opacity=".10"/></linearGradient></defs><path d="${d}" fill="url(#g3)"/><path d="${d}" fill="none" stroke="url(#r3)" stroke-width="1.2"/></svg>`;
      const it = ([k, l]) => {
        const on = active === k;
        if (k === 'scan') return `<div class="it scan ${on ? 'on' : ''}"><div class="ic"></div><div class="lb">${l}</div><div class="disc ${on ? 'on' : ''}">${camera(24, '#fff', on ? '#7B383E' : '#92454A')}</div></div>`;
        return `<div class="it ${on ? 'on' : ''}"><div class="ic">${icon(k, on, on ? C.inkOn : C.inkOff, '#EAB2B1')}${k === 'collection' ? badgeHtml(badge) : ''}</div><div class="lb">${l}</div></div>`;
      };
      return shape + SLOTS.map(it).join('');
    },
  },
};
// scan-active on R3 has no dot under Scan (the disc itself darkens + ring)
const barHtml = (d, active, badge, dt) => `<div class="wrap" style="--dt:${dt};bottom:${DIRS[d].bottom}px;height:${DIRS[d].H}px"><div class="pill">${DIRS[d].bar(active, badge)}</div></div>`;

const CUT = 742;
const bcard = (x, y) => `<div style="position:absolute;left:${x}px;top:${y}px;width:171px;height:201px;background:url(../img/15-boards-grid.png) -19.6px -146.5px/393px auto"></div>`;
const FR = {
  home: { img: '01-home-rest', extra: '', badge: '1', active: 'collection', cap: 'Collection active, due badge 1' },
  calendar: { img: '11-calendar', extra: '', badge: '1', active: 'calendar', cap: 'Calendar active' },
  scan: { img: '13-scan-camera', extra: '', badge: '1', active: 'scan', cap: 'Scan screen, Scan active' },
  scrolled: { img: '15-boards-grid', extra: bcard(19.6, 360) + bcard(202, 360) + bcard(19.6, 575) + bcard(202, 575) + bcard(19.6, 790) + bcard(202, 790), badge: '9+', active: 'boards', cap: 'Boards active, content behind, 9+' },
};
const BASE = `
@font-face{font-family:Newsreader;font-weight:500;src:url(../fonts/Newsreader_500Medium.ttf)}
@font-face{font-family:'JetBrains Mono';font-weight:700;src:url(../fonts/JetBrainsMono_700Bold.ttf)}
*{box-sizing:border-box;margin:0}
body{background:#2b2224;font-family:Newsreader;color:#ddd}
.row{display:flex;gap:26px;padding:24px 28px;width:max-content}
.ph{display:flex;flex-direction:column;align-items:center;gap:10px}
.ph figcaption{font:500 15px Newsreader;color:#e8d9d9}
.scr{position:relative;width:393px;height:852px;overflow:hidden;border-radius:44px;background:${C.cream};box-shadow:0 0 0 8px #111,0 20px 50px rgba(0,0,0,.5)}
.t{font:500 22px Newsreader;color:#e8d9d9;padding:22px 28px 0}
.strip{position:relative;width:393px;height:122px;background:${C.cream};overflow:hidden}
.cell{display:flex;flex-direction:column;gap:6px}.cell span{font:500 13px Newsreader;color:#e8d9d9}
`;
const beforeFrame = (key) => {
  const f = FR[key];
  return `<figure class="ph"><div class="scr"><div style="position:absolute;inset:0;background:${C.cream}"></div><div style="position:absolute;left:0;top:0;width:393px;height:852px;background:url(../img/${f.img}.png) top left/393px auto"></div></div><figcaption>BEFORE: current bar</figcaption></figure>`;
};
const frame = (d, key) => {
  const f = FR[key];
  return `<figure class="ph"><div class="scr"><div style="position:absolute;inset:0;background:${C.cream}"></div>
    <div style="position:absolute;left:0;top:0;width:393px;height:${CUT}px;background:url(../img/${f.img}.png) top left/393px auto"></div>${f.extra}${barHtml(d, f.active, f.badge, 1)}
    <div style="position:absolute;left:129.5px;bottom:8px;width:134px;height:5px;border-radius:3px;background:#1a1313"></div></div><figcaption>${f.cap}</figcaption></figure>`;
};
const strip = (d, active, badge, dt, cap) => `<div class="cell"><div class="strip">${barHtml(d, active, badge, dt)}</div><span>${cap}</span></div>`;
const before = (img, cap) => `<div class="cell"><div class="strip" style="background:url(../img/${img}.png) 0 -732px/393px auto"></div><span>${cap}</span></div>`;

for (const d of [1, 2, 3]) {
  const D = DIRS[d];
  writeFileSync(`${here}/v2-${d}.html`, `<!doctype html><meta charset=utf-8><style>${BASE}${BASE_CSS}${D.css}</style><div class="t">${D.name}</div><div class="row">${beforeFrame('home')}${frame(d, 'home')}${frame(d, 'calendar')}${frame(d, 'scan')}${frame(d, 'scrolled')}</div>`);
  writeFileSync(`${here}/v2d-${d}.html`, `<!doctype html><meta charset=utf-8><style>${BASE}${BASE_CSS}${D.css}</style><div class="t">${D.name} · bar states</div>
  <div style="display:grid;grid-template-columns:repeat(3,393px);gap:18px 24px;padding:20px 28px">
  ${before('01-home-rest', 'BEFORE: Collection active')}${before('11-calendar', 'BEFORE: Calendar active')}${before('15-boards-grid', 'BEFORE: Boards active')}
  ${strip(d, 'collection', '3', 1, 'Collection active, badge 3')}${strip(d, 'calendar', '', 1, 'Calendar active')}${strip(d, 'scan', '', 1, 'Scan active')}
  ${strip(d, 'boards', '', 1, 'Boards active')}${strip(d, 'profile', '3', 1, 'Profile active, badge 3')}${strip(d, 'calendar', '9+', 1.15, 'Dynamic Type 1.15x, badge 9+')}
  </div>`);
  // zoom: centre piece at 3x of a 2x render = 6x
  writeFileSync(`${here}/v2z-${d}.html`, `<!doctype html><meta charset=utf-8><style>${BASE}${BASE_CSS}${D.css} .z{zoom:2}</style>
  <div class="z" style="display:flex;gap:6px;padding:6px"><div class="strip" style="width:200px;height:120px;overflow:hidden"><div style="position:absolute;left:-96px;top:0;width:393px;height:122px">${barHtml(d, 'collection', '3', 1)}</div></div>
  <div class="strip" style="width:200px;height:120px;overflow:hidden"><div style="position:absolute;left:-96px;top:0;width:393px;height:122px">${barHtml(d, 'scan', '', 1)}</div></div></div>`);
}
