// Measures ink coverage (grid units^2) of each glyph state by rasterising at 10x in headless Chrome.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const J = JSON.parse(readFileSync(process.argv[2] ?? `${here}/../icons-v3/icons.json`, 'utf8'));
const page = `<!doctype html><body><pre id=o></pre><script>
const J=${JSON.stringify(J)};const out={};
for(const [n,g] of Object.entries(J.glyphs)) for(const st of ['inactive','active']){
 const c=document.createElement('canvas');c.width=c.height=240;const x=c.getContext('2d');x.scale(10,10);
 for(const p of g[st]){const P=new Path2D(p.d); if(p.fill==='ink'){x.fillStyle='#000';x.fill(P)} if(p.stroke==='ink'){x.strokeStyle='#000';x.lineWidth=J.meta.strokeWidth;x.lineCap='round';x.lineJoin='round';x.stroke(P)}
   if(p.fill==='ko'){x.save();x.globalCompositeOperation='destination-out';x.fillStyle='#000';x.fill(P);x.restore()} if(p.stroke==='ko'){x.save();x.globalCompositeOperation='destination-out';x.strokeStyle='#000';x.lineWidth=J.meta.strokeWidth;x.lineCap='round';x.stroke(P);x.restore()}}
 const d=x.getImageData(0,0,240,240).data;let s=0;let minx=240,maxx=0,miny=240,maxy=0;for(let i=0;i<d.length;i+=4){if(d[i+3]>128){s++;const px=(i/4)%240,py=Math.floor(i/4/240);minx=Math.min(minx,px);maxx=Math.max(maxx,px);miny=Math.min(miny,py);maxy=Math.max(maxy,py)}}
 out[n+' '+st]={ink:+(s/100).toFixed(1),bbox:[(minx/10).toFixed(1),(miny/10).toFixed(1),(maxx/10).toFixed(1),(maxy/10).toFixed(1)]};}
document.getElementById('o').textContent=JSON.stringify(out);</script>`;
const f = `${here}/ink-tmp.html`; writeFileSync(f, page);
const dom = execFileSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--disable-gpu', '--virtual-time-budget=2000', '--dump-dom', `file://${f}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const m = dom.match(/<pre id="o">([^<]*)<\/pre>/);
const r = JSON.parse(m[1].replace(/&quot;/g, '"'));
for (const [k, v] of Object.entries(r)) console.log(k.padEnd(20), String(v.ink).padStart(6), v.bbox.join(','));
