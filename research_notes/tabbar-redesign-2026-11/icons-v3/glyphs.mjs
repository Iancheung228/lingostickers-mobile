// Glyph source of truth for icons-v3. Pure data + tiny geometry helpers.
// All coordinates are stroke CENTERLINES on a 24x24 grid. Outer edge = centerline +- SW/2.
//
// Roles (how a part renders in each state):
//   shape  : outline = stroke ink          | filled = fill ink + stroke ink  (same silhouette)
//   detail : outline = stroke ink          | filled = stroke KO
//   dot    : outline = fill ink            | filled = fill KO
//   knock  : outline = stroke ink          | filled = fill KO + stroke KO   (a solid inside a filled shape)
//   fixed  : stroke ink in both states (pegs, peeks, stack edges: they sit outside the filled mass)

const f = (n) => +n.toFixed(2);
const K = 0.64; // corner smoothing: 0.5523 = circular arc, higher = squircle. Shared by every container.

// rounded rect as absolute commands, optional rotation about its centre (degrees)
export function rrRaw(x, y, w, h, r, rot = 0) {
  const R = x + w, B = y + h, c = r * (1 - K);
  const segs = [
    ['M', x + r, y], ['L', R - r, y], ['C', R - c, y, R, y + c, R, y + r], ['L', R, B - r],
    ['C', R, B - c, R - c, B, R - r, B], ['L', x + r, B], ['C', x + c, B, x, B - c, x, B - r],
    ['L', x, y + r], ['C', x, y + c, x + c, y, x + r, y],
  ];
  const a = (rot * Math.PI) / 180, co = Math.cos(a), si = Math.sin(a), cx = x + w / 2, cy = y + h / 2;
  return segs.map(([k, ...n]) => { const o = []; for (let i = 0; i < n.length; i += 2) { const dx = n[i] - cx, dy = n[i + 1] - cy; o.push(cx + dx * co - dy * si, cy + dx * si + dy * co); } return [k, ...o]; });
}
const ser = (segs) => segs.map(([k, ...n]) => k + n.map(f).join(' ')).join('') + 'Z';
export const rr = (x, y, w, h, r, rot = 0) => ser(rrRaw(x, y, w, h, r, rot));
export const circ = (cx, cy, r) => `M${f(cx - r)} ${cy}a${r} ${r} 0 1 0 ${f(2 * r)} 0a${r} ${r} 0 1 0 ${f(-2 * r)} 0Z`;


// Back card partly hidden by a front card: split the back card's own segments where they enter
// the front card (grown by `gap`) and keep only the visible runs. Exact subdivisions, no polylines.
function visibleRuns(segs, front, gap, extra = () => false) {
  const fronts = Array.isArray(front[0]) ? front : [front];
  const inside = (p) => extra(p) || fronts.some(([fx, fy, fw, fh, fr]) => {
    const [x, y] = p, g = gap, cx = Math.min(Math.max(x, fx + fr), fx + fw - fr), cy = Math.min(Math.max(y, fy + fr), fy + fh - fr);
    return Math.hypot(x - cx, y - cy) < fr + g && x > fx - g && x < fx + fw + g && y > fy - g && y < fy + fh + g;
  });
  const pts = []; let cur = null;
  const list = []; // {p0,c1,c2,p1}
  for (const s of segs) {
    if (s[0] === 'M') cur = [s[1], s[2]];
    else if (s[0] === 'L') { list.push({ p0: cur, c1: null, c2: null, p1: [s[1], s[2]] }); cur = [s[1], s[2]]; }
    else if (s[0] === 'C') { list.push({ p0: cur, c1: [s[1], s[2]], c2: [s[3], s[4]], p1: [s[5], s[6]] }); cur = [s[5], s[6]]; }
  }
  void pts;
  const at = (sg, t) => sg.c1 ? bez(sg, t) : [sg.p0[0] + (sg.p1[0] - sg.p0[0]) * t, sg.p0[1] + (sg.p1[1] - sg.p0[1]) * t];
  const bez = (sg, t) => { const u = 1 - t; return [0, 1].map((i) => u*u*u*sg.p0[i] + 3*u*u*t*sg.c1[i] + 3*u*t*t*sg.c2[i] + t*t*t*sg.p1[i]); };
  const sub = (sg, a, b) => { // exact sub-curve [a,b]
    if (!sg.c1) return { p0: at(sg, a), c1: null, c2: null, p1: at(sg, b) };
    const split = (c, t) => { const L = (p, q) => [p[0] + (q[0]-p[0])*t, p[1] + (q[1]-p[1])*t]; const [p0,p1,p2,p3] = c; const a1=L(p0,p1),b1=L(p1,p2),c1=L(p2,p3),a2=L(a1,b1),b2=L(b1,c1),m=L(a2,b2); return [[p0,a1,a2,m],[m,b2,c1,p3]]; };
    let c = [sg.p0, sg.c1, sg.c2, sg.p1];
    if (b < 1) c = split(c, b)[0];
    if (a > 0) c = split(c, a / b)[1];
    return { p0: c[0], c1: c[1], c2: c[2], p1: c[3] };
  };
  const runs = [];
  for (const sg of list) {
    const N = 400; let start = null;
    const edge = (lo, hi) => { for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (inside(at(sg, m)) === inside(at(sg, lo))) lo = m; else hi = m; } return (lo + hi) / 2; };
    let prev = inside(at(sg, 0));
    if (!prev) start = 0;
    for (let i = 1; i <= N; i++) {
      const t = i / N, ins = inside(at(sg, t));
      if (ins !== prev) { const e = edge((i - 1) / N, t); if (!ins) start = e; else { runs.push(sub(sg, start, e)); start = null; } }
      prev = ins;
    }
    if (start !== null) runs.push(sub(sg, start, 1));
  }
  // serialise, merging contiguous runs
  let d = '', last = null;
  for (const r of runs) {
    if (!last || Math.hypot(last[0] - r.p0[0], last[1] - r.p0[1]) > 0.02) d += `M${f(r.p0[0])} ${f(r.p0[1])}`;
    d += r.c1 ? `C${[...r.c1, ...r.c2, ...r.p1].map(f).join(' ')}` : `L${f(r.p1[0])} ${f(r.p1[1])}`;
    last = r.p1;
  }
  return d;
}

const R_BIG = 4.25, R_MID = 3.4, R_SM = 2.6; // the whole family's radius scale
const SEED = 1.2; // radius of the shared "seed" dot

// ---------------------------------------------------------------- explorations
export const EXPLORE = {
  collection: {
    A: { name: 'Offset deck up-left: straight closed back card, word lines', parts: [
      { role: 'fixed', d: visibleRuns(rrRaw(3.75, 3.1, 11.8, 14.3, R_BIG), [7.9, 7.3, 12.2, 13.9, R_BIG], 1.35) },
      { role: 'shape', d: rr(7.9, 7.3, 12.2, 13.9, R_BIG) },
      { role: 'detail', d: 'M11.6 12.9h4.8M11.6 16.4h2.8' },
    ] },
    B: { name: 'Side-by-side deck: card offset left only', parts: [
      { role: 'fixed', d: visibleRuns(rrRaw(3.75, 6.2, 11.2, 14.9, R_BIG), [7.6, 7.2, 12.6, 14.1, R_BIG], 1.35) },
      { role: 'shape', d: rr(7.6, 7.2, 12.6, 14.1, R_BIG) },
      { role: 'detail', d: 'M11.3 12.9h5.2M11.3 16.4h3' },
    ] },
    C: { name: 'Landscape flash cards, offset up-left', parts: [
      { role: 'fixed', d: visibleRuns(rrRaw(3.3, 3.4, 12.9, 10.4, R_BIG), [6.9, 8.2, 13.35, 12.9, R_BIG], 1.35) },
      { role: 'shape', d: rr(6.9, 8.2, 13.35, 12.9, R_BIG) },
      { role: 'detail', d: 'M10.6 13.9h5.6M10.6 17.3h3.2' },
    ] },
  },
  calendar: {
    A: { name: 'Pegs + header + today seed (v3.1: 94% scale)', parts: [
      { role: 'shape', d: rr(4.25, 5.6, 15.5, 14.8, R_BIG) },
      { role: 'detail', d: 'M4.25 10.35h15.5' },
      { role: 'fixed', d: 'M8.5 3.4v3.5M15.5 3.4v3.5' },
      { role: 'dot', d: circ(12, 15.5, 1.25) },
    ] },
    B: { name: 'Off-centre marked day', parts: [
      { role: 'shape', d: rr(3.75, 5.25, 16.5, 15.5, 5.25) },
      { role: 'detail', d: 'M3.75 10.25h16.5' },
      { role: 'fixed', d: 'M8.25 2.9v3.7M15.75 2.9v3.7' },
      { role: 'dot', d: circ(15.4, 15.6, 1.4) },
    ] },
    C: { name: 'Circled day', parts: [
      { role: 'shape', d: rr(3.75, 5.25, 16.5, 15.5, R_BIG) },
      { role: 'detail', d: 'M3.75 10.25h16.5' },
      { role: 'fixed', d: 'M8.25 2.9v3.7M15.75 2.9v3.7' },
      { role: 'detail', d: circ(12, 15.6, 2.3) },
    ] },
  },
  boards: {
    A: { name: 'Uneven masonry, one inset sticker', parts: [
      { role: 'shape', d: rr(3.75, 3.75, 6.65, 8.4, R_SM) },
      { role: 'dot', d: circ(7.075, 7.95, SEED) },
      { role: 'shape', d: rr(3.75, 15.35, 6.65, 4.9, 2.4) },
      { role: 'shape', d: rr(13.6, 3.75, 6.65, 4.9, 2.4) },
      { role: 'shape', d: rr(13.6, 11.85, 6.65, 8.4, R_SM) },
    ] },
    B: { name: 'Even 2x2, one inset sticker', parts: [
      { role: 'shape', d: rr(3.75, 3.75, 6.65, 6.65, R_SM) },
      { role: 'dot', d: circ(7.075, 7.075, SEED) },
      { role: 'shape', d: rr(13.6, 3.75, 6.65, 6.65, R_SM) },
      { role: 'shape', d: rr(3.75, 13.6, 6.65, 6.65, R_SM) },
      { role: 'shape', d: rr(13.6, 13.6, 6.65, 6.65, R_SM) },
    ] },
    C: { name: 'Banner + two tiles', parts: [
      { role: 'shape', d: rr(3.75, 3.75, 16.5, 6.2, R_MID) },
      { role: 'dot', d: circ(8, 6.85, SEED) },
      { role: 'shape', d: rr(3.75, 13.15, 6.65, 7.1, R_SM) },
      { role: 'shape', d: rr(13.6, 13.15, 6.65, 7.1, R_SM) },
    ] },
  },
  profile: {
    A: { name: 'Head + closed bust (designer-widened)', parts: [
      { role: 'shape', d: circ(12, 7.2, 4.3) },
      { role: 'shape', d: 'M3.6 19.3c0-2.78 3.24-4.5 8.4-4.5s8.4 1.72 8.4 4.5c0 1.2-.9 2.1-2.1 2.1H5.7C4.5 21.1 3.6 20.2 3.6 19.3Z' },
    ] },
    B: { name: 'Head + open shoulders', parts: [
      { role: 'shape', d: circ(12, 7.2, 4.1) },
      { role: 'fixed', d: 'M4.2 20.7c.4-3.7 3.4-5.9 7.8-5.9s7.4 2.2 7.8 5.9' },
    ] },
    C: { name: 'Avatar in ring', parts: [
      { role: 'shape', d: circ(12, 12, 9.2) },
      { role: 'knock', d: circ(12, 9.9, 3) },
      { role: 'knock', d: 'M6.6 18.3c.9-2.5 3-3.9 5.4-3.9s4.5 1.4 5.4 3.9' },
    ] },
  },
};

// Camera: solid white on the terra disc. evenodd => lens is a true hole, so the disc shows through.
// Camera body uses the same squircle corner logic as rr() (K), radius 4.5, with the crest swell on top.
function camBody() {
  const x = 3, y = 7, w = 18, h = 13, r = 4.5, c = r * (1 - K), R = x + w, B = y + h;
  return `M${x + r} ${y}C${x + r + 1.9} ${y} ${x + r + 2.4} 4.6 12 4.6S${R - r - 2.4 + 0} ${y} ${R - r} ${y}C${R - c} ${y} ${R} ${y + c} ${R} ${y + r}V${B - r}C${R} ${B - c} ${R - c} ${B} ${R - r} ${B}H${x + r}C${x + c} ${B} ${x} ${B - c} ${x} ${B - r}V${y + r}C${x} ${y + c} ${x + c} ${y} ${x + r} ${y}Z`;
}
export const CAMERA = {
  A: { name: 'v3.0: body + thick lens ring', d: 'M7.5 7C9.4 7 9.9 4.6 12 4.6S14.6 7 16.5 7A4.5 4.5 0 0 1 21 11.5v4A4.5 4.5 0 0 1 16.5 20h-9A4.5 4.5 0 0 1 3 15.5v-4A4.5 4.5 0 0 1 7.5 7Z' + circ(12, 13.2, 4.3) + circ(12, 13.2, 1.7) + circ(17.3, 10.4, 0.9) },
  B: { name: 'Family camera: squircle body, lens ring = stroke width, seed, flash', d: camBody() + circ(12, 13.3, 3.9) + circ(12, 13.3, 2.25) + circ(17.4, 10.5, 0.9) },
  C: { name: 'Family camera, wider lens', d: camBody() + circ(12, 13.3, 4.3) + circ(12, 13.3, 2.65) + circ(17.4, 10.3, 0.85) },
};

export const LABELS = { collection: 'Collection', calendar: 'Calendar', scan: 'Scan', boards: 'Boards', profile: 'Profile' };
