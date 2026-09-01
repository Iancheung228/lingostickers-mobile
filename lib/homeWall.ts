// Geometry for the home screen's arrangeable mini wall.
//
// Everything here is expressed in NORMALIZED units (fractions of the
// canvas) rather than pixels, because two surfaces have to draw the exact
// same arrangement: the panel embedded in the home feed, and the larger
// editor sheet you arrange it in. Store pixels — the way board_stickers
// does — and a wall arranged on one surface lands half off the other. The
// tile size is likewise a fraction of canvas *width* and a pure function of
// the sticker id, so it needs no database column and both surfaces agree on
// it without being told.
//
// The invariant that makes the editor honest ("what I arrange is what I
// see"): both surfaces render at the same aspect ratio. HOME_WALL_INSET and
// HOME_WALL_HEIGHT below are the single definition of that geometry — the
// panel and the editor both derive their canvas from these, so the ratio
// matches by construction on every device width.

import { seededRandom } from '@/lib/seededRandom';

// The panel's horizontal margin and height on the home screen. The editor
// sizes its canvas from these too — see HomeWallEditor.
//
// 200, not the 150 this panel used to be: free placement needs somewhere to
// place things. At 150 a tile could only travel ~85pt vertically, so "drag
// it a bit higher" wasn't really an available move. This is the one number
// to turn if the home feed feels crowded.
export const HOME_WALL_INSET = 16;
export const HOME_WALL_HEIGHT = 200;

/** The canvas both the panel and the editor draw on, given a screen width. */
export function homeCanvasSize(screenWidth: number) {
  const width = Math.max(0, screenWidth - HOME_WALL_INSET * 2);
  return { width, height: HOME_WALL_HEIGHT, aspect: width > 0 ? width / HOME_WALL_HEIGHT : 1 };
}

// A short wide strip can hold about this many cutouts before they stop
// being individually recognizable. Not enforced in SQL — it's a soft cap
// the tray surfaces ("8/10") and refuses to exceed, not an invariant.
export const HOME_WALL_CAP = 10;

// Tile width as a fraction of canvas width. A few discrete size classes
// rather than continuous randomness, so the wall reads as a deliberate
// hierarchy — one or two anchors, mostly mediums — the same trick
// lib/boardLayout.ts plays on the full boards.
const BASE_TILE_FRACTION = 0.19;
const SIZE_CLASSES = [
  { scale: 0.82, weight: 0.3 },
  { scale: 1.0, weight: 0.5 },
  { scale: 1.22, weight: 0.2 },
];

/** Tile side as a fraction of canvas width. Tiles are square (cutout PNGs
 * are drawn contentFit:contain inside them), so this is both dimensions. */
export function homeTileFraction(id: string): number {
  const r = seededRandom(id, 20);
  let acc = 0;
  let scale = SIZE_CLASSES[SIZE_CLASSES.length - 1].scale;
  for (const cls of SIZE_CLASSES) {
    acc += cls.weight;
    if (r < acc) { scale = cls.scale; break; }
  }
  return BASE_TILE_FRACTION * scale;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

export interface HomePlacement {
  x: number;        // 0-1, fraction of canvas width  (tile's left edge)
  y: number;        // 0-1, fraction of canvas height (tile's top edge)
  rotation: number; // degrees
}

// Internally we pack in a square-preserving space: x stays 0-1, y runs
// 0-(1/aspect), so a square tile is `side` on both axes and the packing
// math doesn't have to keep un-stretching itself. Converted back to a
// 0-1 y fraction on the way out.

/** Where a tile's bottom/right edge can reach without clipping. */
export function maxPlacement(side: number, aspect: number) {
  return { maxX: Math.max(0, 1 - side), maxY: Math.max(0, 1 - side * aspect) };
}

/**
 * A tidy collage for the whole wall: a largest-first shelf pack with a
 * little deliberate overlap, centered on the canvas, then nudged and
 * rotated per sticker so it reads as hand-pinned rather than gridded.
 *
 * Deterministic in the sticker ids, so "Tidy" is idempotent — tapping it
 * twice doesn't reshuffle the wall a second time, which is what makes it
 * safe to offer as an undo-the-mess button.
 */
export function computeHomeLayout(ids: string[], aspect: number): Map<string, HomePlacement> {
  const result = new Map<string, HomePlacement>();
  if (ids.length === 0 || aspect <= 0) return result;

  const unitHeight = 1 / aspect;
  const sides = new Map(ids.map(id => [id, homeTileFraction(id)] as const));
  const order = [...ids].sort((a, b) => sides.get(b)! - sides.get(a)!);

  // Negative gap = tiles tuck into each other, like overlapping photos.
  const GAP = -0.015;
  const packed = new Map<string, { x: number; y: number; side: number }>();
  let cursorX = 0;
  let cursorY = 0;
  let shelfHeight = 0;
  let blockWidth = 0;

  for (const id of order) {
    const side = sides.get(id)!;
    if (cursorX > 0 && cursorX + side > 1) {
      cursorX = 0;
      cursorY += shelfHeight + GAP;
      shelfHeight = 0;
    }
    packed.set(id, { x: cursorX, y: cursorY, side });
    cursorX += side + GAP;
    shelfHeight = Math.max(shelfHeight, side);
    blockWidth = Math.max(blockWidth, cursorX - GAP);
  }
  const blockHeight = cursorY + shelfHeight;

  // Center the packed block rather than scaling it to fill: tile size is a
  // pure function of the id (homeTileFraction), and the renderers read that
  // same function — a scale factor applied only here would silently
  // disagree with the size actually drawn.
  const offsetX = (1 - blockWidth) / 2;
  const offsetY = (unitHeight - blockHeight) / 2;

  for (const id of order) {
    const p = packed.get(id)!;
    const jitterX = (seededRandom(id, 21) * 2 - 1) * p.side * 0.10;
    const jitterY = (seededRandom(id, 22) * 2 - 1) * p.side * 0.10;
    const rotation = (seededRandom(id, 23) * 2 - 1) * 9;
    const x = clamp(offsetX + p.x + jitterX, 0, Math.max(0, 1 - p.side));
    const y = clamp(offsetY + p.y + jitterY, 0, Math.max(0, unitHeight - p.side));
    result.set(id, { x, y: y * aspect, rotation });
  }
  return result;
}

/**
 * Where to drop a sticker the user just added, without disturbing anything
 * already placed. Scans a coarse grid of candidate slots and takes the one
 * furthest from every existing tile — so adding five in a row fans them out
 * instead of stacking all five in the middle for the user to untangle.
 */
export function findFreeSpot(
  existing: Array<{ id: string; x: number; y: number }>,
  newId: string,
  aspect: number
): HomePlacement {
  const side = homeTileFraction(newId);
  const { maxX, maxY } = maxPlacement(side, aspect);
  const rotation = (seededRandom(newId, 23) * 2 - 1) * 9;
  if (existing.length === 0) {
    return { x: maxX / 2, y: maxY / 2, rotation };
  }

  // Compare in the square-preserving space, so "furthest away" isn't
  // biased toward the wide axis.
  const centers = existing.map(e => ({
    cx: e.x + homeTileFraction(e.id) / 2,
    cy: (e.y / aspect) + homeTileFraction(e.id) / 2,
  }));

  const COLS = 9;
  const ROWS = 5;
  let best: HomePlacement = { x: maxX / 2, y: maxY / 2, rotation };
  let bestScore = -1;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = COLS > 1 ? (maxX * c) / (COLS - 1) : 0;
      const y = ROWS > 1 ? (maxY * r) / (ROWS - 1) : 0;
      const cx = x + side / 2;
      const cy = y / aspect + side / 2;
      let nearest = Infinity;
      for (const o of centers) {
        nearest = Math.min(nearest, Math.hypot(cx - o.cx, cy - o.cy));
      }
      if (nearest > bestScore) {
        bestScore = nearest;
        best = { x, y, rotation };
      }
    }
  }
  return best;
}
