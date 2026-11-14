import { makeCrest, extent, curvJump, minRadius, gapProfile } from './geom.mjs';
const C = { A: { type: 'cubic', rise: 14, half: 46 }, B: { type: 'quintic', rise: 14, half: 46 },
  C: { type: 'hermite', rise: 15, gap: 5, th0: 40, half: 46 }, D: { type: 'hermite', rise: 15, gap: 5, th0: 50, half: 50 },
  E: { type: 'hermite', rise: 16, gap: 6, th0: 35, half: 44 }, F: { type: 'hermite', rise: 14, gap: 4, th0: 45, half: 48 }, G: { type: 'hermite', rise: 15, gap: 5, th0: 30, half: 42 } };
for (const [n, c] of Object.entries(C)) {
  const y = makeCrest(c); const hi = extent(y); const g = gapProfile(y, 13, 23);
  const gs = g.map(a => a[1]); let over = 0; for (let x = 0; x < 60; x += .1) over = Math.max(over, y(x));
  console.log(n, 'extent', hi.toFixed(1), 'crown', y(0).toFixed(1), 'jump', curvJump(y, hi).toFixed(4), 'minR', minRadius(y, hi).toFixed(1), 'gap', Math.min(...gs).toFixed(1), Math.max(...gs).toFixed(1), 'overshoot', over.toFixed(3));
}
