import { makeCrest, extent, curvJump, minRadius, gapProfile } from './geom.mjs';
for (const [D, cy] of [[44, 11], [46, 12]]) for (const half of [46, 48, 50]) for (const th0 of [22, 26, 30, 34]) {
  const gap = 5.5, r = D / 2, rise = r + gap - cy;
  const y = makeCrest({ type: 'hermite', rise, gap, th0, half, discR: r });
  let over = 0; for (let x = 0; x < 70; x += .1) over = Math.max(over, y(x));
  const hi = extent(y), gs = gapProfile(y, cy, r, 55).map(a => a[1]);
  console.log(`D${D} cy${cy} rise${rise} half${half} th${th0}  over ${over.toFixed(3)}  reach ${hi.toFixed(1)}  jump ${curvJump(y, hi).toFixed(4)}  minR ${minRadius(y, hi).toFixed(1)}  gap ${Math.min(...gs).toFixed(1)}-${Math.max(...gs).toFixed(1)}`);
}
