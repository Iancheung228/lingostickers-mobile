import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const J = JSON.parse(readFileSync('../icons-v3/icons.json', 'utf8'));
const head = (cx, cy, r) => `M${(cx - r).toFixed(2)} ${cy}a${r} ${r} 0 1 0 ${(2 * r).toFixed(2)} 0a${r} ${r} 0 1 0 ${(-2 * r).toFixed(2)} 0Z`;
const f = n => +n.toFixed(2);
const bust = (w, T, Sy, B) => { const L = 12 - w, dy = Sy - T, cr = 2.1; return `M${f(L)} ${Sy}c0-${f(dy * .617)} ${f(w * .386)}-${f(dy)} ${f(w)}-${f(dy)}s${f(w)} ${f(dy * .383)} ${f(w)} ${f(dy)}c0 1.2-.9 ${cr} -${cr} ${cr}H${f(L + cr)}C${f(L + .9)} ${B} ${f(L)} ${f(B - .9)} ${f(L)} ${Sy}Z`; };
const V = { V5: [4.25, 7.2, 8.0, 14.7, 19.2, 21.1], V6: [4.3, 7.2, 8.4, 14.8, 19.3, 21.1], V7: [4.4, 7.25, 8.6, 14.9, 19.4, 21.1], orig: null, V1x: [4.2,7.0,7.4,14.5,19.2,21.2],  orig: null, V1: [4.2, 7.0, 7.4, 14.5, 19.2, 21.2], V2: [4.3, 6.9, 7.6, 14.6, 19.3, 21.2], V3: [4.5, 6.9, 7.8, 14.8, 19.4, 21.3], V4: [4.3, 7.0, 7.5, 14.5, 19.2, 21.1] };
for (const [k, p] of Object.entries(V)) {
  const j = JSON.parse(JSON.stringify(J));
  if (p) { const [r, cy, w, T, Sy, B] = p; for (const st of ['inactive', 'active']) { j.glyphs.profile[st][0].d = head(12, cy, r); j.glyphs.profile[st][1].d = bust(w, T, Sy, B); } }
  writeFileSync(`/private/tmp/claude-502/-Users-school-lingostickers-mobile-lingostickers-mobile/d258978c-e956-4a6a-9043-e566021577b6/scratchpad/prof-${k}.json`, JSON.stringify(j));
}
console.log(Object.keys(V).join(' '));
