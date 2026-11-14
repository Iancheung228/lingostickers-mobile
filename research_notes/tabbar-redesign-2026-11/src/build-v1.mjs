// node build-index.mjs -> ../v1.html   (run after gen.mjs; imports its icon table)
import { writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICONS, CAM_BODY } from './gen.mjs';
const here = dirname(fileURLToPath(import.meta.url));

const svg = (name, filled, size = 72, color = '#9D4D51') =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="color:${color}">${filled ? ICONS[name].fill('#FAF4EA') : ICONS[name].out()}</svg>`;
const cam = (size = 72) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"><path d="${CAM_BODY}" fill="#9D4D51" stroke="#9D4D51"/><circle cx="12" cy="13.2" r="3.4" stroke="#FAF4EA"/></svg>`;
const names = ['collection', 'calendar', 'boards', 'profile'];
const iconSheet = `<div class="icons">${names.map(n => `<div><div class="pair">${svg(n, false, 72, '#85666A')}${svg(n, true)}</div><b>${n}</b></div>`).join('')}<div><div class="pair">${cam()}</div><b>scan (white body on terra pill; lens stroke = pill colour)</b></div></div>`;

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const code = Object.entries(ICONS).map(([n, i]) => `// ${n}\nout:  ${i.out()}\nfill: ${i.fill('KO')}`).join('\n\n') + `\n\n// camera body path (scan)\n${CAM_BODY}`;

const scores = {
  A: { b: 9, br: 8, c: 8, cl: 8, g: 8 },
  B: { b: 8, br: 7, c: 7, cl: 8, g: 5 },
  C: { b: 8, br: 9, c: 7, cl: 6, g: 7 },
  D: { b: 9, br: 7, c: 8, cl: 8, g: 8 },
};
const row = (k, label, extra = '') => {
  const s = scores[k]; const vals = Object.values(s); const min = Math.min(...vals);
  return `<tr><th>${label}</th>${vals.map(v => `<td class="${v >= 8 ? 'ok' : 'lo'}">${v}</td>`).join('')}<td><b>${(vals.reduce((a, b) => a + b) / 5).toFixed(1)}</b></td><td>${min >= 8 ? 'clears 8 on all five' : 'min ' + min + extra}</td></tr>`;
};

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tabi tab bar redesign</title>
<style>
@font-face{font-family:Newsreader;font-weight:500;src:url(fonts/Newsreader_500Medium.ttf)}
@font-face{font-family:Newsreader;font-weight:400;src:url(fonts/Newsreader_400Regular.ttf)}
:root{--cream:#FAF4EA;--blush:#E4A0A1;--terra:#9D4D51;--maroon:#662B31;--ink:#4A4340;--rose:#833F46;--line:#EADFD6}
*{box-sizing:border-box}
body{margin:0;background:var(--cream);color:var(--ink);font:400 17px/1.55 Newsreader,Georgia,serif}
main{max-width:1100px;margin:0 auto;padding:40px 24px 96px}
h1{font:500 40px/1.1 Newsreader,serif;color:var(--rose);margin:0 0 8px;letter-spacing:-.5px}
h2{font:500 28px/1.2 Newsreader,serif;color:var(--rose);margin:56px 0 12px;padding-top:24px;border-top:1px solid var(--line)}
h3{font:500 20px/1.3 Newsreader,serif;color:var(--maroon);margin:24px 0 6px}
p{margin:8px 0}.lede{font-size:19px;max-width:760px}
.band{background:var(--blush);color:var(--maroon);border-radius:0 0 24px 24px;margin:-40px -24px 32px;padding:56px 24px 28px}
.band h1{color:var(--maroon)}
img.shot{width:100%;border-radius:14px;display:block;background:#2b2224}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:20px}
@media(max-width:760px){.grid2{grid-template-columns:1fr}}
table{border-collapse:collapse;width:100%;font-size:15px;background:#fff;border-radius:12px;overflow:hidden}
th,td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
td.ok{color:#3F6E46;font-weight:700;text-align:center}td.lo{color:#A8434A;font-weight:700;text-align:center}
thead th{background:#F6EEDD;font-weight:500}
code,pre{font:500 13px/1.5 ui-monospace,Menlo,monospace}pre{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px;overflow:auto}
code{background:#F6EEDD;padding:1px 5px;border-radius:5px}
.tag{display:inline-block;font:700 12px ui-monospace,Menlo,monospace;letter-spacing:.4px;text-transform:uppercase;padding:3px 8px;border-radius:99px;background:#F2DCDC;color:var(--rose)}
.tag.rec{background:var(--terra);color:#fff}.tag.drop{background:#E9E4DD;color:#6b6460}
.icons{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px}
.icons>div{background:#fff;border-radius:14px;padding:14px;text-align:center}.pair{display:flex;gap:12px;justify-content:center;margin-bottom:6px}
.dir{margin-top:32px}ul{padding-left:20px}li{margin:4px 0}.small{font-size:15px;color:#6a5c5d}
.cmp{display:flex;gap:16px;align-items:flex-start}.cmp img{width:230px;border-radius:12px}
.rec-box{background:#fff;border:2px solid var(--terra);border-radius:18px;padding:8px 24px 20px;margin-top:16px}
</style></head><body><main>
<div class="band"><h1>Tab bar redesign</h1><p class="lede">Four directions for Tabi's five-slot bar, rendered at 393 x 852 pt on the real screens, scored harshly. Recommendation: <b>A, Docked Quiet</b>, with D as the floating alternative. JS-only, no native rebuild.</p></div>

<h2>1. Why the current bar reads "vibe coded"</h2>
<div class="cmp"><img src="shots/current-home.png" alt="Current bar on Home"><div>
<p>Checked against the code (<code>app/(tabs)/_layout.tsx</code>, <code>constants/tabBar.ts</code>) and the screenshots. Your guesses mostly hold; below are the confirmations, one correction and three new findings.</p>
<ul>
<li><b>Confirmed: baseline.</b> The camera label is absolutely positioned (<code>bottom: 8</code>) while the other four are centred in flow, so "Scan" sits about 7 pt lower than its neighbours. Visible in every screenshot.</li>
<li><b>Confirmed: weight and height.</b> 68 pt pill + 14 pt disc overhang + 30 pt floor = a 112 pt zone, plus a 32 pt page-colour fade above it. Apple's tab bar is 49 pt (83 pt with the home indicator). The e2 shadow (24 blur, 0.20 opacity) is the heaviest elevation in the app.</li>
<li><b>Confirmed: blob.</b> White rounded rect on blush is the loudest thing in the bar, but it is the least informative cue; the active label only shifts from maroon to inkDark, which is almost no change.</li>
<li><b>Confirmed: stock icons, with a twist.</b> The mismatch is semantic more than stylistic: an open book for "Collection" and a peeling-sticker page for "Boards" say nothing about flashcards or boards, and the two glyphs differ in density.</li>
<li><b>New finding: the disc is held up by its ring.</b> Terra on blush is only 2.7:1, so the 4 pt cream ring does the separating. That ring-on-pill-plus-shadow is exactly the template FAB look.</li>
<li><b>New finding: two rose slabs.</b> The header band (top) and the pill (bottom) are the same saturated colour, so the screen is bookended by two heavy blocks and the cream page between them feels squeezed.</li>
<li><b>New finding: the badge is the error colour.</b> <code>errorDeep</code> (a semantic red) is borrowed for a neutral count, and it sits on top of the icon, hiding the book's corner.</li>
<li><b>Overturned: "nothing is specific to this app."</b> The palette and serif already are. What is generic is the <i>structure</i> (floating pill, FAB, blob) and the icons. Floating itself is not the sin: iOS 26 floats its tab bar too. The sin is floating plus heavy plus ringed disc.</li>
</ul></div></div>

<h2>2. Research: what strong bars do</h2>
<p class="small">Sources and caveats in <code>NOTES.md</code>. Apple's HIG page is JS-rendered and could not be fetched, so some numbers are from secondary summaries or from my own knowledge of these apps and are marked as such.</p>
<table><thead><tr><th>Principle</th><th>What the evidence says</th><th>Applied here</th></tr></thead><tbody>
<tr><th>Height</th><td>iOS tab bar content is 49 pt, 83 pt with the home indicator (Babich; Apple forum thread on iOS 26 sizing). iOS 26 floats a glass bar over content and can minimise on scroll (WWDC25 323).</td><td>A: 49 + safe area. B/D: 58-62 pt floating capsules.</td></tr>
<tr><th>Icon and label</th><td>25 pt regular glyph, label SF 10 pt medium (Babich). Instagram, Threads, Airbnb, Things, Bear use ~24-26 pt glyphs; most hide labels only on image-led apps (Instagram, Threads, TikTok).</td><td>25 pt glyph, Newsreader 500 at 11 pt. Labels kept: a language app should not make a learner guess an icon.</td></tr>
<tr><th>Active state</th><td>Swap outline for a filled glyph and change colour: two cues, one of them not colour (UX guides; Apple SF Symbols convention). Duolingo and Airbnb add tint; none of the best use a blob behind both icon and label.</td><td>Outline/filled pairs in terra. No background shape.</td></tr>
<tr><th>Centre action</th><td>Instagram "+" and TikTok record sit <i>inline</i> as a distinct shape within the bar's row (rounded rect or plus-in-box), not a protruding disc. Raised FABs are the Material/Flutter template pattern. Some practitioners argue actions do not belong in tab bars at all; the owner has settled that.</td><td>A: terra rounded-rect inline. D: standalone terra circle at capsule height. Both share the row baseline.</td></tr>
<tr><th>Top edge</th><td>Native docked bars use a hairline (0.33-0.5 pt) with a material fill; floating glass uses a rim highlight and soft shadow. Heavy drop shadows are not a thing on strong apps.</td><td>A: 1 px border + faint 4.5% upward shadow. D: 1 px rose-tinted ring + a lighter shadow than e2.</td></tr>
<tr><th>Badges</th><td>A small count capsule on the icon's top-right, with a ring in the bar colour so it separates. Keep it off the glyph's ink.</td><td>Count pill offset to clear the glyph, 2 pt ring in the bar colour, "9+" cap.</td></tr>
</tbody></table>

<h2>3. The directions</h2>

<section class="dir"><h3>A &middot; Docked Quiet <span class="tag rec">Recommended</span></h3>
<img class="shot" src="shots/dir-a.png" alt="Direction A on four screens">
<p><b>Rationale.</b> A full-width cream bar, 49 pt plus the safe area, with a hairline on top and no fill competing with the rose header. The page and the bar become one surface, so the single saturated rose block on every screen is the header, which is where the brand should shout. The five slots share one 25 pt icon row and one 11 pt serif baseline; the Scan slot is a 52 x 30 terra rounded rectangle <i>inside</i> that row (same label baseline, no overhang), the way Instagram sets its create button. The only large terra shape in the bar is the one action, so the centre is unmistakable without a disc or ring. The identity comes from three app-specific things: Newsreader labels, a custom outline/filled icon set (flashcard stack for Collection, masonry tiles for Boards) and the terra accent. No gradient, no blob, no shadow.</p>
<img class="shot" src="shots/detail-a.png" alt="Direction A detail" style="margin-top:10px"></section>

<section class="dir"><h3>B &middot; Light Capsule <span class="tag drop">Dropped</span></h3>
<img class="shot" src="shots/dir-b.png" alt="Direction B on four screens">
<p><b>Rationale.</b> The "floating, done well" attempt in its most literal form: an off-white capsule with a 1 px rose ring and a light shadow, with a 50 pt terra disc contained inside it instead of protruding. It is lighter and shorter than today's bar and the centre is clear. But critique showed it is still a pill with a disc in it: the structure is the one the owner already dislikes, only quieter, and the unlabelled disc is bigger than the 25 pt icon row so the row has two scales. Dropped in favour of D, which solves the same brief with a less templated structure.</p>
<img class="shot" src="shots/detail-b.png" alt="Direction B detail" style="margin-top:10px"></section>

<section class="dir"><h3>C &middot; Bookend Band <span class="tag drop">Dropped</span></h3>
<img class="shot" src="shots/dir-c.png" alt="Direction C on four screens">
<p><b>Rationale.</b> The brand-first idea: the bar is a rose band with 24 pt top corners, the mirror of the header band's 24 pt bottom corners, so each screen is framed by two matching pieces. The centre is a cream disc with a terra camera (strong contrast on rose, where terra-on-rose is only 2.7:1). It is the most ownable of the four. It also fails on the criteria that matter day to day: it needs 88 pt to keep the Scan label on the shared baseline, it is the heaviest, the inactive label (4.0:1) misses AA, and cream-on-rose cannot carry the active state, so a tiny cream tick has to. Kept in the record as the brand-coloured option if the owner wants rose at the bottom.</p>
<img class="shot" src="shots/detail-c.png" alt="Direction C detail" style="margin-top:10px"></section>

<section class="dir"><h3>D &middot; Split Islands <span class="tag">Runner-up (floating)</span></h3>
<img class="shot" src="shots/dir-d.png" alt="Direction D on four screens">
<p><b>Rationale.</b> The floating option with some thought behind it. The bar is three separate pieces: a two-tab capsule, a free-standing terra circle, a two-tab capsule, all exactly 58 pt tall and 10 pt apart. Mirror symmetry is built into the geometry (the same 141.5 pt capsule on each side), the centre sits on the same row as every other item, and there is no overhang. It follows the iOS 26 pattern of a separate bubble for a special tab. The cost: content shows through the 10 pt gaps (visible in the last frame), it has no blur because <code>expo-blur</code> is not installed, the Scan circle has no visible label, and the three-piece shadow stack is more visual noise than A.</p>
<img class="shot" src="shots/detail-d.png" alt="Direction D detail" style="margin-top:10px"></section>

<h2>4. Harsh critique, scored from the PNGs</h2>
<p>1-10, judged from the rendered screenshots only. First-round findings that were fixed before this scoring: badge covering the Collection glyph (moved clear of the ink); C's Scan label sitting lower than the rest and its active tick clipping the rounded corner (bar made 88 pt, label gap fixed); the fourth frame originally used the wrong screen behind the bar; A's active Scan state was nearly indistinguishable (added an inset ring) and its ring first collided with the label (made inset); inactive tint moved from #7E5559 to #85666A so the terra active state separates more.</p>
<table><thead><tr><th>Direction</th><th>Balance / symmetry</th><th>Brand fit</th><th>Craft / alignment</th><th>Active + centre clarity</th><th>Not AI-generic</th><th>Mean</th><th>Verdict</th></tr></thead><tbody>
${row('A', 'A Docked Quiet')}${row('B', 'B Light Capsule', ': still a pill + disc')}${row('C', 'C Bookend Band', ': weak active state, heavy')}${row('D', 'D Split Islands', ': brand fit 7')}
</tbody></table>
<ul class="small">
<li><b>A</b>: balance 9 (mirror-perfect, one baseline). Brand 8 (the terra and serif carry it; it is deliberately restrained, so it will not win a "wow" contest). Craft 8 (all baselines align; the badge ring and Scan active ring are small details that could still be polished on device). Clarity 8 (the filled glyph plus the colour change plus the label; the Scan active state is subtle, but the screen itself says "camera"). Generic 8 (custom icons and the in-row pill avoid the template; a docked bar is by nature the least flashy).</li>
<li><b>B</b>: generic 5. It is the template pill with the volume down.</li>
<li><b>C</b>: clarity 6, because the active state is a 3 pt tick and a fill difference on a low-contrast rose ground; labels fail AA.</li>
<li><b>D</b>: brand 7. It could be any app's iOS 26 bar in rose; and see the see-through gaps and missing blur above.</li>
</ul>

<h2>5. Recommendation: A, Docked Quiet</h2>
<div class="rec-box">
<p>A is the only direction that scores 8+ on all five, it is the smallest change in layout (it hands back about 47 pt of vertical space on every screen), and it needs no native code. D is the one to pick if the owner wants a floating bar; it is a legitimate alternative, but it is a 7 on brand fit and no blur is available without a build.</p>
<h3>Dimensions</h3>
<table><tbody>
<tr><th>Bar</th><td>Full width, absolute, bottom 0. Height <code>49 + insets.bottom</code> (83 on a notched iPhone, 49 on a home-button one). Background <code>colors.cream</code> (opaque; no blur is available). Top border <code>StyleSheet.hairlineWidth</code> in <code>colors.border</code> (#EADFD6), plus an upward shadow <code>{color:'#662B31', opacity:0.045, radius:20, offset:{0,-8}}</code> (iOS only; on Android use <code>elevation: 0</code>).</td></tr>
<tr><th>Slot</th><td>Five equal slots (<code>flex: 1</code>), 6 pt horizontal padding on the row. Content column: <code>paddingTop 6</code>, icon row 26 pt, label <code>marginTop 2</code>, label line-height 13.</td></tr>
<tr><th>Icon</th><td>25 pt box, viewBox 24, stroke 1.7, round caps and joins. Outline when inactive, filled when active (see paths below).</td></tr>
<tr><th>Label</th><td><code>fonts.display</code> (Newsreader 500), 11 pt, <code>letterSpacing 0.1</code>, <code>maxFontSizeMultiplier 1.15</code>, one line.</td></tr>
<tr><th>Scan</th><td>52 x 30 rounded rectangle, radius 11, centred in the 26 pt icon row (sticks out 2 pt above and below, which does not move the label). White camera body, terra lens stroke, 23 pt. Label "Scan" on the same baseline as the others.</td></tr>
<tr><th>Badge</th><td>Min width 17, height 17, radius 9, padding 4 horizontally, <code>fonts.monoBold</code> 10.5 pt white on <code>colors.terra</code>. Position: left = icon centre + 8, top = -3, which clears the glyph's ink. 2 pt ring in <code>colors.cream</code> (a border on a wrapper, since RN has no spread shadow). "9+" at 10 or more. Hidden at 0.</td></tr>
</tbody></table>
<h3>Tokens and states</h3>
<table><thead><tr><th>State</th><th>Icon</th><th>Label</th><th>Scan pill</th></tr></thead><tbody>
<tr><td>Inactive</td><td>Outline, <code>#85666A</code> (4.7:1 on cream; add as <code>colors.tabInactive</code>, or use <code>inkLight</code> #7E5559 at 5.8:1 if the difference to terra looks too small on device)</td><td><code>#85666A</code></td><td><code>colors.terra</code> with a 1 px inset highlight <code>rgba(255,255,255,.2)</code></td></tr>
<tr><td>Active</td><td>Filled, <code>colors.terra</code> (5.3:1)</td><td><code>colors.terra</code></td><td><code>colors.terraDark</code> with an inset 1.5 px ring <code>rgba(250,244,234,.55)</code></td></tr>
<tr><td>Pressed</td><td>Opacity 0.6 for 80 ms (<code>press.in</code> from <code>lib/motion.ts</code>)</td><td>same</td><td>Scale 0.96 with <code>pressSpring</code></td></tr>
<tr><td>Disabled / offline</td><td>No state; every tab always works</td><td></td><td></td></tr>
</tbody></table>
<h3>Animation (reanimated, already installed)</h3>
<ul>
<li>Active change: cross-fade outline to filled over <code>dur.fast</code> (120 ms) with a 1.0 to 1.08 to 1.0 scale on the icon (<code>pressSpring</code>). Haptic <code>haptic.tap()</code> as now.</li>
<li>Reduce Motion: use <code>useReduceMotionSetting()</code> from <code>lib/motion.ts</code>; when true, swap instantly, no scale.</li>
<li>Badge: on count change a 120 ms scale pop; none under Reduce Motion.</li>
<li>No animated indicator, no layout animation.</li>
</ul>
<h3>Accessibility and platform</h3>
<ul>
<li>Keep <code>accessibilityRole="tab"</code>, label, selected state and <code>testID="tab-{name}"</code> exactly as in the current <code>Pressable</code> (<code>a11y</code> strings in <code>SLOTS</code> stay: "Scan a new sticker", "Collection, 3 due"). Maestro flows keep working.</li>
<li>Hit target: each slot is full bar height, minimum 49 x 72 pt; Scan's visible 52 x 30 is inside a 49 pt tall slot.</li>
<li>Dynamic Type: labels are capped at 1.15 and one line; at 12.65 pt "Collection" is about 58 pt wide in a 70.2 pt slot (shown in each detail image).</li>
<li>Keyboard: keep the existing <code>keyboardWillShow / keyboardWillHide</code> listener that returns <code>null</code>.</li>
<li>Scan screen: not full-bleed in this app (it is a cream page with a framed viewfinder), so the bar stays as it is. If it is ever made full-bleed, render the bar over it with <code>colors.cream</code> at full opacity rather than hiding it, since Scan is a tab.</li>
</ul>
<h3>Mapping onto the existing code</h3>
<ul>
<li><b><code>app/(tabs)/_layout.tsx</code></b>: keep <code>TabLayout</code>, <code>Tabs</code>, <code>SLOTS</code>, <code>press()</code>, the keyboard effect, <code>focusedName</code>, <code>badge</code> and a11y label logic untouched. Rename <code>PillTabBar</code> to <code>DockedTabBar</code>. Delete: the gradient fade (<code>Svg/Defs/Rect</code> block, <code>TAB_BAR_FADE</code>, <code>styles.fade</code>), <code>styles.pill</code>, <code>styles.highlight</code>, <code>HIGHLIGHT_RING</code>, <code>styles.disc / discHolder / labelCamera</code>, and the overflow-visible <code>wrap</code> and <code>row</code> (the pill needed them for the disc; the new Scan pill does not overhang). The slot body becomes: a 26 pt icon row (<code>TabIcon</code> or the camera pill) and one <code>Text</code>. Drop the <code>lucide-react-native</code> import for the tabs (it can stay in the app for other screens).</li>
<li><b>New <code>components/TabIcon.tsx</code></b>: a <code>react-native-svg</code> component taking <code>name</code>, <code>focused</code>, <code>color</code>, <code>knockout</code>; renders the outline or filled paths below at 25 pt. Camera glyph in the same file.</li>
<li><b><code>constants/tabBar.ts</code></b>: replace the exports with <code>TAB_BAR_CONTENT = 49</code> and a <code>tabBarHeight(insetBottom)</code> helper; set <code>TAB_BAR_CLEARANCE = 49</code> (down from 96). Remove <code>TAB_BAR_WIDTH / ITEM_WIDTH / DISC / DISC_OVERHANG / FLOOR</code> and <code>tabBarBottom</code>.</li>
<li><b>Screens</b> that use <code>insets.bottom + TAB_BAR_CLEARANCE</code> (<code>collection, calendar, wall, scan</code>, <code>AiConsentGate</code>, and <code>profile</code>'s <code>TAB_BAR_CLEARANCE + 34 + ...</code>) keep working unchanged, now with about 47 pt less dead space. <code>components/ToastProvider.tsx</code> line 195 computes <code>barTop</code> from <code>tabBarBottom / TAB_BAR_HEIGHT / TAB_BAR_DISC_OVERHANG</code>; change it to <code>tabBarHeight(insets.bottom) + 12</code>. Re-check each screen's bottom padding by eye: some add a literal 24 or 34 that was tuned to the old bar.</li>
<li><b>Colour</b>: add <code>tabInactive: '#85666A'</code> to <code>constants/theme.ts</code>. No other token changes; no re-theme.</li>
<li><b>Tests</b>: <code>.maestro/*.yaml</code> use <code>testID</code> / labels; they are unchanged. Run the harness QA on the Simulator after the change (<code>harness/qa.sh</code>) as AGENTS.md requires, and look at the badge, <code>Scan</code> active state and Dynamic Type 1.15x.</li>
</ul>
<h3>Icon set</h3>
<p>One 24 x 24 grid, 1.7 stroke, round caps and joins, outline for inactive and a filled partner for active (details knocked out in the bar colour, <code>KO</code> below).</p>
${iconSheet}
<pre>${esc(code)}</pre>
<h3>What needs a native build</h3>
<p><b>Nothing for A.</b> It uses only <code>react-native-svg</code> (15.12.1), <code>react-native-reanimated</code> (~4.1.1), <code>react-native-safe-area-context</code>, and fonts already bundled, so it ships by OTA. Direction D's glass (or a blurred bar for A) would need <code>expo-blur</code>, which is a native module not currently in <code>package.json</code>, so it would need a rationed EAS build; the mockups deliberately use opaque fills so what you see is what OTA can deliver.</p>
</div>
<p class="small" style="margin-top:32px">Mockups are generated from <code>src/gen.mjs</code> (HTML/CSS/SVG, real tokens, real screenshots behind the bar) and rendered with headless Chrome via <code>src/shoot.sh</code>. Fourth-frame cards are cropped copies of real card pixels, used only to show content scrolling behind the bar.</p>
</main></body></html>`;
writeFileSync(`${here}/../v1.html`, html);
