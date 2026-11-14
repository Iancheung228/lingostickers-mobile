// Generates one mockup page per direction: node gen.mjs  -> src/dir-{a,b,c,d}.html
import { writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));

const T = {
  cream: '#FAF4EA', blush: '#E4A0A1', terra: '#9D4D51', terraDark: '#833F46', maroon: '#662B31',
  inkDark: '#833F46', inkLight: '#7E5559', border: '#EADFD6', terraLight: '#F2DCDC', white: '#FFFFFF',
};

// ---- icon set: 24 box, round caps/joins, one stroke weight, outline + filled pair ----
// `ko` = knockout colour (the bar surface) for details cut out of a filled glyph.
const SW = 1.7;
const ICONS = {
  collection: {
    out: () => `<path d="M8 5h9a3 3 0 0 1 3 3v5"/><rect x="4" y="8" width="12.5" height="12" rx="3"/><path d="M7.5 13h5.5M7.5 16h3"/>`,
    fill: ko => `<path d="M8 5h9a3 3 0 0 1 3 3v5"/><rect x="4" y="8" width="12.5" height="12" rx="3" fill="currentColor"/><path d="M7.5 13h5.5M7.5 16h3" stroke="${ko}"/>`,
  },
  calendar: {
    out: () => `<rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 10h17M8 3v3.5M16 3v3.5"/><circle cx="12" cy="15" r="1.1" fill="currentColor" stroke="none"/>`,
    fill: ko => `<rect x="3.5" y="5" width="17" height="15.5" rx="3.5" fill="currentColor"/><path d="M3.5 10h17" stroke="${ko}"/><path d="M8 3v3.5M16 3v3.5"/><circle cx="12" cy="15" r="1.2" fill="${ko}" stroke="none"/>`,
  },
  boards: {
    out: () => `<rect x="4" y="4" width="7" height="9" rx="2.2"/><rect x="4" y="15" width="7" height="5" rx="2.2"/><rect x="13" y="4" width="7" height="6" rx="2.2"/><rect x="13" y="12" width="7" height="8" rx="2.2"/>`,
    fill: () => `<g fill="currentColor"><rect x="4" y="4" width="7" height="9" rx="2.2"/><rect x="4" y="15" width="7" height="5" rx="2.2"/><rect x="13" y="4" width="7" height="6" rx="2.2"/><rect x="13" y="12" width="7" height="8" rx="2.2"/></g>`,
  },
  profile: {
    out: () => `<circle cx="12" cy="8" r="3.8"/><path d="M4.75 20c.5-3.6 3.5-5.75 7.25-5.75S18.75 16.4 19.25 20"/>`,
    fill: () => `<circle cx="12" cy="8" r="3.8" fill="currentColor"/><path d="M4.5 19.5c0-3.4 3.2-5.5 7.5-5.5s7.5 2.1 7.5 5.5c0 .8-.6 1.5-1.5 1.5h-12c-.9 0-1.5-.7-1.5-1.5z" fill="currentColor"/>`,
  },
};
const CAM_BODY = 'M3 10.5A3.5 3.5 0 0 1 6.5 7h1.2a1.5 1.5 0 0 0 1.25-.67l.45-.68A2 2 0 0 1 11.07 4.75h1.86a2 2 0 0 1 1.67.9l.45.68A1.5 1.5 0 0 0 16.3 7h1.2A3.5 3.5 0 0 1 21 10.5v6A3.5 3.5 0 0 1 17.5 20h-11A3.5 3.5 0 0 1 3 16.5z';
const camera = (size, body, lens, sw = SW) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="${sw}"><path d="${CAM_BODY}" fill="${body}" stroke="${body}"/><circle cx="12" cy="13.2" r="3.4" stroke="${lens}" fill="none"/></svg>`;
const icon = (name, filled, ko, size = 25) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round">${filled ? ICONS[name].fill(ko) : ICONS[name].out()}</svg>`;

export { ICONS, CAM_BODY, T, SW };

const SLOTS = [
  ['collection', 'Collection'], ['calendar', 'Calendar'], ['scan', 'Scan'], ['boards', 'Boards'], ['profile', 'Profile'],
];

// ---------------- directions ----------------
// Each returns the bar's HTML for (active, badge, dt) and the extra CSS it needs.
const DIRS = {
  a: {
    name: 'A · Docked Quiet',
    css: `
    .bar{position:absolute;left:0;right:0;bottom:0;height:83px;background:${T.cream};border-top:1px solid ${T.border};box-shadow:0 -8px 20px rgba(102,43,49,.045);display:flex;padding:0 6px}
    .bar .it{flex:1;display:flex;flex-direction:column;align-items:center;padding-top:6px;position:relative;color:#85666A}
    .bar .ic{height:26px;display:flex;align-items:center;justify-content:center;position:relative}
    .bar .lb{font:500 calc(11px*var(--dt)) /13px Newsreader;margin-top:2px;letter-spacing:.1px}
    .bar .it.on{color:${T.terra}}
    .bar .pill{width:52px;height:30px;border-radius:11px;background:${T.terra};display:flex;align-items:center;justify-content:center;box-shadow:inset 0 1px 0 rgba(255,255,255,.2)}
    .bar .it.on .pill{background:${T.terraDark};box-shadow:inset 0 0 0 1.5px rgba(250,244,234,.55)}
    .bar .it.scan{color:${T.terra}}
    .bar .it.scan .ic{height:30px;margin-top:-2px;margin-bottom:-2px}
    .bar .badge{position:absolute;left:calc(50% + 8px);top:-3px;min-width:17px;height:17px;border-radius:9px;background:${T.terra};color:#fff;font:700 10.5px/17px 'JetBrains Mono';text-align:center;padding:0 4px;box-shadow:0 0 0 2px ${T.cream}}
    `,
    ko: T.cream,
    bar(active, badge, dt) {
      return `<div class="bar" style="--dt:${dt}">${SLOTS.map(([k, l]) => {
        const on = active === k;
        if (k === 'scan') return `<div class="it scan ${on ? 'on' : ''}"><div class="ic"><div class="pill">${camera(23, '#fff', on ? T.terraDark : T.terra, 1.8)}</div></div><div class="lb">${l}</div></div>`;
        return `<div class="it ${on ? 'on' : ''}"><div class="ic">${icon(k, on, T.cream)}${k === 'collection' && badge ? `<span class="badge">${badge}</span>` : ''}</div><div class="lb">${l}</div></div>`;
      }).join('')}</div>`;
    },
  },
  b: {
    name: 'B · Light Capsule',
    css: `
    .bar{position:absolute;left:16px;right:16px;bottom:30px;height:62px;border-radius:31px;background:rgba(255,252,247,.97);
      box-shadow:0 0 0 1px rgba(157,77,81,.10),0 8px 22px rgba(102,43,49,.13),0 1px 3px rgba(102,43,49,.10);display:flex;padding:0 4px}
    .bar .it{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;color:#85666A}
    .bar .ic{height:25px;display:flex;align-items:center;justify-content:center;position:relative}
    .bar .lb{font:500 calc(11px*var(--dt)) /13px Newsreader;margin-top:1px}
    .bar .it.on{color:${T.terra}}
    .bar .disc{width:50px;height:50px;border-radius:50%;background:${T.terra};display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(157,77,81,.38),inset 0 1px 0 rgba(255,255,255,.18)}
    .bar .it.on .disc{background:${T.terraDark}}
    .bar .badge{position:absolute;left:calc(50% + 8px);top:-4px;min-width:17px;height:17px;border-radius:9px;background:${T.terra};color:#fff;font:700 10.5px/17px 'JetBrains Mono';text-align:center;padding:0 4px;box-shadow:0 0 0 2px #FFFCF7}
    `,
    ko: '#FFFCF7',
    bar(active, badge, dt) {
      return `<div class="bar" style="--dt:${dt}">${SLOTS.map(([k, l]) => {
        const on = active === k;
        if (k === 'scan') return `<div class="it ${on ? 'on' : ''}"><div class="disc">${camera(26, '#fff', on ? T.terraDark : T.terra, 1.8)}</div></div>`;
        return `<div class="it ${on ? 'on' : ''}"><div class="ic">${icon(k, on, '#FFFCF7')}${k === 'collection' && badge ? `<span class="badge">${badge}</span>` : ''}</div><div class="lb">${l}</div></div>`;
      }).join('')}</div>`;
    },
  },
  c: {
    name: 'C · Bookend Band',
    css: `
    .bar{position:absolute;left:0;right:0;bottom:0;height:83px;background:${T.blush};border-radius:24px 24px 0 0;display:flex;padding:0 6px;height:88px}
    .bar .it{flex:1;display:flex;flex-direction:column;align-items:center;padding-top:10px;position:relative;color:${T.maroon}}
    .bar .ic{height:26px;display:flex;align-items:center;justify-content:center;position:relative}
    .bar .lb{font:500 calc(11px*var(--dt)) /13px Newsreader;margin-top:6px}
    .bar .it:not(.on):not(.scan){color:#7A383E}
    .bar .it.on::before{content:"";position:absolute;top:5px;left:50%;margin-left:-9px;width:18px;height:3px;border-radius:2px;background:${T.cream}}
    .bar .it{padding-top:14px!important}.bar .it.scan{padding-top:14px!important}
    .bar .disc{width:36px;height:36px;margin:-5px 0;border-radius:50%;background:${T.cream};display:flex;align-items:center;justify-content:center;box-shadow:0 1px 0 rgba(102,43,49,.18)}
    
    .bar .it.scan.on .disc{background:#fff;box-shadow:0 0 0 3px rgba(250,244,234,.55)}
    .bar .badge{position:absolute;left:calc(50% + 8px);top:-4px;min-width:17px;height:17px;border-radius:9px;background:${T.maroon};color:${T.cream};font:700 10.5px/17px 'JetBrains Mono';text-align:center;padding:0 4px;box-shadow:0 0 0 2px ${T.blush}}
    `,
    ko: T.blush,
    bar(active, badge, dt) {
      return `<div class="bar" style="--dt:${dt}">${SLOTS.map(([k, l]) => {
        const on = active === k;
        if (k === 'scan') return `<div class="it scan ${on ? 'on' : ''}"><div class="disc">${camera(22, T.terra, T.cream, 1.8)}</div><div class="lb">${l}</div></div>`;
        return `<div class="it ${on ? 'on' : ''}"><div class="ic">${icon(k, on, T.blush)}${k === 'collection' && badge ? `<span class="badge">${badge}</span>` : ''}</div><div class="lb">${l}</div></div>`;
      }).join('')}</div>`;
    },
  },
  d: {
    name: 'D · Split Islands',
    css: `
    .bar{position:absolute;left:16px;right:16px;bottom:30px;height:58px;display:flex;gap:10px;align-items:center}
    .bar .isl{flex:1;height:58px;border-radius:29px;background:rgba(255,252,247,.97);display:flex;padding:0 6px;
      box-shadow:0 0 0 1px rgba(157,77,81,.10),0 8px 22px rgba(102,43,49,.13),0 1px 3px rgba(102,43,49,.10)}
    .bar .it{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;color:#85666A}
    .bar .ic{height:25px;display:flex;align-items:center;justify-content:center;position:relative}
    .bar .lb{font:500 calc(11px*var(--dt)) /13px Newsreader;margin-top:0}
    .bar .it.on{color:${T.terra}}
    .bar .it.on::after{content:"";position:absolute;bottom:5px;width:4px;height:4px;border-radius:2px;background:${T.terra}}
    .bar .disc{width:58px;height:58px;border-radius:50%;background:${T.terra};display:flex;align-items:center;justify-content:center;flex:none;box-shadow:0 8px 20px rgba(157,77,81,.36),0 1px 3px rgba(102,43,49,.2),inset 0 1px 0 rgba(255,255,255,.18)}
    .bar .disc.on{background:${T.terraDark}}
    .bar .badge{position:absolute;left:calc(50% + 8px);top:-4px;min-width:17px;height:17px;border-radius:9px;background:${T.terra};color:#fff;font:700 10.5px/17px 'JetBrains Mono';text-align:center;padding:0 4px;box-shadow:0 0 0 2px #FFFCF7}
    `,
    ko: '#FFFCF7',
    bar(active, badge, dt) {
      const it = ([k, l]) => { const on = active === k; return `<div class="it ${on ? 'on' : ''}"><div class="ic">${icon(k, on, '#FFFCF7')}${k === 'collection' && badge ? `<span class="badge">${badge}</span>` : ''}</div><div class="lb">${l}</div></div>`; };
      return `<div class="bar" style="--dt:${dt}"><div class="isl">${it(SLOTS[0])}${it(SLOTS[1])}</div><div class="disc ${active === 'scan' ? 'on' : ''}">${camera(28, '#fff', active === 'scan' ? T.terraDark : T.terra, 1.8)}</div><div class="isl">${it(SLOTS[3])}${it(SLOTS[4])}</div></div>`;
    },
  },
};

// ---------------- frames ----------------
const CUT = 742; // backdrop cropped above the old bar
const card = (x, y) => `<div style="position:absolute;left:${x}px;top:${y}px;width:171px;height:171px;background:url(../img/01-home-rest.png) -19.6px -401.5px/393px auto"></div>`;
const bcard = (x, y) => `<div style="position:absolute;left:${x}px;top:${y}px;width:171px;height:201px;background:url(../img/15-boards-grid.png) -19.6px -146.5px/393px auto"></div>`;
const FRAMES = {
  home: { img: '01-home-rest', extra: '', badge: '1' },
  calendar: { img: '11-calendar', extra: '', badge: '1' },
  scan: { img: '13-scan-camera', extra: '', badge: '1' },
  scrolled: { img: '15-boards-grid', extra: bcard(19.6, 360) + bcard(202, 360) + bcard(19.6, 575) + bcard(202, 575) + bcard(19.6, 790) + bcard(202, 790), badge: '9+' },
};
function frame(dir, key, active, label) {
  const f = FRAMES[key];
  return `<figure class="ph"><div class="scr">
    <div style="position:absolute;inset:0;background:${T.cream}"></div>
    <div style="position:absolute;left:0;top:0;width:393px;height:${CUT}px;background:url(../img/${f.img}.png) top left/393px auto"></div>
    ${f.extra}${DIRS[dir].bar(active, f.badge, 1)}
    <div style="position:absolute;left:129.5px;bottom:8px;width:134px;height:5px;border-radius:3px;background:#1a1313"></div>
  </div><figcaption>${label}</figcaption></figure>`;
}
const BASE = `
@font-face{font-family:Newsreader;font-weight:500;src:url(../fonts/Newsreader_500Medium.ttf)}
@font-face{font-family:Newsreader;font-weight:400;src:url(../fonts/Newsreader_400Regular.ttf)}
@font-face{font-family:'JetBrains Mono';font-weight:700;src:url(../fonts/JetBrainsMono_700Bold.ttf)}
*{box-sizing:border-box;margin:0}
body{background:#2b2224;font-family:Newsreader;color:#ddd}
.row{display:flex;gap:28px;padding:28px;width:max-content}
.ph{display:flex;flex-direction:column;align-items:center;gap:10px}
.ph figcaption{font:500 15px Newsreader;color:#e8d9d9}
.scr{position:relative;width:393px;height:852px;overflow:hidden;border-radius:44px;background:${T.cream};box-shadow:0 0 0 8px #111,0 20px 50px rgba(0,0,0,.5)}
.t{font:500 22px Newsreader;color:#e8d9d9;padding:24px 28px 0}
.strip{display:flex;gap:0;width:max-content}
.sp{position:relative;width:393px;height:130px;background:${T.cream};overflow:hidden}
`;
for (const d of Object.keys(DIRS)) {
  const D = DIRS[d];
  const main = `<!doctype html><meta charset=utf-8><style>${BASE}${D.css}</style><div class="t">${D.name}</div><div class="row">
    ${frame(d, 'home', 'collection', 'Collection active · due badge 1')}
    ${frame(d, 'calendar', 'calendar', 'Calendar active')}
    ${frame(d, 'scan', 'scan', 'Scan screen · Scan active')}
    ${frame(d, 'scrolled', 'boards', 'Boards active · content behind · badge 9+')}
  </div>`;
  writeFileSync(`${here}/dir-${d}.html`, main);
  // detail: bar only, 3x crop, normal and Dynamic Type 1.15, two active states
  const spec = (active, badge, dt, cap) => `<div style="display:flex;flex-direction:column;gap:6px"><div class="sp" style="height:${d === 'a' ? 83 : d === 'c' ? 88 : 118}px">${D.bar(active, badge, dt)}</div><span style="font:500 13px Newsreader;color:#e8d9d9">${cap}</span></div>`;
  const det = `<!doctype html><meta charset=utf-8><style>${BASE}${D.css}
  .sp .bar{bottom:${d === 'a' || d === 'c' ? 0 : 30}px}</style><div class="t">${D.name} · bar detail</div>
  <div style="display:flex;gap:24px;padding:24px 28px;flex-wrap:wrap;width:870px">
    ${spec('collection', '3', 1, 'Collection active, badge 3')}
    ${spec('profile', '3', 1, 'Profile active')}
    ${spec('scan', '', 1, 'Scan active, no badge')}
    ${spec('calendar', '9+', 1.15, 'Dynamic Type 1.15x, badge 9+')}
  </div>`;
  writeFileSync(`${here}/detail-${d}.html`, det);
}
