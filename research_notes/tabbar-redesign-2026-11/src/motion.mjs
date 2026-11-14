import { bar, BASE, COL, glyph, PILL } from './gen3.mjs';
import { writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const W = 353, P = 66;
let b = bar({ active: 'none', badge: '2', bottom: 16 });
const names = ['collection', 'calendar', null, 'boards', 'profile'];
let overlay = '';
names.forEach((k, i) => { if (!k) return; const cx = W / 2 + (i - 2) * P; overlay += `<div class="fill" style="position:absolute;left:${cx - 12.5}px;top:11px;width:25px;height:25px;opacity:0">${glyph(k, true, COL.inkOn, PILL)}</div>`; });
b = b.replace(/<\/div>$/, overlay + '</div>');
const html = `<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Crest bar motion</title><style>${BASE.replace(/\.\.\/fonts/g, 'fonts')}
body{background:#FAF4EA;color:#4A4340;font:400 16px/1.5 Newsreader;padding:24px}
.stage{position:relative;width:393px;height:150px;background:#FAF4EA;border:1px solid #EADFD6;border-radius:14px;overflow:hidden;margin:14px 0}
button,label{font:500 14px Newsreader}button{padding:6px 12px;border:1px solid #9D4D51;background:#fff;color:#833F46;border-radius:99px;margin:2px}
.lb{transition:color 120ms}
pre{background:#fff;border:1px solid #EADFD6;border-radius:10px;padding:10px;font:500 12px/1.5 ui-monospace,Menlo,monospace;overflow:auto}
</style></head><body>
<h2 style="font:500 26px Newsreader;color:#833F46">Crest bar: motion demo</h2>
<p>Tap the tabs, hold the camera disc, press Badge +1. The springs run in JS with the constants the spec gives for reanimated (mass 1). Toggle Reduce Motion for the fallback.</p>
<div class="stage" id="stage">${b}</div>
<div><label><input type="checkbox" id="rm"> Reduce Motion</label> <button id="badge">Badge +1</button> <button id="slow">Slow-mo x4: <span id="sl">off</span></button></div>
<pre id="log">tap a tab</pre>
<script>
const W=${W}, P=${P}, M=20, names=['Collection','Calendar','Scan','Boards','Profile'];
const stage=document.getElementById('stage'), bar=stage.firstElementChild, logEl=document.getElementById('log');
const fills=[...bar.querySelectorAll('.fill')], icons=[...bar.querySelectorAll('.ic')], labels=[...bar.querySelectorAll('.lb')];
const badge=bar.querySelector('.badge'); const disc=[...bar.children].find(e=>e.style.width==='44px'&&e.style.borderRadius==='50%');
let slow=1, rm=false, active=1, count=2;
document.getElementById('rm').onchange=e=>rm=e.target.checked;
document.getElementById('slow').onclick=()=>{slow=slow===1?4:1;document.getElementById('sl').textContent=slow===1?'off':'on'};
class Sp{constructor(x,k,c){this.x=x;this.v=0;this.t=x;this.k=k;this.c=c}step(dt){const n=Math.ceil(dt/0.004),h=dt/n;for(let i=0;i<n;i++){const a=-this.k*(this.x-this.t)-this.c*this.v;this.v+=a*h;this.x+=this.v*h}}}
// tabs 0,1,3,4 map to fills 0..3
const FI={0:0,1:1,3:2,4:3}, alpha=[0,1,0,0], target=[0,1,0,0], pop=[null,null,null,null], sc=[new Sp(1,400,18),new Sp(1,400,18),new Sp(1,400,18),new Sp(1,400,18)];
const DISC=new Sp(1,400,14); let dTarget=1, pressedAt=0, BPOP=-1;
function setActive(i){ if(i===active)return; const old=active; active=i; target[FI[old]]=0; target[FI[i]]=1; if(!rm) pop[FI[i]]=performance.now();
  logEl.textContent='active -> '+['Collection','Calendar','Scan','Boards','Profile'][i]+'   icon cross-fade 120 ms, pop 1.08 (70 ms) then spring {damping:18, stiffness:400}'+(rm?'   [Reduce Motion: opacity fade only]':''); }
names.forEach((n,i)=>{const h=document.createElement('div');h.style.cssText='position:absolute;bottom:16px;height:'+(i===2?84:64)+'px;left:'+(M+W/2+(i-2)*P-P/2-(i===0?16:0))+'px;width:'+(P+(i===0||i===4?16:0))+'px;cursor:pointer;z-index:5';stage.appendChild(h);
 if(i===2){h.onpointerdown=()=>{dTarget=rm?1:0.94;if(rm)disc.style.opacity=.85;pressedAt=performance.now()};h.onpointerup=h.onpointerleave=()=>{dTarget=1;disc.style.opacity=1}} else h.onclick=()=>setActive(i)});
document.getElementById('badge').onclick=()=>{count++;badge.textContent=count>9?'9+':count;BPOP=performance.now()};
let last=performance.now();
function frame(now){const dt=Math.min((now-last)/1000,.05)/slow;last=now;
 for(let f=0;f<4;f++){const d=rm?1:dt*1000/120;alpha[f]+=Math.sign(target[f]-alpha[f])*Math.min(Math.abs(target[f]-alpha[f]),d);fills[f].style.opacity=alpha[f];
  let s=1;const ps=pop[f];if(ps&&!rm){const e=(performance.now()-ps)/slow;if(e<70)s=1+.08*(e/70);else{if(!sc[f].init){sc[f].x=1.08;sc[f].v=0;sc[f].init=1}sc[f].t=1;sc[f].step(dt);s=sc[f].x;if(Math.abs(s-1)<.0005&&Math.abs(sc[f].v)<.01){pop[f]=null;sc[f].init=0}}}
  fills[f].style.transform='scale('+s+')';icons[f].style.transform='scale('+s+')';}
 labels.forEach((l,j)=>{l.style.color=(j===active)?'${COL.inkOn}':'${COL.inkOff}'});
 DISC.t=dTarget;DISC.step(dt);disc.style.transform='scale('+DISC.x+')';
 if(BPOP>0){const e=(performance.now()-BPOP)/slow;const s=rm?1:(e<120?1+.25*(e/120):e<240?1.25-.25*((e-120)/120):1);badge.style.transform='scale('+s+')';if(e>240)BPOP=-1}
 requestAnimationFrame(frame)}
requestAnimationFrame(frame);
if(location.hash==='#t'){setTimeout(()=>stage.children[stage.children.length-2].click(),30)}
</script>
<h3 style="font:500 20px Newsreader;color:#662B31">Spec the demo follows</h3>
<pre>active tab       outline glyph fades out and filled glyph fades in over 120 ms; pop scale 1 to 1.08 in 70 ms, then withSpring(1, { damping: 18, stiffness: 400 })
label colour     interpolateColor inkOff to inkOn over 120 ms
Scan press       in: withTiming(0.94, { duration: 80 })   out: withSpring(1, { damping: 14, stiffness: 400 })
Scan active      cream ring opacity 0 to 1 over 120 ms
badge pop        scale 1 to 1.25 over 120 ms, back to 1 over 120 ms
no indicator     the active state is the filled glyph plus the darker label; there is nothing else to slide
Reduce Motion    opacity fades only; no scale anywhere; Scan press dims to 0.85 opacity</pre>
</body></html>`;
writeFileSync(`${here}/../v3-motion.html`, html);
