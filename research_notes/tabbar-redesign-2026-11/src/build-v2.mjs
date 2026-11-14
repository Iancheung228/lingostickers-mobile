// node build-v2.mjs -> ../index.html (round 2)
import { writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICONS, CAM_BODY } from './gen.mjs';
const here = dirname(fileURLToPath(import.meta.url));

const L = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const cr = (a, b) => { const x = L(a), y = L(b); return ((Math.max(x, y) + .05) / (Math.min(x, y) + .05)).toFixed(1); };
const CR = {
  offTop: cr('#5A2429', '#EBAEAF'), offBot: cr('#5A2429', '#E09A9B'), onBlush: cr('#3A1519', '#E4A0A1'),
  oldLabel: cr('#662B31', '#E4A0A1'), oldDisc: cr('#9D4D51', '#E4A0A1'), discNew: cr('#A85A5E', '#E4A0A1'),
  badge: cr('#FAF4EA', '#662B31'), cap: cr('#3A1519', '#F3D6CF'), white: cr('#FFFFFF', '#92454A'),
};
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const paths = Object.entries(ICONS).map(([n, i]) => `// ${n}\nout:  ${i.out()}\nfill: ${i.fill('KO')}`).join('\n\n') + `\n\n// camera body (Scan)\n${CAM_BODY}`;

const S = {
  R1: [8, 9, 8, 8, 7, 10],
  R2: [8, 8, 8, 8, 7, 9],
  R3: [8, 8, 8, 8, 8, 8],
};
const crit = ['Balance / symmetry', 'Brand fit', 'Craft / alignment', 'Active + centre clarity', 'Not AI-generic', 'Still the owner\'s bar'];
const tr = (k, name, note) => `<tr><th>${name}</th>${S[k].map(v => `<td class="${v >= 8 ? 'ok' : 'lo'}">${v}</td>`).join('')}<td><b>${(S[k].reduce((a, b) => a + b) / 6).toFixed(1)}</b></td><td>${note}</td></tr>`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tabi tab bar redesign, round 2</title>
<style>
@font-face{font-family:Newsreader;font-weight:500;src:url(fonts/Newsreader_500Medium.ttf)}
@font-face{font-family:Newsreader;font-weight:400;src:url(fonts/Newsreader_400Regular.ttf)}
:root{--cream:#FAF4EA;--blush:#E4A0A1;--terra:#9D4D51;--maroon:#662B31;--ink:#4A4340;--rose:#833F46;--line:#EADFD6}
*{box-sizing:border-box}
body{margin:0;background:var(--cream);color:var(--ink);font:400 17px/1.55 Newsreader,Georgia,serif}
main{max-width:1160px;margin:0 auto;padding:40px 24px 96px}
h1{font:500 40px/1.1 Newsreader,serif;color:var(--maroon);margin:0 0 8px;letter-spacing:-.5px}
h2{font:500 28px/1.2 Newsreader,serif;color:var(--rose);margin:56px 0 12px;padding-top:24px;border-top:1px solid var(--line)}
h3{font:500 20px/1.3 Newsreader,serif;color:var(--maroon);margin:24px 0 6px}
p{margin:8px 0}.lede{font-size:19px;max-width:800px}
.band{background:var(--blush);color:var(--maroon);border-radius:0 0 24px 24px;margin:-40px -24px 32px;padding:56px 24px 28px}
img.shot{width:100%;border-radius:14px;display:block;background:#2b2224;margin-top:10px}
table{border-collapse:collapse;width:100%;font-size:15px;background:#fff;border-radius:12px;overflow:hidden}
th,td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
td.ok{color:#3F6E46;font-weight:700;text-align:center}td.lo{color:#A8434A;font-weight:700;text-align:center}
thead th{background:#F6EEDD;font-weight:500}
code,pre{font:500 13px/1.5 ui-monospace,Menlo,monospace}pre{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px;overflow:auto}
code{background:#F6EEDD;padding:1px 5px;border-radius:5px}
.tag{display:inline-block;font:700 12px ui-monospace,Menlo,monospace;letter-spacing:.4px;text-transform:uppercase;padding:3px 8px;border-radius:99px;background:#F2DCDC;color:var(--rose)}
.tag.rec{background:var(--terra);color:#fff}
.dir{margin-top:32px}ul{padding-left:20px}li{margin:4px 0}.small{font-size:15px;color:#6a5c5d}
.pair2{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:760px){.pair2{grid-template-columns:1fr}}
.rec-box{background:#fff;border:2px solid var(--terra);border-radius:18px;padding:8px 24px 20px;margin-top:16px}
a{color:var(--terra)}
</style></head><body><main>
<div class="band"><h1>Tab bar, round 2: keep the rose pill, make it a designed object</h1>
<p class="lede">Three refinements of the current floating rose pill with the raised camera, at increasing degrees of change. Each is rendered on the real screens with the current bar beside it. Recommendation: <b>R3, Crest</b> (the only one that clears 8 on all six criteria), with <b>R2</b> as the lower-risk fallback. Round 1 (docked/quiet directions, rejected by the owner) is kept at <a href="v1.html">v1.html</a>.</p></div>

<h2>1. What changes, and why (diagnosis against the current code)</h2>
<table><thead><tr><th>Problem in today's bar</th><th>Evidence</th><th>Fix applied in all three</th></tr></thead><tbody>
<tr><th>Scan label baseline</th><td><code>labelCamera</code> is <code>position:absolute; bottom:8</code>; the other labels are centred in flow. About 7 pt lower.</td><td>One rule: the disc's bottom edge equals the icons' bottom edge, and all five labels sit on one baseline (label top 39 pt from the pill top).</td></tr>
<tr><th>Too tall / heavy</th><td>68 pt pill + 14 pt overhang + 30 pt floor, e2 shadow (24 blur, 0.20), 32 pt page-colour fade above.</td><td>Pill 64-66 pt, 24-26 pt floor, shadow 14 blur / 0.17 plus a 2 pt contact shadow, no fade. Width = screen minus 48 (345 on a 393 phone).</td></tr>
<tr><th>White blob</th><td>Opaque white, almost the full pill height; the active label changes only from maroon to inkDark.</td><td>Translucent cream capsule that hugs the icon (R1) or the slot (R2), or a 16 x 3 bar (R3), plus a filled icon and a darker label. The white blob goes.</td></tr>
<tr><th>Disc held up by its ring</th><td>Terra on blush is ${CR.oldDisc}:1. The 4 pt cream ring fakes the separation.</td><td>The disc becomes a two-stop terra gradient with a top highlight and a rose-tinted shadow. R1 keeps a thinner (3 pt) ring, R2 drops it for a translucent rim, R3 sets the disc inside the pill's own raised silhouette.</td></tr>
<tr><th>Stock icons</th><td>lucide BookOpen / Sticker are semantically off and uneven.</td><td>Custom set (flashcard stack, calendar with today dot, masonry boards, person, camera), 1.75 stroke, filled pairs. Drawn to read on rose: ink is maroon-black, not the page colour.</td></tr>
<tr><th>Badge</th><td><code>errorDeep</code> red, covering the book's corner.</td><td>Maroon pill, cream numerals (${CR.badge}:1), ringed in the pill colour, offset clear of the glyph. "9+" cap.</td></tr>
<tr><th>Label contrast</th><td>maroon #662B31 on blush is ${CR.oldLabel}:1 (passes), but the active label barely differs.</td><td>Inactive #5A2429 (${CR.offTop}:1 on the pill's top, ${CR.offBot}:1 on the bottom stop), active #3A1519 (${CR.onBlush}:1). Pill gets a vertical gradient (#EBAEAF, #E4A0A1, #E09A9B) and a 1 px rim: light top, faint dark bottom.</td></tr>
</tbody></table>

<h2>2. The three refinements</h2>

<section class="dir"><h3>R1 &middot; Same bar, done right <span class="tag">Fixes and craft only</span></h3>
<img class="shot" src="shots/v2-1.png" alt="R1 on four screens next to the current bar">
<p><b>What changed.</b> Same silhouette, same raised terra disc with a cream ring, same Scan label. 345 x 64 pill (was 344 x 68), fully rounded, floor 26. Disc 44 pt (was 60) with a 3 pt ring (was 4), overhang 10 pt (was 14) and its bottom aligned to the icons so "Scan" shares the baseline. Active tab: a 52 x 31 translucent cream capsule behind the filled icon only, label darkens. Scan active: a second 1.5 pt terra ring outside the cream ring. Custom icons, maroon badge, rim light and softer shadow.</p>
<img class="shot" src="shots/v2-1-states.png" alt="R1 states"><img class="shot" src="shots/v2-1-zoom.png" alt="R1 centre piece at 6x">
<p class="small"><b>Critique.</b> Most faithful to the owner's bar and the cleanest fix list. It is still, structurally, a pill with a ringed disc on it, so it will not read as "designed by a studio" on structure alone; the craft is in the details. Active capsule is a touch pale on the lightest part of the gradient.</p></section>

<section class="dir"><h3>R2 &middot; Ringless disc, tinted slot capsule <span class="tag">Moderate evolution</span></h3>
<img class="shot" src="shots/v2-2.png" alt="R2 on four screens">
<p><b>What changed beyond R1.</b> The cream ring is gone. The 46 pt disc raises 11 pt, with a 2 pt translucent cream rim and a terra-tinted shadow (rgba(157,77,81,.45)), so over the cream it separates by contrast and over the pill by glow instead of a cut-out. The active tab gets a concentric slot capsule (inset 5 pt, radius 28) that slides between tabs (see Animation). Pill 66 pt tall, floor 24. An earlier halo plate behind the disc read as a smudge in the zoom and was cut.</p>
<img class="shot" src="shots/v2-2-states.png" alt="R2 states"><img class="shot" src="shots/v2-2-zoom.png" alt="R2 centre piece at 6x">
<p class="small"><b>Critique.</b> Smoother than R1; the ringless disc feels more intentional. But the slot capsule is nearly circular at 59 x 56, so it is a refined version of the blob the owner disliked, and structurally this is still the stock pill-plus-disc.</p></section>

<section class="dir"><h3>R3 &middot; Crest, one silhouette <span class="tag rec">Recommended</span></h3>
<img class="shot" src="shots/v2-3.png" alt="R3 on four screens">
<p><b>What changed beyond R1.</b> The pill and its raised centre become one continuous shape. The top edge swells in a smooth 92 pt wide, 14 pt tall crest, and the 46 pt terra disc sits inside it with a 1.5 pt translucent rim. No ring, no overhang over the page, no separate object stuck on. The silhouette is the idea: it is the owner's rose pill with the camera raised, drawn as one object, and nothing else in the app uses that shape. Active tab: filled icon, darker label and a 16 x 3 bar at the pill's base that slides between tabs. Scan active: disc darkens and takes a cream ring.</p>
<img class="shot" src="shots/v2-3-states.png" alt="R3 states"><img class="shot" src="shots/v2-3-zoom.png" alt="R3 centre piece at 6x">
<p class="small"><b>Critique.</b> The crest is the most ownable of the three and removes the ring problem at the root, but it is a recognisable family (curved or notched centre tab bars exist), so it is distinctive for Tabi rather than unprecedented. Build risk: the shadow must follow an irregular shape (see spec).</p></section>

<h2>3. Harsh critique, scored from the PNGs</h2>
<p>1-10 from the rendered screenshots and the 6x crops, not from the code. Round-2 findings that were fixed before this table: R1's active icon sat under its capsule (washed out), the active Scan ring collided with the label, and the disc was too large for the label gap; R2's halo plate was a smudge and its disc crowded the label; R3's crest was too flat and wide, and it drew an underline bar under Scan when Scan was active.</p>
<table><thead><tr><th>Direction</th>${crit.map(c => `<th>${c}</th>`).join('')}<th>Mean</th><th>Verdict</th></tr></thead><tbody>
${tr('R1', 'R1 Same bar, done right', 'Not generic 7: the structure is the stock pill-plus-disc')}${tr('R2', 'R2 Ringless, tinted capsule', 'Not generic 7: capsule is a refined blob')}${tr('R3', 'R3 Crest', 'Clears 8 on all six; recommended')}
</tbody></table>
<ul class="small"><li><b>R3 at 8 on "still the owner's bar":</b> same rose gradient pill, same terra camera raised in the middle with a Scan label; the new part is the silhouette that joins them. An owner who loves the current look will recognise it at a glance; one who wants zero shape change should take R1 or R2.</li>
<li><b>R3 at 8 on craft, not 9:</b> the crest curve, the rim light and the disc alignment hold at 6x. What keeps it at 8 is that the shadow behind an SVG silhouette is unproven on device.</li></ul>

<h2>4. Recommendation: R3 Crest (fallback R2)</h2>
<div class="rec-box">
<h3>Geometry (pt, 393 wide, home-indicator phone)</h3>
<table><tbody>
<tr><th>Pill width</th><td><code>min(screenWidth - 48, 380)</code> (345 here); slot width = width / 5 (69). Centred. Never a fixed 344.</td></tr>
<tr><th>Pill height / radius</th><td>64 / 32 (full). Bottom edge: <code>max(insets.bottom - 8, 20)</code> from the screen bottom (26 here; the home indicator zone is 8-13 pt, so about 13 pt clear).</td></tr>
<tr><th>Crest</th><td>Rises 14 pt above the pill top, flat shoulder to flat shoulder 92 pt (centre &plusmn; 46), a cubic from (c-46, 0) via (c-34, 0) and (c-24, -14) to (c, -14), mirrored.</td></tr>
<tr><th>Disc</th><td>46 pt, top at -10 relative to the pill top (bottom at 36, equal to the icons' bottom), centred on the pill. 1.5 pt rim <code>rgba(255,236,230,.55)</code>. Fill gradient #A85A5E to #92454A. Camera glyph 24 pt white, lens stroke #92454A.</td></tr>
<tr><th>Slot content</th><td>Padding top 11. Icon box 25 pt (11-36). Label starts at 39 (gap 3), line height 13, bottom padding 12. Scan slot has the same empty icon box plus its label, so labels share one baseline.</td></tr>
<tr><th>Icons</th><td>25 pt box, viewBox 24, stroke 1.75, round caps and joins. Outline inactive (<code>#5A2429</code>), filled active (<code>#3A1519</code>) with details knocked out in the pill colour (use <code>#EAB2B1</code>).</td></tr>
<tr><th>Label</th><td><code>fonts.display</code> 11 pt, <code>letterSpacing 0.1</code>, <code>maxFontSizeMultiplier 1.15</code>, one line; inactive <code>#5A2429</code>, active <code>#3A1519</code>.</td></tr>
<tr><th>Badge</th><td>Min 17 x 17, radius 9, <code>#662B31</code> fill, cream <code>fonts.monoBold</code> 10.5 pt, 2 pt ring <code>#E7A5A6</code>, left = icon centre + 6, top = -5 on the icon box. "9+" at 10+. Hidden at 0.</td></tr>
<tr><th>Indicator</th><td>16 x 3 bar, radius 2, <code>#3A1519</code>, bottom 4 pt inside the pill, centred under the active slot. Not shown when Scan is active.</td></tr>
</tbody></table>
<h3>Surface and tokens (no re-theme; add to <code>constants/tabBar.ts</code>, not <code>theme.ts</code>)</h3>
<pre>export const TAB = {
  height: 64, radius: 32, crest: 14, crestHalf: 46, discSize: 46, discTop: -10, margin: 24,
  gradient: ['#EBAEAF', '#E4A0A1', '#E09A9B'],   // top, mid, bottom of the pill
  rimTop: 'rgba(255,255,255,0.5)', rimBottom: 'rgba(102,43,49,0.10)',
  inkOff: '#5A2429', inkOn: '#3A1519', knockout: '#EAB2B1',
  discFrom: '#A85A5E', discTo: '#92454A', discOn: ['#94474C', '#7B383E'],
  badge: '#662B31', badgeText: '#FAF4EA',
  shadow: { color: '#662B31', opacity: 0.17, radius: 7, offsetY: 6 },
};</pre>
<h3>The shape (react-native-svg, JS only)</h3>
<pre>// width W from useWindowDimensions (see above); c = W / 2, r = 32, H = 64, R = 14, half = 46
const d = \`M\${r},0 H\${c-half} C\${c-34},0 \${c-24},\${-R} \${c},\${-R}
  C\${c+24},\${-R} \${c+34},0 \${c+half},0 H\${W-r}
  A\${r},\${r} 0 0 1 \${W-r},\${H} H\${r} A\${r},\${r} 0 0 1 \${r},0 Z\`;
// &lt;Svg width={W} height={H + R} viewBox={\`0 \${-R} \${W} \${H + R}\`}&gt;
//   &lt;Defs&gt;&lt;LinearGradient id="pill" x1="0" y1="0" x2="0" y2="1"&gt;3 Stops from TAB.gradient&lt;/LinearGradient&gt;
//          &lt;LinearGradient id="rim" ...&gt;white .5 at 0, 0 at .35, maroon .10 at 1&lt;/LinearGradient&gt;&lt;/Defs&gt;
//   &lt;Path d={d} fill="url(#pill)" /&gt;
//   &lt;Path d={d} fill="none" stroke="url(#rim)" strokeWidth={1.2} /&gt;
// &lt;/Svg&gt;</pre>
<h3>Shadow (the one thing to prove on a device)</h3>
<p>Wrap the Svg in a <code>View</code> with a <em>transparent</em> background and iOS shadow props from <code>TAB.shadow</code>. On iOS, a layer with no background casts a shadow from its rendered content, so it follows the crest; the mockup's <code>drop-shadow</code> is that same behaviour. Check it in the Simulator on the first build. If the shadow comes out as a rectangle or is missing, the JS-only fallback is a second <code>Path</code> drawn first, offset 5 pt down, filled maroon at 0.10, with one or two wider copies at lower opacity. Android: no <code>elevation</code>; the app targets iOS first, and the shadow can be a faded duplicate path.</p>
<h3>States</h3>
<table><thead><tr><th>State</th><th>Icon</th><th>Label</th><th>Extra</th></tr></thead><tbody>
<tr><td>Inactive</td><td>Outline #5A2429</td><td>#5A2429</td><td></td></tr>
<tr><td>Active</td><td>Filled #3A1519, details knocked out</td><td>#3A1519</td><td>16 x 3 bar under the label</td></tr>
<tr><td>Scan idle</td><td>Disc gradient #A85A5E to #92454A</td><td>#5A2429</td><td>Rim 1.5 pt translucent</td></tr>
<tr><td>Scan active</td><td>Disc #94474C to #7B383E</td><td>#3A1519</td><td>3 pt cream ring (<code>rgba(250,244,234,.85)</code>); no bar</td></tr>
<tr><td>Pressed</td><td>Opacity 0.6 for 80 ms</td><td>same</td><td>Scan disc scales to 0.95 with <code>pressSpring</code></td></tr>
</tbody></table>
<h3>Animation (reanimated ~4.1, already installed)</h3>
<ul>
<li>Indicator bar: one shared value for its x, set to the active slot's centre. <code>withSpring(x, spring)</code> (<code>lib/motion.ts</code>: damping 18, stiffness 220). The bar stretches nothing; it only translates.</li>
<li>Icon swap: stack outline and filled glyphs and cross-fade the opacities over <code>dur.fast</code> (120 ms) with a 1.0 to 1.08 to 1.0 scale. Haptic <code>haptic.tap()</code> stays.</li>
<li>Scan disc press: scale 0.95 using <code>pressSpring</code>; the active ring fades in over 120 ms.</li>
<li>Badge: a 120 ms scale pop when the count changes.</li>
<li>Reduce Motion (<code>useReduceMotionSetting()</code>): the bar jumps with no spring, the icon swap is instant, no scale pops.</li>
<li>Optional, only if it earns its place on a device: compact-on-scroll (pill height to 56 and labels hidden) as the iOS 26 bars do. Not designed here; the camera slot makes it fiddly.</li>
</ul>
<h3>Accessibility and platform</h3>
<ul>
<li>Keep every <code>Pressable</code> as now: <code>accessibilityRole="tab"</code>, the existing labels ("Scan a new sticker", "Collection, 3 due"), <code>accessibilityState.selected</code>, <code>testID="tab-{name}"</code>. Maestro flows are unaffected.</li>
<li>Hit target: each slot is the full pill height (64) by 69 wide. The Scan slot's row must be 14 pt taller than the others (padding top) so the crest area is inside its parent's bounds and tappable, exactly as the existing <code>row</code> does for the disc.</li>
<li>Dynamic Type 1.15: labels at 12.65 pt, "Collection" about 58 pt wide in a 69 pt slot; bottom padding absorbs the 1.5 pt of extra line height (the states image shows this).</li>
<li>Keyboard: keep the existing <code>keyboardWillShow / keyboardWillHide</code> effect returning <code>null</code>.</li>
<li>The Scan tab's screen is not full-bleed (cream page, framed viewfinder), so the bar stays as is there.</li>
</ul>
<h3>Mapping onto <code>app/(tabs)/_layout.tsx</code></h3>
<ul>
<li>Keep: <code>TabLayout</code>, <code>Tabs</code> config, <code>SLOTS</code>, <code>press()</code>, the keyboard effect, <code>focusedName</code>, badge/a11y logic, the outer overflow-visible <code>wrap</code> and <code>row</code> (they exist for the raised centre and still do the job).</li>
<li>Delete: the <code>Svg/Defs/LinearGradient/Rect</code> fade block and <code>TAB_BAR_FADE</code> and <code>styles.fade</code>; <code>HIGHLIGHT_RING</code> and <code>styles.highlight</code> (the white blob); <code>styles.pill</code> (replaced by the Svg shape); <code>styles.disc</code> border and <code>e2</code>; <code>labelCamera</code> absolute positioning.</li>
<li>Add <code>components/TabBarShape.tsx</code> (the Svg above), <code>components/TabIcon.tsx</code> (custom outline/filled glyphs, camera), and a small <code>useTabIndicator</code> hook (shared value + spring).</li>
<li>Slot body becomes: icon box (25) then label, uniformly; the Scan slot renders an empty icon box and absolutely positions the disc at <code>top: TAB.discTop</code> relative to the pill. The label is no longer absolute.</li>
<li><b><code>constants/tabBar.ts</code></b>: replace width/height/disc constants with <code>TAB</code> above. <code>tabBarBottom(insetBottom) = Math.max(insetBottom - 8, 20)</code>. <code>TAB_BAR_CLEARANCE</code> becomes <code>tabBarBottom + 64 + 14 - insetBottom</code> = 70 on a 34 pt inset (down from 96, so every screen gains about 26 pt). Screens that use <code>insets.bottom + TAB_BAR_CLEARANCE</code> (<code>collection, calendar, wall, scan</code>, <code>profile</code>, <code>AiConsentGate</code>) keep working; <code>ToastProvider.tsx</code> line 195 uses <code>TAB_BAR_HEIGHT + TAB_BAR_DISC_OVERHANG + tabBarBottom</code>; point it at <code>TAB.height + TAB.crest</code> (the crest is the tallest thing).</li>
<li>Re-check by eye after the change: screens with a literal 24 or 34 added to the clearance were tuned to the old bar.</li>
<li>Verification: <code>harness/qa.sh</code> on the Simulator (the AGENTS.md rule), looking at the crest shadow, badge, Scan active, Dynamic Type 1.15 and Reduce Motion.</li>
</ul>
<h3>Icon set (shared by R1-R3)</h3>
<pre>${esc(paths)}</pre>
<h3>Fallback: R2</h3>
<p>If the crest silhouette or its shadow does not hold up on device, or the owner wants a plain pill, use R2 with the same code minus the crest: a pill with <code>borderRadius</code> 33 (so the existing <code>View</code> with <code>backgroundColor</code> plus a vertical gradient works, with ordinary RN shadow props), the 46 pt disc at <code>top: -11</code>, and the translucent slot capsule from the mockup. R1 is the same again with the cream ring and the icon-only capsule.</p>
<h3>What needs a native build</h3>
<p><b>Nothing</b> for R1, R2 or R3. They use only <code>react-native-svg</code> 15.12.1 (path, gradients), <code>react-native-reanimated</code> ~4.1.1, <code>react-native-safe-area-context</code>, <code>expo-haptics</code> and fonts already bundled; JS-only, so they ship OTA. No blur is used. A real frosted pill would need <code>expo-blur</code> (not installed) and a rationed EAS build; none of the three needs it. Per AGENTS.md, no <code>eas update</code> or build without the owner's yes.</p>
</div>

<p class="small" style="margin-top:32px">Files this page uses: <code>shots/v2-{1,2,3}.png</code>, <code>shots/v2-{1,2,3}-states.png</code>, <code>shots/v2-{1,2,3}-zoom.png</code>, <code>fonts/Newsreader_500Medium.ttf</code>, <code>fonts/Newsreader_400Regular.ttf</code>, and <a href="v1.html">v1.html</a> (with its own <code>shots/</code> PNGs). Mockups come from <code>src/gen2.mjs</code> with real screenshots behind the bar; "before" is the repo's own screenshots of the current bar. Fourth-frame cards are cropped copies of real card pixels to show content scrolling behind the bar.</p>
</main></body></html>`;
writeFileSync(`${here}/../index.html`, html);
