// node build.mjs [sw]   -> sheets/*.html + shots/*.png (needs Google Chrome). Not app code.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { EXPLORE, CAMERA, LABELS } from './glyphs.mjs';
import { glyphSvg, cameraSvg, PILL, INK_OFF, INK_ON, KO } from './render.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire('/Users/school/lingostickers-mobile/lingostickers-mobile/package.json');
const sharp = require('sharp');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SW = Number(process.argv[2] || 1.65);
export const FINAL = JSON.parse(fs.readFileSync(path.join(here, 'choice.json'), 'utf8')); // {collection:'B',...,camera:'B'}

const FONT = `@font-face{font-family:Newsreader;font-weight:500;src:url(../../fonts/Newsreader_500Medium.ttf)}
@font-face{font-family:Newsreader;font-weight:400;src:url(../../fonts/Newsreader_400Regular.ttf)}`;
const BASE = `${FONT}*{box-sizing:border-box;margin:0}body{background:#FAF4EA;font-family:Newsreader;color:#3A1519}
.pill{background:${PILL};border-radius:14px;padding:12px 14px;display:inline-flex;flex-direction:column;align-items:center;gap:3px}
.lb{font:500 11px/13px Newsreader;letter-spacing:.1px;color:${INK_OFF}}.on .lb{color:${INK_ON}}
.h{font:500 17px Newsreader;margin:18px 0 8px}.s{font:400 13px Newsreader;color:#7E5559}
.row{display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap}.cap{font:400 12px Newsreader;color:#7E5559;text-align:center;margin-top:4px}
.disc{width:46px;height:46px;border-radius:50%;background:linear-gradient(180deg,#A85A5E,#92454A);display:flex;align-items:center;justify-content:center}`;

export function shoot(name, body, w, h, dsf = 1, bg = '#FAF4EA') {
  const html = `<!doctype html><meta charset=utf-8><style>${BASE}body{background:${bg};padding:20px;width:${w}px}</style>${body}`;
  const f = path.join(here, 'sheets', name + '.html');
  fs.writeFileSync(f, html);
  const out = path.join(here, 'shots', name + '.png');
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=' + dsf, `--window-size=${w},${h}`, '--screenshot=' + out, 'file://' + f], { stdio: 'ignore' });
  return out;
}

const tab = (k, v, state, o = {}) => `<div class="pill ${state === 'filled' ? 'on' : ''}" style="${o.pillStyle || ''}">${glyphSvg(v, state, { size: o.size || 25, sw: o.sw || SW })}${o.noLabel ? '' : `<span class="lb">${LABELS[k]}</span>`}</div>`;

// ---------- exploration sheet
function explore() {
  let b = '';
  for (const k of Object.keys(EXPLORE)) {
    b += `<div class="h">${LABELS[k]}</div><div class="row">`;
    for (const [id, v] of Object.entries(EXPLORE[k])) {
      b += `<div><div class="row" style="gap:6px">${['outline', 'filled'].map((s) => `<div class="pill" style="padding:14px">${glyphSvg(v, s, { size: 96, sw: SW })}</div>`).join('')}
      <div style="display:flex;flex-direction:column;gap:6px">${['outline', 'filled'].map((s) => `<div class="pill" style="padding:6px 10px">${glyphSvg(v, s, { size: 25, sw: SW })}</div>`).join('')}</div></div>
      <div class="cap" style="text-align:left">${id}: ${v.name}</div></div>`;
    }
    b += '</div>';
  }
  b += `<div class="h">Camera (white on disc)</div><div class="row">`;
  for (const [id, c] of Object.entries(CAMERA)) b += `<div><div class="row" style="gap:6px"><div class="disc" style="width:130px;height:130px">${cameraSvg(c, { size: 72, sw: SW })}</div><div class="disc">${cameraSvg(c, { size: 24, sw: SW })}</div></div><div class="cap" style="text-align:left">${id}: ${c.name}</div></div>`;
  b += '</div>';
  return shoot('explore', b, 1180, 1500, 1);
}

// ---------- stroke weight test
function strokes(variants) {
  let b = '';
  for (const sw of [1.5, 1.65, 1.75]) {
    b += `<div class="h">stroke ${sw} (${(sw * 25 / 24).toFixed(2)} pt at 25 pt)</div><div class="row" style="gap:8px">`;
    for (const k of ['collection', 'calendar', 'boards', 'profile']) for (const s of ['outline', 'filled']) b += tab(k, variants[k], s, { sw });
    b += '</div>';
  }
  return b;
}

// ---------- bar strip (crest silhouette from v2-3)
export function barHtml(variants, active, { sw = SW, cam = FINAL.camera } = {}) {
  const W = 345, c = W / 2, r = 32, H = 64;
  const d = `M${r},0 H${c - 46} C${c - 34},0 ${c - 24},-14 ${c},-14 C${c + 24},-14 ${c + 34},0 ${c + 46},0 H${W - r} A${r},${r} 0 0 1 ${W - r},${H} H${r} A${r},${r} 0 0 1 ${r},0 Z`;
  const shape = `<svg style="position:absolute;left:0;top:-14px;filter:drop-shadow(0 6px 6px rgba(102,43,49,.16)) drop-shadow(0 1px 1px rgba(102,43,49,.14))" viewBox="0 -14 ${W} 78" width="${W}" height="78"><defs><linearGradient id="g3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EBAEAF"/><stop offset=".5" stop-color="#E4A0A1"/><stop offset="1" stop-color="#E09A9B"/></linearGradient></defs><path d="${d}" fill="url(#g3)"/></svg>`;
  const items = ['collection', 'calendar', 'scan', 'boards', 'profile'].map((k) => {
    const on = active === k;
    if (k === 'scan') return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;position:relative;padding-top:11px"><div style="height:25px"></div><div class="lb" style="margin-top:3px;${on ? 'color:#3A1519' : ''}">Scan</div><div style="position:absolute;left:50%;margin-left:-23px;top:-10px;width:46px;height:46px;border-radius:50%;background:${on ? 'linear-gradient(180deg,#94474C,#7B383E)' : 'linear-gradient(180deg,#A85A5E,#92454A)'};box-shadow:0 4px 8px rgba(102,43,49,.30),inset 0 1px 0 rgba(255,255,255,.28),0 0 0 ${on ? '3px rgba(250,244,234,.85)' : '1.5px rgba(255,236,230,.55)'};display:flex;align-items:center;justify-content:center">${cameraSvg(CAMERA[cam], { size: 24, sw })}</div></div>`;
    return `<div class="${on ? 'on' : ''}" style="flex:1;display:flex;flex-direction:column;align-items:center;position:relative;padding-top:11px">${glyphSvg(variants[k], on ? 'filled' : 'outline', { size: 25, sw })}<div class="lb" style="margin-top:3px">${LABELS[k]}</div>${on ? '<div style="position:absolute;bottom:4px;width:16px;height:3px;border-radius:2px;background:#3A1519"></div>' : ''}</div>`;
  }).join('');
  return `<div style="position:relative;width:${W}px;height:${H}px;margin:22px 0 14px;display:flex">${shape}${items}</div>`;
}

function chosen() { const o = {}; for (const k of Object.keys(EXPLORE)) o[k] = EXPLORE[k][FINAL[k]]; return o; }

// ---------- metrics: coverage, bbox, centroid per glyph/state (rasterised at 16x)
export async function metrics(variants, sw = SW) {
  const out = {};
  for (const k of Object.keys(variants)) for (const s of ['outline', 'filled']) {
    const svg = glyphSvg(variants[k], s, { size: 384, sw, ink: '#000', ko: '#fff' }).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ').replace('fill="none" stroke-width', 'fill="none" stroke-width');
    // flatten on white, ink = black, KO = white so coverage is the true dark area
    const { data, info } = await sharp(Buffer.from(svg)).flatten({ background: '#fff' }).greyscale().raw().toBuffer({ resolveWithObject: true });
    let n = 0, sx = 0, sy = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; const W = info.width;
    for (let i = 0; i < data.length; i++) if (data[i] < 128) { const x = i % W, y = (i / W) | 0; n++; sx += x; sy += y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const u = 16;
    out[k + '.' + s] = { area: +(n / u / u).toFixed(1), bbox: [x0 / u, y0 / u, (x1 + 1) / u, (y1 + 1) / u].map((v) => +v.toFixed(2)), cx: +(sx / n / u).toFixed(2), cy: +(sy / n / u).toFixed(2) };
  }
  return out;
}

const mode = process.argv[3] || 'all';
if (mode === 'explore' || mode === 'all') explore();
if (mode === 'strokes' || mode === 'all') {
  const v = chosen();
  shoot('stroke-test-1x', strokes(v), 760, 440, 1);
  shoot('stroke-test-3x', strokes(v), 760, 440, 3);
}
if (mode === 'metrics') console.log(JSON.stringify(await metrics(chosen()), null, 1));

if (mode === 'final' || mode === 'all') {
  const v = chosen();
  const row = (state, size) => ['collection', 'calendar', 'scan', 'boards', 'profile'].map((k) => k === 'scan' ? `<div class="disc">${cameraSvg(CAMERA[FINAL.camera], { size: 24, sw: SW })}</div>` : tab(k, v[k], state, { size })).join('');
  const body = `<div class="h">Inactive</div><div class="row" style="gap:12px;align-items:center">${row('outline', 25)}</div><div class="h">Active</div><div class="row" style="gap:12px;align-items:center">${row('filled', 25)}</div>`;
  shoot('final-1x', body, 560, 270, 1);
  shoot('final-3x', body, 560, 270, 3);
  // 8x with grid: 192px glyphs
  const g = (k, s) => `<div style="text-align:center"><div style="background:#E8A5A6;line-height:0">${glyphSvg(v[k], s, { size: 192, sw: SW, grid: true })}</div><div class="cap">${k} ${s}</div></div>`;
  const cam = `<div style="text-align:center"><div style="background:#92454A;line-height:0;position:relative">${cameraSvg(CAMERA[FINAL.camera], { size: 192, sw: SW })}<svg style="position:absolute;left:0;top:0" width="192" height="192" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width=".07"><rect x="2" y="2" width="20" height="20" stroke-dasharray=".4 .3"/><circle cx="12" cy="12" r="10"/><rect x="3" y="3" width="18" height="18"/><rect x="4" y="2" width="16" height="20"/><rect x="2" y="4" width="20" height="16"/></svg></div><div class="cap">camera (white, no outline state)</div></div>`;
  const grid = `<div class="h">8x on the 24 grid. Blue: live area 20x20 (dashed), circle d20, square 18, portrait 16x20, landscape 20x16. Red: centre axes. Stroke ${SW}.</div><div class="row" style="gap:10px">${['collection', 'calendar', 'boards', 'profile'].map((k) => g(k, 'outline')).join('')}</div><div class="row" style="gap:10px;margin-top:10px">${['collection', 'calendar', 'boards', 'profile'].map((k) => g(k, 'filled')).join('')}</div><div class="row" style="margin-top:10px">${cam}</div>`;
  shoot('grid-8x', grid, 840, 1000, 1);
}
if (mode === 'bar' || mode === 'all') {
  const v = chosen();
  const body = ['collection', 'calendar', 'scan', 'boards', 'profile'].map((a) => barHtml(v, a)).join('');
  shoot('bar-1x', body, 400, 520, 1, '#FAF4EA');
  shoot('bar-3x', body, 400, 520, 3, '#FAF4EA');
  shoot('bar-3x-crop', barHtml(v, 'calendar') + barHtml(v, 'scan'), 400, 220, 3, '#FAF4EA');
}
