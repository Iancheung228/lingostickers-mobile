// Floating "Crest" pill tab bar (Nov 2026 redesign; spec in
// research_notes/tabbar-redesign-2026-11/index.html section 11). Five slots,
// mirror symmetric, the Scan disc dead centre under a raised crest that is part
// of the pill's own silhouette. Shared between the tab layout (which positions
// the pill) and every tab screen (which pads its own content so the last item
// isn't hidden behind it): an absolutely-positioned bar reserves no layout
// space of its own.
import { colors } from '@/constants/theme';

export const TAB = {
  height: 64,
  radius: 32,
  /** Gap between the pill and each screen edge. */
  margin: 20,
  minWidth: 300,
  maxWidth: 420,
  /** Distance between slot centres. */
  pitch: 66,
  /** How far the crest rises above the pill's flat top (16.5, rounded up). */
  crest: 17,
  /** Headroom above the pill inside the bar's own view, for the crest. */
  headroom: 20,
  discSize: 44,
  /** Disc centre, below the pill's flat top. */
  discCy: 11,
  camera: 25,
  iconSize: 24,
  iconTop: 11.5,
  labelTop: 40,
  labelSize: 11,
  pill: colors.blush,
  pillEdge: '#D58A8E',
  disc: colors.blushDeep,
  discStroke: colors.terraDark,
  discActive: '#FBF3EA',
  discPressed: '#8D4549',
  discRing: 'rgba(251, 243, 234, 0.6)',
  inkOff: '#5A2429',
  inkOn: '#3A1519',
  badge: { bg: '#FBF3EA', text: '#3A1519', ring: colors.blush, left: 12, top: 4.5 },
  shadowPill: { color: '#8A3A44', opacity: 0.2, dy: 6, radius: 7 },
  shadowDisc: { color: '#662B31', opacity: 0.25, dy: 3, radius: 4 },
  fade: { height: 28, opacity: 0.92, color: colors.cream },
} as const;

/** Pill width for a screen width. */
export function tabBarWidth(screenWidth: number): number {
  return Math.min(TAB.maxWidth, Math.max(TAB.minWidth, screenWidth - TAB.margin * 2));
}

/** Distance of the pill's bottom edge from the screen bottom. */
export function tabBarBottom(insetBottom: number): number {
  return Math.max(insetBottom - 8, 18);
}

// Clearance a screen adds ON TOP of `insets.bottom`: tabBarBottom + pill (64)
// + crest (17) - inset. Measured against a notched phone (inset 34): 26 + 81 - 34.
export const TAB_BAR_CLEARANCE = 73;

// --- Silhouette -------------------------------------------------------------
// The crown is a circle concentric with the disc (radius = disc 22 + gap 5.5);
// it hands over at 26 degrees to a quintic Hermite shoulder that meets the flat
// top at dx = 50 with zero slope and zero curvature (G2 at both joins).
const RHO = 27.5;
const TH0 = (26 * Math.PI) / 180;
const HALF = 50;
const X0 = RHO * Math.sin(TH0);
const Y0 = TAB.discCy - RHO * Math.cos(TH0);
const D1 = Math.tan(TH0);
const D2 = (RHO * RHO) / Math.pow(RHO * RHO - X0 * X0, 1.5);
const L = HALF - X0;

/** Top-edge height relative to the pill's flat top; negative = up. */
export function crestY(dx: number): number {
  dx = Math.abs(dx);
  if (dx <= X0) return TAB.discCy - Math.sqrt(RHO * RHO - dx * dx);
  if (dx >= HALF) return 0;
  const s = (dx - X0) / L;
  const s3 = s ** 3, s4 = s ** 4, s5 = s ** 5;
  return Y0 * (1 - 10 * s3 + 15 * s4 - 6 * s5)
    + D1 * L * (s - 6 * s3 + 8 * s4 - 3 * s5)
    + D2 * L * L * (0.5 * s * s - 1.5 * s3 + 1.5 * s4 - 0.5 * s5);
}

const pathCache = new Map<number, string>();
/** The pill outline, flat top at y = 0. Draw in viewBox `0 -headroom W height+headroom`. */
export function pillPath(W: number): string {
  const hit = pathCache.get(W);
  if (hit) return hit;
  const H = TAB.height, R = TAB.radius, c = W / 2;
  let d = `M${R},0 L${c - HALF},0`;
  for (let dx = -HALF + 0.5; dx < HALF; dx += 0.5) d += ` L${(c + dx).toFixed(2)},${crestY(dx).toFixed(2)}`;
  d += ` L${c + HALF},0 L${W - R},0 A${R},${R} 0 0 1 ${W - R},${H} L${R},${H} A${R},${R} 0 0 1 ${R},0 Z`;
  pathCache.set(W, d);
  return d;
}
