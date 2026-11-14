// node export.mjs -> icons.json + icons.html (reads choice.json)
import fs from 'fs';
import { EXPLORE, CAMERA, LABELS } from './glyphs.mjs';
import { partAttrs, glyphSvg, cameraSvg, PILL } from './render.mjs';
const SW = 1.65;
const FINAL = JSON.parse(fs.readFileSync('choice.json', 'utf8'));
const prev = JSON.parse(fs.readFileSync('icons.json', 'utf8'));
const json = { meta: {
  viewBox: '0 0 24 24', strokeWidth: SW, strokeLinecap: 'round', strokeLinejoin: 'round',
  tokens: { ink: 'inactive #5A2429 / active #3A1519 (caller supplies)', ko: '#E4A0A1 knockout (caller supplies): the flat pill colour' },
  note: 'fill/stroke values are tokens: "ink" | "ko" | "none". Paint parts in array order. Stroke width applies to every stroked part. Camera is a single evenodd white fill (lens is a real hole).',
  sizeAdvice: 'Render at size 24 for 1 unit = 1 pt (half-unit coordinates land on whole device pixels at @2x). 25 also works; see rationale.',
  optionalNudge: { note: 'translate(x,y) in grid units that centres each glyph outer bbox on (12,12); apply only if the bar designer sees drift.', collection: [0.0, -0.2], calendar: [0.0, 0.1], boards: [0.0, 0.0], profile: [0.0, -0.15], camera: [0, 0] },
  changes: [...(prev.meta.changes || []), { when: '2026-11-14', by: 'icon artist', what: 'Critic round 2: Collection redrawn again as two straight, closed landscape flash cards offset up-left (no tilt, no open arc, so no strap/handle), word lines on the front card, back card stays an outline when the front fills. Calendar scaled to 94% (ink area 135 -> 128). Knockout is now flat #E4A0A1. Critic round 1: Boards redrawn as uneven masonry of squircle tiles with one inset round sticker (no longer reads as 08; filled = identical geometry). Collection redrawn as a portrait card with word lines and a tilted card fanned behind-left, back card stays an outline when the front fills, top-right 7x7 zone ink-free for the badge. Camera rebuilt with the family corner logic (squircle body radius 4.5, lens ring = stroke width 1.65, seed lens, flash dot). Profile kept as widened by the designer. Stroke stays 1.65.' }] }
, glyphs: {} };
for (const k of ['collection', 'calendar', 'boards', 'profile']) {
  const v = EXPLORE[k][FINAL[k]];
  json.glyphs[k] = { label: LABELS[k] };
  for (const [st, key] of [['inactive', 'outline'], ['active', 'filled']]) json.glyphs[k][st] = v.parts.map((p) => ({ d: p.d, ...partAttrs(p.role, key) }));
}
json.camera = { fill: 'white', fillRule: 'evenodd', d: CAMERA[FINAL.camera].d };
fs.writeFileSync('icons.json', JSON.stringify(json, null, 1));

// ---------- HTML
const b64 = (f) => fs.readFileSync(f).toString('base64');
const font = `@font-face{font-family:Newsreader;font-weight:500;src:url(data:font/ttf;base64,${b64('../fonts/Newsreader_500Medium.ttf')})}@font-face{font-family:Newsreader;font-weight:400;src:url(data:font/ttf;base64,${b64('../fonts/Newsreader_400Regular.ttf')})}`;
const tile = (k, v, s, size = 25, sw = SW) => `<span class="pill">${glyphSvg(v, s, { size, sw })}</span>`;
let ex = '';
for (const k of Object.keys(EXPLORE)) {
  ex += `<h3>${LABELS[k]}</h3><div class="ex">`;
  for (const [id, v] of Object.entries(EXPLORE[k])) ex += `<figure class="${FINAL[k] === id ? 'pick' : ''}"><div>${tile(k, v, 'outline', 72)}${tile(k, v, 'filled', 72)}</div><figcaption><b>${id}</b> ${v.name}${FINAL[k] === id ? ' <em>chosen</em>' : ''}</figcaption></figure>`;
  ex += '</div>';
}
ex += `<h3>Camera</h3><div class="ex">${Object.entries(CAMERA).map(([id, c]) => `<figure class="${FINAL.camera === id ? 'pick' : ''}"><div><span class="disc big">${cameraSvg(c, { size: 56, sw: SW })}</span><span class="disc">${cameraSvg(c, { size: 24, sw: SW })}</span></div><figcaption><b>${id}</b> ${c.name}${FINAL.camera === id ? ' <em>chosen</em>' : ''}</figcaption></figure>`).join('')}</div>`;
const fin = (st) => ['collection', 'calendar', 'boards', 'profile'].map((k) => `<span class="slot ${st === 'filled' ? 'on' : ''}">${tile(k, EXPLORE[k][FINAL[k]], st, 40)}<small>${LABELS[k]}</small></span>`).join('') ;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tab glyphs v3</title><style>${font}
:root{--cream:#FAF4EA;--ink:#3A1519;--mute:#7E5559;--line:#E6D6CB}*{box-sizing:border-box}
body{margin:0;background:var(--cream);color:var(--ink);font:400 16px/1.5 Newsreader,serif}
main{max-width:980px;margin:0 auto;padding:32px 16px 80px}h1{font:500 34px Newsreader;margin:0 0 4px;letter-spacing:-.5px}h2{font:500 24px Newsreader;margin:48px 0 8px;border-top:1px solid var(--line);padding-top:20px}h3{font:500 18px Newsreader;margin:22px 0 8px}
p,li{max-width:70ch}.lead{color:var(--mute)}code{font:12px ui-monospace,monospace;background:#F1E6DA;padding:1px 5px;border-radius:4px}
.pill{background:${PILL};border-radius:14px;padding:12px;display:inline-flex}.ex{display:flex;flex-wrap:wrap;gap:20px}figure{margin:0;padding:8px;border-radius:14px;border:2px solid transparent}figure.pick{border-color:#9D4D51}figure>div{display:flex;gap:6px}figcaption{font-size:13px;color:var(--mute);margin-top:6px;max-width:210px}em{color:#9D4D51;font-style:normal;font-weight:500}
.disc{width:46px;height:46px;border-radius:50%;background:linear-gradient(180deg,#A85A5E,#92454A);display:inline-flex;align-items:center;justify-content:center}.disc.big{width:84px;height:84px}
img{max-width:100%;height:auto;border-radius:10px;border:1px solid var(--line);display:block}.slots{display:flex;gap:10px;flex-wrap:wrap}.slot{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:12px;color:var(--mute)}
.two{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}table{border-collapse:collapse;font-size:14px}td,th{border-bottom:1px solid var(--line);padding:4px 12px 4px 0;text-align:left}
</style></head><body><main>
<h1>Tab glyphs v3</h1><p class="lead">Five glyphs for the R3 Crest bar, one 24 grid, one stroke (${SW}), one radius scale. Nothing here is wired into the app.</p>
<h2>The set</h2><div class="two"><div><h3>Inactive (outline, #5A2429)</h3><div class="slots">${fin('outline')}</div></div><div><h3>Active (filled, #3A1519, details knocked out in #EAB2B1)</h3><div class="slots">${fin('filled')}</div></div></div>
<h3>In the bar (1x and 3x, each tab active in turn)</h3><div class="two"><img src="shots/bar-1x.png" alt="bar at 1x"><img src="shots/bar-3x.png" alt="bar at 3x"></div>
<h2>Rationale</h2><ul>
<li><b>Collection.</b> Two straight, closed landscape flash cards, the back one offset up-left, with two word lines on the front card. The back card stays an outline when the front fills. The top-right 7x7 badge zone is ink-free apart from a sliver under 0.4 unit. Rejected after in-bar review: tilted back card (reads as a handle or strap), narrower stacked edges (handbag), portrait offset deck (too close to the system copy glyph), crossed cards (backpack).</li>
<li><b>Calendar.</b> Squircle body, two pegs, header rule and a round "today" seed. Scaled to 94% so its ink matches the others.</li>
<li><b>Boards.</b> Uneven masonry: four squircle tiles in two columns of different heights, with one small round sticker inset in the top-left tile. No pill and no circle outline, so it cannot read as the digits "08"; the 3.2 unit gaps keep tiles separate; filled is the identical geometry, filled. The even 2x2 option was rejected as the generic apps grid; the banner-plus-two option as a widget.</li>
<li><b>Profile.</b> Designer-widened closed bust and head (head r 4.3, bust 3.6..20.4). Kept as is.</li>
<li><b>Camera.</b> Same corner logic as the tabs (squircle-tightened, body radius 4.5), a crest swell on top, a lens whose ring is exactly the stroke width (1.65) around a seed, and one flash dot. One evenodd path, so the disc colour shows through.</li></ul>
<p><b>Shared traits.</b> One corner radius scale (4.25 / 3.4 / 2.6) with squircle-tightened corners; round caps and joins; one stroke (1.65); and a "seed", a small round form that is the focal point (today dot, inset sticker, head, lens). Deliberately quiet.</p>
<h2>Grid and optical sizes</h2><p>24x24, live area 20x20 (2 unit margin). Keylines are drawn on the stroke's outer edge: circle d20, square 18, portrait 16x20, landscape 20x16. Boards is a square-keyline glyph (18x18 outer), Calendar a square with pegs poking above, Collection a portrait card with a deck edge, Profile a portrait. Nothing is circle-keyline, so no glyph needs the d20 overshoot. Outer bounding boxes are centred within 0.2 units of (12,12) (measured by rasterising at 16x). Ink area of the outlines: Collection 135, Calendar 135, Boards 139, Profile 99.</p><img src="shots/grid-8x.png" alt="8x with grid">
<h2>Stroke weight test</h2><p>Tested 1.5, 1.65 and 1.75 beside 11 pt Newsreader 500 at 1x and 3x. 1.5 goes spindly beside the serif's stems and the knocked-out details in the filled states thin out. 1.75 closes the 1.55-unit gaps in Boards and the deck. 1.65 (1.72 pt at 25 pt, about 5 px at @3x) holds both.</p><div class="two"><img src="shots/stroke-test-1x.png" alt="stroke test 1x"><img src="shots/stroke-test-3x.png" alt="stroke test 3x"></div>
<h2>Final at 1x and 3x</h2><div class="two"><img src="shots/final-1x.png" alt="1x"><img src="shots/final-3x.png" alt="3x"></div>
<h2>Explorations</h2><p>Three per glyph, outline and filled. Chosen ones are outlined. Rejected, with reasons: dot-and-line card interiors read as faces; a single tilted back card read as a padlock, then a mouse with a cable, and then a backpack in the filled state; a three-deep stack was too dense; the frame-with-stickers Boards looked like a photo icon; the avatar-ring Profile is too heavy when filled and has a different keyline than its neighbours.</p>${ex}
<h2>Self-critique, open issues</h2><ul><li>Collection is still two overlapping cards; the tilt, word lines and surviving back outline are what separate it from the system copy glyph. It is the weakest on distinctiveness. It is still two offset cards, so a copy reading is possible at a glance; landscape proportion and word lines are the differentiators.</li><li>Boards is the heaviest outline (ink 154 vs 130 to 135); 1.75 would worsen that, so 1.65 stays. It could read as an apps grid at a glance; the inset sticker and uneven heights are the differentiators.</li><li>The family trait (the seed) is subtle by design; if the owner wants more ownable character, the next step is custom label-matched details, not a bigger motif.</li></ul>
<h2>Handoff</h2><p>See <code>icons.json</code> and <code>TabIcon.reference.tsx</code>. Colour tokens are caller-supplied. Optional centring nudges are in the JSON under <code>meta.optionalNudge</code> (units of the 24 grid).</p>
</main></body></html>`;
fs.writeFileSync('icons.html', html);
