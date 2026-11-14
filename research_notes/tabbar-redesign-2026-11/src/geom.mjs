// Crest geometry candidates. y(dx) = top-edge height (negative = up) at horizontal distance dx from centre.
export const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * h * k / 6; }; // cubic smooth-min, C2
const solveBez = (x0, x1, x2, x3, x) => { let lo = 0, hi = 1; for (let i = 0; i < 60; i++) { const t = (lo + hi) / 2; const bx = (1 - t) ** 3 * x0 + 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t * t * x2 + t ** 3 * x3; if (bx < x) lo = t; else hi = t; } return (lo + hi) / 2; };
export function makeCrest(c) {
  const { type, rise, half, gap = 5, k = 16, discR = 23, ext = 1.5 } = c;
  if (type === 'cubic') { // v2: from (half,0) via (half-12,0) (24... mirrored) to (0,-rise)
    // dx measured from centre: x runs from +half (y=0) to 0 (y=-rise); control points at dx=half-12 (y=0) and dx=24 (y=-rise)
    return dx => { dx = Math.abs(dx); if (dx >= half) return 0; const P = [half, half - 12, 24, 0], Y = [0, 0, -rise, -rise]; let lo = 0, hi = 1; for (let i = 0; i < 60; i++) { const t = (lo + hi) / 2; const bx = (1 - t) ** 3 * P[0] + 3 * (1 - t) ** 2 * t * P[1] + 3 * (1 - t) * t * t * P[2] + t ** 3 * P[3]; if (bx > dx) lo = t; else hi = t; } const t = (lo + hi) / 2; return (1 - t) ** 3 * Y[0] + 3 * (1 - t) ** 2 * t * Y[1] + 3 * (1 - t) * t * t * Y[2] + t ** 3 * Y[3]; };
  }
  if (type === 'quintic') return dx => { dx = Math.abs(dx); if (dx >= half) return 0; const u = 1 - dx / half; return -rise * (6 * u ** 5 - 15 * u ** 4 + 10 * u ** 3); };
  if (type === 'smin') { // concentric circle (radius discR+gap) smooth-unioned (C2) with a broad low quintic swell
    const rho = discR + gap, cy = -rise + rho, sw = c.swell ?? 5, sh = c.swellHalf ?? 46;
    return dx => { dx = Math.abs(dx); const u = dx >= sh ? 0 : 1 - dx / sh; const swell = -sw * (6 * u ** 5 - 15 * u ** 4 + 10 * u ** 3); const yc = cy - Math.sqrt(Math.max(rho * rho - dx * dx, 0)); return smin(swell, yc, k); };
  }
  if (type === 'hermite') { // concentric circular crown to angle th0, then a quintic Hermite shoulder: G2 at both joins
    const rho = discR + gap, cy = -rise + rho, th = (c.th0 ?? 40) * Math.PI / 180, x0 = rho * Math.sin(th), x1 = c.half;
    const y0 = cy - rho * Math.cos(th), d1 = Math.tan(th), d2 = rho * rho / Math.pow(rho * rho - x0 * x0, 1.5), L = x1 - x0;
    return dx => { dx = Math.abs(dx); if (dx <= x0) return cy - Math.sqrt(rho * rho - dx * dx); if (dx >= x1) return 0; const s = (dx - x0) / L; const s3 = s ** 3, s4 = s ** 4, s5 = s ** 5;
      return y0 * (1 - 10 * s3 + 15 * s4 - 6 * s5) + d1 * L * (s - 6 * s3 + 8 * s4 - 3 * s5) + d2 * L * L * (0.5 * s * s - 1.5 * s3 + 1.5 * s4 - 0.5 * s5); };
  }
  throw new Error('type');
}
/** Extent (half-width) where the crest rejoins the flat top (|y| < 0.02). */
export function extent(y) { let x = 0; for (let dx = 0; dx < 120; dx += 0.1) if (Math.abs(y(dx)) > 0.02) x = dx; return x + 0.1; }
export function curvature(y, x, h = 0.05) { const f0 = y(x - h), f1 = y(x), f2 = y(x + h); const d1 = (f2 - f0) / (2 * h), d2 = (f2 - 2 * f1 + f0) / (h * h); return d2 / Math.pow(1 + d1 * d1, 1.5); }
/** Largest curvature step between neighbouring samples (per 0.05 pt): ~0 for G2, large for a G1 kink. */
export function curvJump(y, hi) { let m = 0, prev = curvature(y, 0.2); for (let x = 0.25; x < hi + 2; x += 0.05) { const k = curvature(y, x); m = Math.max(m, Math.abs(k - prev)); prev = k; } return m; }
export function minRadius(y, hi) { let m = 1e9; for (let x = 0.3; x < hi; x += 0.1) { const k = Math.abs(curvature(y, x)); if (k > 1e-6) m = Math.min(m, 1 / k); } return m; }
/** Gap between the disc circle (centre (0,dcy), radius r) and the crest edge, sampled over +-maxDeg from vertical. */
export function gapProfile(y, dcy, r, maxDeg = 55) {
  const pts = []; for (let x = -90; x <= 90; x += 0.1) pts.push([x, y(x)]);
  const out = [];
  for (let d = -maxDeg; d <= maxDeg; d += 5) { const a = d * Math.PI / 180, px = r * Math.sin(a), py = dcy - r * Math.cos(a); let best = 1e9; for (const [x, yy] of pts) { const dist = Math.hypot(x - px, yy - py); if (dist < best) best = dist; } out.push([d, best]); }
  return out;
}
/** SVG path 'd' for the pill + crest, in pill-local coords (top-left of the flat top = (0,0)). */
export function pillPath(W, H, rad, y) {
  const c = W / 2; let d = `M${rad},0`;
  for (let x = rad; x <= W - rad + 0.001; x += 0.5) { const yy = y(x - c); d += ` L${x.toFixed(2)},${yy.toFixed(3)}`; }
  d += ` L${W - rad},0 A${rad},${rad} 0 0 1 ${W - rad},${H} H${rad} A${rad},${rad} 0 0 1 ${rad},0 Z`;
  return d;
}
