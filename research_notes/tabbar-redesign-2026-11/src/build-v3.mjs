import { writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeCrest, extent, curvJump, minRadius, gapProfile } from './geom.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const L = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const cr = (a, b) => { const x = L(a), y = L(b); return ((Math.max(x, y) + .05) / (Math.min(x, y) + .05)).toFixed(1); };

// crest numbers
const OLD = makeCrest({ type: 'hermite', rise: 15.5, gap: 5.5, th0: 33, half: 44, discR: 23 });
const NEW = makeCrest({ type: 'hermite', rise: 16.5, gap: 5.5, th0: 26, half: 50, discR: 22 });
const stat = (y, cy, r) => { const hi = extent(y), gs = gapProfile(y, cy, r).map(a => a[1]); return { j: curvJump(y, hi).toFixed(4), mr: minRadius(y, hi).toFixed(1), g: `${Math.min(...gs).toFixed(1)} to ${Math.max(...gs).toFixed(1)}`, reach: hi.toFixed(0) }; };
const sO = stat(OLD, 13, 23), sN = stat(NEW, 11, 22);
const RHO = 27.5, TH = 26 * Math.PI / 180, X0 = RHO * Math.sin(TH), Y0 = 11 - RHO * Math.cos(TH), D1 = Math.tan(TH), D2 = RHO * RHO / Math.pow(RHO * RHO - X0 * X0, 1.5);

// label metrics (measured in Chrome, Newsreader 500)
const PITCH = 66, C0 = 176.5 - 2 * PITCH;
const W11 = { Collection: 49.4, Calendar: 43.7 }, W12 = { Collection: 56.8, Calendar: 50.2 }, W14 = { Collection: 64.2, Calendar: 56.8 };
const edgeOff = 32 - Math.sqrt(32 * 32 - 14.5 * 14.5);
const clr = (cx0, w) => (cx0 - w / 2 - edgeOff).toFixed(1);
const gap = (p, a, b) => (p - (a + b) / 2).toFixed(1);

const S = { 'Balance / symmetry': 8, 'Brand fit': 8, 'Craft / alignment': 8, 'Active + centre clarity': 8, 'Not AI-generic': 7, 'Still the owner\'s bar': 8 };
const meanS = (Object.values(S).reduce((a, b) => a + b) / 6).toFixed(1);

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tabi tab bar, round 3: Crest final</title>
<style>
@font-face{font-family:Newsreader;font-weight:500;src:url(fonts/Newsreader_500Medium.ttf)}
@font-face{font-family:Newsreader;font-weight:400;src:url(fonts/Newsreader_400Regular.ttf)}
:root{--cream:#FAF4EA;--blush:#E4A0A1;--terra:#9D4D51;--maroon:#662B31;--ink:#4A4340;--rose:#833F46;--line:#EADFD6}
*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font:400 17px/1.55 Newsreader,Georgia,serif}
main{max-width:1180px;margin:0 auto;padding:40px 24px 96px}
h1{font:500 40px/1.1 Newsreader,serif;color:var(--maroon);margin:0 0 8px;letter-spacing:-.5px}
h2{font:500 28px/1.2 Newsreader,serif;color:var(--rose);margin:56px 0 12px;padding-top:24px;border-top:1px solid var(--line)}
h3{font:500 20px/1.3 Newsreader,serif;color:var(--maroon);margin:24px 0 6px}
p{margin:8px 0}.lede{font-size:19px;max-width:860px}
.band{background:var(--blush);color:var(--maroon);border-radius:0 0 24px 24px;margin:-40px -24px 32px;padding:56px 24px 28px}
img.shot{width:100%;border-radius:14px;display:block;background:#2b2224;margin-top:10px}
table{border-collapse:collapse;width:100%;font-size:15px;background:#fff;border-radius:12px;overflow:hidden;margin:8px 0}
th,td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
td.n{text-align:center;font-weight:700}td.ok{color:#3F6E46}td.lo{color:#A8434A}
thead th{background:#F6EEDD;font-weight:500}
code,pre{font:500 13px/1.5 ui-monospace,Menlo,monospace}pre{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px;overflow:auto}
code{background:#F6EEDD;padding:1px 5px;border-radius:5px}
.pick{background:#fff;border-left:4px solid var(--terra);padding:8px 14px;border-radius:8px;margin:12px 0}
ul{padding-left:20px}li{margin:4px 0}.small{font-size:15px;color:#6a5c5d}a{color:var(--terra)}
.slot{border:2px dashed var(--terra);border-radius:14px;padding:6px 18px 12px;background:#fff6f6;margin:16px 0}
</style></head><body><main>
<div class="band"><h1>Crest, round 3b: flat, matched to the app</h1>
<p class="lede">The final pass after an independent image-only critic scored v3.0 a 6 (balance 7, brand 6, craft 6, clarity 6, not-generic 5). Their fifteen defects are answered one by one in section 1; each fix was picked from renders at 1x and 6x. Motion demo: <a href="v3-motion.html">v3-motion.html</a>. Earlier: <a href="index.html">v2</a>, <a href="v1.html">v1</a>.</p></div>

<h2>1. The critic's findings and what I did</h2>
<table><thead><tr><th>#</th><th>Finding</th><th>Response</th></tr></thead><tbody>
<tr><td>1, 14</td><td>Active Collection and its dark badge merged into one blob; badge position varied with the count.</td><td>Badge is now cream <code>#FBF3EA</code> with a <code>#3A1519</code> numeral (${cr('#3A1519', '#FBF3EA')}:1) and a 2 pt ring in the pill colour. It is left-anchored at slot centre + 12 and grows right ("1", "3", "9+"), 16 pt high. Section 7.</td></tr>
<tr><td>2, 3, 13</td><td>Boards read as "08", Collection as a "copy" glyph, stroke weights uneven.</td><td>Redrawn by the icon artist (masonry tiles with an inset sticker; a word card with a tilted outline card behind it; one 1.65 stroke); integrated, section 10.</td></tr>
<tr><td>4</td><td>Active state triple-coded; the bar crowded the pill's bottom edge.</td><td>Compared (a) filled glyph + label only, (b) + dot and (c) + bar, both with 8 pt clearance. Picked (a): no indicator. Section 5.</td></tr>
<tr><td>5, 15</td><td>Scan active invisible; pressed barely differs from idle.</td><td>Active: inverted, a cream disc with a terra camera and a 2 pt terra inner stroke, so on the Scan screen it can never be mistaken for a second shutter (section 4). Pressed: scale 0.94 and a 10% darker fill. Section 4.</td></tr>
<tr><td>6</td><td>"Collection" too close to the pill's left end, worse at Dynamic Type 1.15x.</td><td>Slot pitch 70.6 became 66 (64 let the inner labels collide at 1.15x, per the second critic pass), so the outer centres sit 44.5 pt from the ends. Measured clearances in section 2b.</td></tr>
<tr><td>7</td><td>Disc nearly touching the "Scan" label.</td><td>Disc 46 to 44 pt and its centre 13 to 11 pt: its bottom edge (33.0) now equals the Calendar glyph's ink bottom (33.0), so the disc-to-label gap equals the other tabs' icon-to-label gap by construction. Section 3.</td></tr>
<tr><td>8, 9</td><td>Glossy disc; muddy gradient and highlight on the pill.</td><td>Both flat. Pill <code>#E4A0A1</code> = theme <code>blush</code> = the header band, exactly. Disc <code>#9D4D51</code> = theme <code>blushDeep</code>, the colour of "Review 1 now". One 1 pt inner stroke, one soft shadow, no highlight. Sections 3 and 4.</td></tr>
<tr><td>10</td><td>Weak edge and shadow on cream.</td><td>1 pt outer stroke <code>#D58A8E</code> (${cr('#D58A8E', '#FAF4EA')}:1 on cream) plus a 0 / 6 / 14 shadow at 20%. Section 4.</td></tr>
<tr><td>11</td><td>Content peeks below and around the pill.</td><td>A 28 pt cream fade that stays at 92% under the bar. Section 8.</td></tr>
<tr><td>12</td><td>Crest a little dome-like.</td><td>Widened from reach 41 to about 47 with the same 5.5 pt gap, still G2. Section 3.</td></tr>
<tr><td>labels</td><td>Medium weight; inactive at least 75% of maroon contrast.</td><td>Newsreader 500 throughout. Inactive <code>#5A2429</code> is ${cr('#5A2429', '#E4A0A1')}:1 on the pill (94% of maroon's ${cr('#662B31', '#E4A0A1')}:1, and AA); active <code>#3A1519</code> is ${cr('#3A1519', '#E4A0A1')}:1 (darkened again after the second critic pass, which perceived the lighter value as about 3.5:1). The two label colours are only 1.3:1 apart, so the filled glyph, not the label, carries the active state.</td></tr>
</tbody></table>
<img class="shot" src="shots/v3-final.png" alt="Before and after on four screens">

<h2>2. Spacing and proportions</h2>
<h3>2a. Pill size and margins</h3>
<img class="shot" src="shots/v3-proportions.png" alt="Pill proportions with the 20 pt content edges">
<div class="pick"><b>Pick: margin 20 (width 353), height 64, bottom 26.</b> Only at 20 pt do the pill's ends land on the screen's card and button edges (blue guides at 20 and 373 pt). Height 62 cramps the label under the disc; 68 grows heavy; bottom 22 crowds the home indicator, 30 floats.</div>
<h3>2b. Label clearance at Dynamic Type 1x, 1.15x, 1.3x</h3>
<img class="shot" src="shots/v3-spacing.png" alt="Label clearance, old pitch against new pitch">
<table><thead><tr><th></th><th>1x (11 pt)</th><th>1.15x (12.65 pt)</th><th>1.3x (14.3 pt)</th></tr></thead><tbody>
<tr><th>"Collection" width (measured, Newsreader 500)</th><td>${W11.Collection} pt</td><td>${W12.Collection} pt</td><td>${W14.Collection} pt</td></tr>
<tr><th>Old pitch 70.6: label to pill end</th><td class="lo">${clr(35.3, W11.Collection)} pt</td><td class="lo">${clr(35.3, W12.Collection)} pt</td><td class="lo">${clr(35.3, W14.Collection)} pt (clipped)</td></tr>
<tr><th><b>Pitch 66: label to pill end</b></th><td class="ok n">${clr(C0, W11.Collection)} pt</td><td class="ok n">${clr(C0, W12.Collection)} pt</td><td class="n">${clr(C0, W14.Collection)} pt</td></tr>
<tr><th>Pitch 66: Collection to Calendar</th><td>${gap(PITCH, W11.Collection, W11.Calendar)} pt</td><td>${gap(PITCH, W12.Collection, W12.Calendar)} pt</td><td>${gap(PITCH, W14.Collection, W14.Calendar)} pt</td></tr>
</tbody></table>
<p class="small">Clearance is measured horizontally from the label's left edge to the pill's outline at the label's height (the end cap curves in by ${edgeOff.toFixed(1)} pt there). The app caps tab labels at <code>maxFontSizeMultiplier 1.15</code>, so an OS setting of 1.3x renders at 1.15x: ${clr(C0, W12.Collection)} pt clearance, ${gap(PITCH, W12.Collection, W12.Calendar)} pt between labels. The 1.3x column is what would happen if the cap were lifted; it still clears 12.9 pt at the end but the two labels nearly touch, so keep the cap. Symmetric: the pitch is the same on both sides of the disc.</p>

<h2>3. Crest, disc and the "Scan" label</h2>
<img class="shot" src="shots/v3-geometry.png" alt="Crest v3.0 against the widened swell at 6x with curvature combs">
<table><thead><tr><th></th><th>Curvature step per 0.05 pt</th><th>Tightest radius</th><th>Gap disc to crest (+-55 deg)</th><th>Reach</th></tr></thead><tbody>
<tr><th>v3.0 (disc 46, rise 15.5, shoulder 44)</th><td>${sO.j}</td><td>${sO.mr} pt</td><td>${sO.g} pt</td><td>&plusmn;${sO.reach}</td></tr>
<tr><th><b>Now (disc 44, rise 16.5, 26 deg, shoulder 50)</b></th><td>${sN.j}</td><td>${sN.mr} pt</td><td>${sN.g} pt</td><td>&plusmn;${sN.reach} (about 48 at the tails)</td></tr>
</tbody></table>
<div class="pick">The shoulder now leaves the crown at 26 degrees instead of 33 and runs 50 pt out instead of 44, which turns the dome into a swell; the curvature comb shows no step (${sN.j}, against ${sO.j} for v3.0; the v2 cubic was 0.0324), the gap is still 5.5 to ${sN.g.split(' to ')[1]} pt, and nothing dips below the pill's top line. The disc dropped from 46 to 44 pt and rose from 13 to 11 pt below the crest base so its bottom equals the icons' ink bottom: the "Scan" label now sits the same distance below the disc as the other labels sit below their glyphs (at 6x in the final-zoom image, 52 px against 52 px).</div>

<h2>4. Surface and centre piece (flat)</h2>
<img class="shot" src="shots/v3-surface.png" alt="Edge and shadow variants on cream">
<img class="shot" src="shots/v3-surface-photos.png" alt="Chosen edge over photos and the dark frame">
<div class="pick"><b>Pick: flat <code>#E4A0A1</code> pill, 1 pt outer stroke <code>#D58A8E</code> (E1), shadow SH1: 0 / 6 / 14, <code>#8A3A44</code> at 20%.</b> Without the stroke (E0) the pill dissolves into the cream (the pill/cream contrast is only ${cr('#E4A0A1', '#FAF4EA')}:1). The top hairline (E2) adds nothing. SH3 (stronger, two layers) throws a pink halo on a dark ground; SH1 stays a soft lift. The one thing the pill keeps that the app's cards lack is that outline; it is the "very subtle edge treatment" that earns its place.</div>
<img class="shot" src="shots/v3-disc.png" alt="Flat disc idle, active and pressed at 6x">
<img class="shot" src="shots/v3-scan-screen.png" alt="Scan screen, idle and active">
<div class="pick"><b>Scan-screen decision:</b> three active treatments were rendered on the real Scan screen: darker disc + 3 pt ring (A), muted + 2 pt ring (B), inverted (C, cream disc with a terra camera). A and B still read as a second rose shutter 170 pt below the first; C does not, so C is the pick. <b>Idle disc</b> gets a 1.5 pt light (cream, 60%) outer stroke, which stops it going muddy over a photo grid and costs nothing on cream. <b>Disc:</b> flat <code>#9D4D51</code> (white camera on it ${cr('#FFFFFF', '#9D4D51')}:1), 1 pt inner stroke <code>#833F46</code>, shadow 0 / 3 / 8 at 25%. <b>Active:</b> fill <code>#FBF3EA</code>, camera <code>#9D4D51</code>, 2 pt terra inner stroke, no ring. <b>Pressed:</b> <code>#8D4549</code> (10% darker than idle), scale 0.94, shadow tightened to 0 / 1 / 3, no ring. On the Scan screen the active disc is plainly different from idle even though the shutter above it shares the terracotta; the cream ring is what the shutter does not have.</div>

<h2>5. The active state: how many cues?</h2>
<img class="shot" src="shots/v3-active.png" alt="Active state: no indicator, dot, bar">
<div class="pick"><b>Pick (a): the filled glyph plus the darker label, no indicator.</b> The dot (b) and the bar (c) needed the pill to grow to 66 pt to leave 8 pt below them, and neither adds information: the filled glyph is already unmistakable at 1x. Honest limit: the label colours are only 1.3:1 apart, so on a tab with an ambiguous glyph the label alone would not carry the state. If the owner wants a second cue, (b) is the quiet one. Motion consequence: there is no sliding indicator any more; the active change is the glyph cross-fade and pop.</div>

<h2>6. Content behind the bar</h2>
<img class="shot" src="shots/v3-fade.png" alt="No fade against a 28 pt cream fade">
<div class="pick"><b>Pick: the 28 pt cream fade (92%, solid below the pill).</b> Without it, card text is sliced by the crest and thumbnails show in the gap between the pill and the home indicator. With it, those fade away, and the crest has clean cream around it. It is 28 pt rather than the old 32 pt slab and stops at 92%, so scrolling content is still faintly visible under the pill's edge.</div>

<h2>7. Badge</h2>
<img class="shot" src="shots/v3-badge.png" alt="Badge at 1, 3 and 9+">
<p>Cream <code>#FBF3EA</code>, numeral <code>#3A1519</code> in <code>fonts.monoBold</code> 10.5 pt, 16 pt high, 4 pt horizontal padding, 2 pt ring in the pill colour <code>#E4A0A1</code>, left edge at slot centre + 12 and top at 4.5, growing right. The artist kept the top-right 7 x 7 zone of the Collection glyph clear, and the render confirms the badge sits beside it.</p>

<h2>8. Labels: show the word, or remove it?</h2>
<img class="shot" src="shots/v3-labels-states.png" alt="Label variants a to d">
<img class="shot" src="shots/v3-labels-screens.png" alt="Label variants on real screens">
<table><thead><tr><th>Variant</th><th>First-use clarity</th><th>Beauty</th><th>Balance</th></tr></thead><tbody>
<tr><th>(a) all five labels</th><td class="n ok">9</td><td class="n">7</td><td class="n ok">9</td></tr>
<tr><th>(b) no labels, pill 56</th><td class="n lo">6</td><td class="n ok">9</td><td class="n ok">8</td></tr>
<tr><th>(c) label on the active tab only</th><td class="n">7</td><td class="n lo">6</td><td class="n lo">5</td></tr>
<tr><th>(d) labels on the sides, none under Scan</th><td class="n">8</td><td class="n">7</td><td class="n lo">6</td></tr>
</tbody></table>
<div class="pick"><b>Recommendation: (a), all five labels.</b> The critic, who saw only images, reached the same conclusion: two of the five glyphs are abstract and the audience is new learners. The labels cost 12 pt of pill height and give the bar its serif voice. (d) is the cleanest under the disc, but the empty slot reads as unfinished. VoiceOver is unaffected either way: every tab keeps its <code>accessibilityLabel</code>. If a five-person test shows people can name the four tabs from the icons alone, (b) is the prettier switch (one prop and the pill height).</div>

<h2>9. Final renders and critique</h2>
<img class="shot" src="shots/v3-final-states.png" alt="Every state">
<img class="shot" src="shots/v3-final-zoom.png" alt="Final bar at 6x">
<h3>Scores, harsher</h3>
<p>From the PNGs at 1x and 6x, with the critic's report as the baseline. The critic gave 7, 6, 6, 6, 5 (overall 6); I give:</p>
<table><thead><tr>${Object.keys(S).map(k => `<th>${k}</th>`).join('')}<th>Mean</th></tr></thead><tbody><tr>${Object.values(S).map(v => `<td class="n ${v >= 8 ? 'ok' : 'lo'}">${v}</td>`).join('')}<td class="n">${meanS}</td></tr></tbody></table>
<ul class="small">
<li><b>Balance 8:</b> mirror-symmetric, even pitch, crest centred; the end caps now carry 48 pt of air to the outer glyph centres, which reads slightly roomy next to the tight centre.</li>
<li><b>Brand 8:</b> the flat pill is exactly the header colour and the disc is exactly the app's button colour, the labels are the serif; the one thing that is not elsewhere in the app is the outline stroke.</li>
<li><b>Craft 8:</b> the final Collection glyph (two closed flash cards) no longer reads as a bag;  G2 crest, one baseline, equal disc and glyph gaps, measured label clearances. Open: the SVG-silhouette shadow is unproven on a device; the Collection glyph's tilted back card is the busiest shape at 1x; the Boards sticker is a small dot at 1x.</li>
<li><b>Clarity 8:</b> filled glyph is clear; Scan active is now visible; the label colour pair (1.3:1) is weak.</li>
<li><b>Not generic 7:</b> flat colour that merges with the app helps, and the concentric crest is Tabi's own, but a raised-centre pill remains a known pattern; at this size the crest is a refinement, not a signature.</li>
<li><b>Owner's bar 8:</b> same rose pill, raised camera and Scan label; the disc is smaller (44 vs 60) and flat, the pill narrower in its content.</li></ul>

<h2>10. The icons (the artist's final set, integrated)</h2>
<p><code>icons-v3/icons.json</code> and <code>TabIcon.reference.tsx</code> are the source of truth; <code>src/icons-slot.mjs</code> reads the JSON for every mockup. Rendered at 24 pt in the 25 pt slot box (left = slot centre - 12, top = 11.5), stroke 1.65, camera as one evenodd path at 25 pt (ink about 18.5 pt wide on a 44 pt disc, 42%). Knockout colour is now the flat pill colour <code>#E4A0A1</code> (the artist's file says <code>#E5A1A2</code>, sampled from the old gradient; pass the pill colour as <code>knockout</code>). Run <code>node src/ink.mjs</code> for ink and bounding boxes: collection 134 / 222, calendar 128 / 236, boards 154 / 237, profile 111 / 212 (outline / filled; Profile carries the optical-weight tweak noted in <code>icons.json</code> <code>meta.changes</code>).</p>
<div class="slot"><p><b>To change an icon:</b> edit <code>icons-v3/icons.json</code>, then run <code>src/render-all.sh</code> (regenerates all shots, the motion demo and this page).</p></div>

<h2>11. Final implementation spec (replaces v2 and v3.0)</h2>
<h3>Geometry (pt, 393 wide, notched phone)</h3>
<table><tbody>
<tr><th>Pill</th><td>Width <code>W = screenWidth - 40</code> (353; clamp 300 to 420), height 64, radius 32, left 20, bottom <code>max(insets.bottom - 8, 18)</code> (26 on notched phones). Flat <code>#E4A0A1</code> (<code>colors.blush</code>), 1 pt outer stroke <code>#D58A8E</code>.</td></tr>
<tr><th>Slots</th><td>Centres at <code>x = W/2 + (i - 2) * 66</code> for i = 0..4 (44.5, 110.5, 176.5, 242.5, 308.5). Hit areas 66 wide, the two outer ones extended 16 pt to the pill ends; Scan's is 84 tall to cover the crest.</td></tr>
<tr><th>Icon, label, badge</th><td>Icon 24 x 24 at <code>left = centre - 12, top = 11.5</code>. Label 11 pt / 13 at top 40, <code>fonts.display</code>, one line, <code>maxFontSizeMultiplier 1.15</code>. Badge <code>left = centre + 12, top = 4.5</code>, min 16 x 16, grows right.</td></tr>
<tr><th>Crest</th><td>Crown circle radius <code>RHO = 27.5</code> (disc radius 22 + gap 5.5) centred on the disc, 11 pt below the pill top, so the crown peaks 16.5 pt above it. Joins a quintic Hermite shoulder at 26 degrees (<code>X0 = ${X0.toFixed(2)}</code>, <code>Y0 = ${Y0.toFixed(2)}</code>, slope <code>${D1.toFixed(4)}</code>, curvature <code>${D2.toFixed(4)}</code>) that meets the flat top at <code>dx = 50</code> with zero slope and curvature.</td></tr>
<tr><th>Disc</th><td>44 pt, centred, centre 11 pt below the pill top (bottom edge 33.0 = the glyphs' ink bottom). Camera 25 pt. Hit target at least 44 x 44.</td></tr>
<tr><th>Clearance</th><td><code>TAB_BAR_CLEARANCE = tabBarBottom + 64 + 17 - insets.bottom</code> = 73 on a notched phone (was 96); the fade is added on top of it (screens pad their content by this clearance as now).</td></tr>
<tr><th>Fade</th><td>A <code>pointerEvents="none"</code> cream gradient behind the bar: transparent at <code>pillTop - 17</code> to <code>rgba(250,244,234,.92)</code> 28 pt lower, then solid to the screen bottom.</td></tr>
</tbody></table>
<h3>Path (TypeScript, pure, memoise by width)</h3>
<pre>${esc(`const RHO = 27.5, DISC_CY = 11, TH0 = (26 * Math.PI) / 180, HALF = 50, H = 64, R = H / 2;
const X0 = RHO * Math.sin(TH0);
const Y0 = DISC_CY - RHO * Math.cos(TH0);
const D1 = Math.tan(TH0);
const D2 = (RHO * RHO) / Math.pow(RHO * RHO - X0 * X0, 1.5);
const L = HALF - X0;

/** Top-edge height relative to the pill's flat top; negative = up. */
export function crestY(dx: number): number {
  dx = Math.abs(dx);
  if (dx <= X0) return DISC_CY - Math.sqrt(RHO * RHO - dx * dx);   // concentric crown
  if (dx >= HALF) return 0;                                         // flat top
  const s = (dx - X0) / L, s3 = s ** 3, s4 = s ** 4, s5 = s ** 5;
  return Y0 * (1 - 10 * s3 + 15 * s4 - 6 * s5)                      // quintic Hermite, G2 at both ends
       + D1 * L * (s - 6 * s3 + 8 * s4 - 3 * s5)
       + D2 * L * L * (0.5 * s * s - 1.5 * s3 + 1.5 * s4 - 0.5 * s5);
}

export function pillPath(W: number): string {
  const c = W / 2;
  let d = \`M\${R},0\`;
  for (let x = R; x <= W - R; x += 1) d += \` L\${x},\${crestY(x - c).toFixed(2)}\`;
  return d + \` L\${W - R},0 A\${R},\${R} 0 0 1 \${W - R},\${H} H\${R} A\${R},\${R} 0 0 1 \${R},0 Z\`;
}   // Svg viewBox: \`0 -20 \${W} \${H + 20}\``)}</pre>
<h3>Tokens (<code>constants/tabBar.ts</code>; all colours are existing theme tokens except where marked)</h3>
<pre>${esc(`export const TAB = {
  height: 64, radius: 32, margin: 20, pitch: 66, crest: 17, discSize: 44, discCy: 11, camera: 25,
  iconSize: 24, iconTop: 11.5, labelTop: 40, labelSize: 11,
  pill: '#E4A0A1',            // colors.blush
  pillEdge: '#D58A8E',        // NEW: 1 pt outer stroke
  disc: '#9D4D51',            // colors.blushDeep (terra)
  discStroke: '#833F46',      // colors.terraDark, 1 pt inside
  discActive: '#FBF3EA', discActiveGlyph: '#9D4D51', discActiveStroke: '#9D4D51', discPressed: '#8D4549', discRing: '#FBF3EA',
  inkOff: '#5A2429', inkOn: '#3A1519',   // NEW: inactive / active ink (labels and glyphs)
  badge: { bg: '#FBF3EA', text: '#3A1519', ring: '#E4A0A1', left: 12, top: 4.5 },
  shadowPill: { color: '#8A3A44', opacity: 0.20, dy: 6, radius: 14 },     // CSS blur 14 = SVG stdDeviation 7
  shadowDisc: { color: '#662B31', opacity: 0.25, dy: 3, radius: 8 },
  fade: { height: 28, opacity: 0.92, color: '#FAF4EA' },
};`)}</pre>
<h3>Rendering notes (react-native-svg 15.12.1)</h3>
<ul>
<li><b>Pill:</b> one <code>Path</code> with the outline in <code>pillEdge</code> (<code>strokeWidth 2</code>, drawn first so half shows outside) and the flat fill on top. No gradients anywhere.</li>
<li><b>Shadow (not yet run on a device; verify first):</b> option 1: <code>Filter</code> with <code>FeDropShadow</code> (dy 6, stdDeviation 7, opacity 0.20), both exported by 15.12.1. Option 2: a wrapper <code>View</code> with a transparent background and iOS shadow props, which on iOS casts from the rendered content so it should follow the crest. Option 3, always works: three offset copies of the path at 0.07 / 0.05 / 0.03 opacity, dy 2 / 5 / 9.</li>
<li><b>Disc:</b> a round <code>View</code> (44, <code>borderRadius</code> 22) with <code>backgroundColor</code>, a 1 pt <code>borderColor</code> inside (use <code>borderWidth 1</code>), native shadow props for <code>shadowDisc</code>, the camera <code>Svg</code> inside. Active swaps fill and glyph colour (no ring).</li>
</ul>
<h3>States</h3>
<table><thead><tr><th>State</th><th>Glyph</th><th>Label</th><th>Disc</th></tr></thead><tbody>
<tr><td>Inactive tab</td><td>Outline <code>#5A2429</code></td><td><code>#5A2429</code> (${cr('#5A2429', '#E4A0A1')}:1)</td><td>-</td></tr>
<tr><td>Active tab</td><td>Filled <code>#3A1519</code>, details knocked out in <code>#E4A0A1</code></td><td><code>#3A1519</code> (${cr('#3A1519', '#E4A0A1')}:1)</td><td>-</td></tr>
<tr><td>Scan idle</td><td colspan="2">Camera white, label <code>#5A2429</code></td><td><code>#9D4D51</code>, 1 pt inner <code>#833F46</code></td></tr>
<tr><td>Scan active</td><td colspan="2">Label <code>#3A1519</code></td><td>Inverted: <code>#FBF3EA</code> fill, terra camera, 2 pt terra inner stroke</td></tr>
<tr><td>Pressed (tabs)</td><td colspan="2">Opacity 0.6</td><td>-</td></tr>
<tr><td>Pressed (Scan)</td><td colspan="2">-</td><td>Scale 0.94, <code>#8D4549</code>, shadow dy 1, no ring</td></tr>
</tbody></table>
<h3>Motion (reanimated ~4.1; constants from <code>lib/motion.ts</code>)</h3>
<table><thead><tr><th>Element</th><th>Spec</th></tr></thead><tbody>
<tr><td>Tab change</td><td>Stack outline and filled glyphs; cross-fade 120 ms (<code>dur.fast</code>); pop scale 1 to 1.08 in 70 ms then <code>withSpring(1, pressSpring)</code>. Label colour via <code>interpolateColor</code> over 120 ms. No indicator, so nothing slides.</td></tr>
<tr><td>Scan press</td><td>In <code>withTiming(0.94, { duration: 80 })</code>; out <code>withSpring(1, { damping: 14, stiffness: 400 })</code> (a slight bounce). Fill snaps to <code>#8D4549</code> on press-in.</td></tr>
<tr><td>Scan active</td><td>Cross-fade disc fill and glyph colour, 120 ms.</td></tr>
<tr><td>Badge</td><td>1 to 1.25 over 120 ms, back to 1 over 120 ms on a count change.</td></tr>
<tr><td>Haptic</td><td><code>haptic.tap()</code> on tab change as now; <code>haptic.press()</code> on Scan press-in.</td></tr>
<tr><td><b>Reduce Motion</b></td><td>Opacity fades only (cap 120 ms); no scale; Scan press dims to 0.85 opacity.</td></tr>
</tbody></table>
<p>Demo: <a href="v3-motion.html">v3-motion.html</a>.</p>
<h3>Accessibility</h3>
<ul>
<li>Roles, labels, selected state and <code>testID="tab-{name}"</code> exactly as in the current <code>Pressable</code>s; Maestro flows unaffected.</li>
<li>Contrast: inactive ${cr('#5A2429', '#E4A0A1')}:1, active ${cr('#3A1519', '#E4A0A1')}:1, badge numeral ${cr('#3A1519', '#FBF3EA')}:1, camera on the disc ${cr('#FFFFFF', '#9D4D51')}:1, terra camera on the active cream disc ${cr('#9D4D51', '#FBF3EA')}:1. Non-text: the disc against the pill is ${cr('#9D4D51', '#E4A0A1')}:1, so it relies on its 1 pt stroke and its position, not colour alone.</li>
<li>Dynamic Type 1.15 cap as measured in 2b. Keyboard: keep the existing hide-on-keyboard effect.</li>
</ul>
<h3>Mapping onto <code>app/(tabs)/_layout.tsx</code></h3>
<ul>
<li><b>Keep:</b> <code>TabLayout</code>, <code>Tabs</code> config, <code>SLOTS</code>, <code>press()</code>, keyboard effect, <code>focusedName</code>, badge and a11y-label logic, and the overflow-visible <code>wrap</code> and <code>row</code> (the crest needs a parent that contains it).</li>
<li><b>Delete:</b> the old fade slab (<code>TAB_BAR_FADE</code>, <code>styles.fade</code>, its gradient), <code>HIGHLIGHT_RING</code> and <code>styles.highlight</code>, <code>styles.pill</code>, the disc's cream border and <code>e2</code>, and <code>labelCamera</code>.</li>
<li><b>Add:</b> <code>components/TabBarShape.tsx</code> (Svg: shape, stroke, shadow), <code>components/TabDisc.tsx</code>, <code>components/TabIcon.tsx</code> (the artist's reference component), <code>components/TabBarFade.tsx</code> (the 28 pt cream gradient, built with the Svg gradient already used by the old fade).</li>
<li><b>Slot body</b> is the same for all five: the icon box, then the label, both from <code>TAB</code>. Scan's icon box is empty; the disc is absolutely positioned at <code>top: TAB.discCy - 22</code>; "Scan" is a normal label.</li>
<li><b><code>constants/tabBar.ts</code></b>: replace the width/height/disc exports with <code>TAB</code>. <code>tabBarBottom(inset) = Math.max(inset - 8, 18)</code>. <code>TAB_BAR_CLEARANCE</code> as above (73, was 96). Screens using <code>insets.bottom + TAB_BAR_CLEARANCE</code> need no change; check by eye the ones with literal additions.</li>
<li><b><code>components/ToastProvider.tsx</code> line 195:</b> change <code>TAB_BAR_HEIGHT + TAB_BAR_DISC_OVERHANG + tabBarBottom</code> to <code>tabBarBottom + TAB.height + TAB.crest + 12</code>.</li>
<li><b>Verify</b> with <code>harness/qa.sh</code> on the Simulator: the crest shadow on cream, the inverted Scan disc on the camera screen, the badge at 9+, Dynamic Type 1.15 and Reduce Motion.</li>
</ul>
<h3>Native build</h3>
<p><b>None.</b> react-native-svg 15.12.1, reanimated ~4.1.1, safe-area-context, expo-haptics and the bundled fonts only; ships by OTA. No blur. Per AGENTS.md, no <code>eas update</code> or build without the owner's yes.</p>

<p class="small" style="margin-top:32px">Files this page references: <code>shots/v3-final.png</code>, <code>v3-proportions.png</code>, <code>v3-spacing.png</code>, <code>v3-geometry.png</code>, <code>v3-surface.png</code>, <code>v3-surface-photos.png</code>, <code>v3-disc.png</code>, <code>v3-scan-screen.png</code>, <code>v3-active.png</code>, <code>v3-fade.png</code>, <code>v3-badge.png</code>, <code>v3-labels-states.png</code>, <code>v3-labels-screens.png</code>, <code>v3-final-states.png</code>, <code>v3-final-zoom.png</code>; <code>v3-motion.html</code>; <code>fonts/Newsreader_*.ttf</code>; <code>index.html</code> (v2) and <code>v1.html</code> as links; <code>icons-v3/icons.json</code> and <code>icons-v3/TabIcon.reference.tsx</code> as named sources.</p>
</main></body></html>`;
writeFileSync(`${here}/../v3.html`, html);
