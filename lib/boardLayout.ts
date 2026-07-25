// Auto-layout for custom board stickers — arranges a set of stickers as a
// hand-pinned corkboard collage: varied tile sizes, packed shelf-by-shelf
// (not a uniform grid), with slight rotation and slight overlap between
// neighbors. Nothing here is persisted beyond x/y/rotation — tile size is a
// pure function of the sticker id, so the client always agrees on it without
// a database column.

export interface LayoutPosition {
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
}

export const BASE_TILE_WIDTH = 88;
export const BASE_TILE_HEIGHT = 100;

// A few discrete size classes (rather than continuous random sizes) so the
// board reads as a deliberate size hierarchy — one or two "featured" large
// stickers per screenful, a handful of small ones, mostly medium — like a
// real magazine collage, not randomly-scaled noise.
const SIZE_CLASSES = [
  { scale: 0.8, weight: 0.3 },
  { scale: 1.0, weight: 0.5 },
  { scale: 1.3, weight: 0.2 },
];

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h;
}

// Deterministic per-sticker "randomness" so re-running the layout for the
// same set of stickers always lands them in the same spot/size — the result
// reads as an intentional collage rather than reshuffling on every render.
function seededRandom(seed: string, salt: number): number {
  const x = Math.sin(hashString(`${seed}:${salt}`)) * 10000;
  return x - Math.floor(x);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** The tile size a given sticker id renders at — same formula everywhere
 * (layout math here, and BoardCanvas's drag-clamp bounds), so a tile's
 * drag boundaries always match its actual rendered footprint. */
export function getTileSize(id: string): { width: number; height: number } {
  const r = seededRandom(id, 0);
  let acc = 0;
  let scale = SIZE_CLASSES[SIZE_CLASSES.length - 1].scale;
  for (const cls of SIZE_CLASSES) {
    acc += cls.weight;
    if (r < acc) { scale = cls.scale; break; }
  }
  return { width: Math.round(BASE_TILE_WIDTH * scale), height: Math.round(BASE_TILE_HEIGHT * scale) };
}

// How tightly neighboring tiles are allowed to tuck into each other —
// negative gap = deliberate overlap, like photos overlapping on a pinboard.
const SHELF_GAP = -10;
const OVERLAP_NUDGE = 14;

/**
 * Packs `ids` into a corkboard collage sized to canvasSize: a shelf/masonry
 * pack (largest-first, wrapping to a new row when the current one is full)
 * rather than a uniform grid, so different-sized tiles nest together with a
 * bit of deliberate overlap instead of leaving uniform gutters. The packed
 * block is then scaled and centered to fill canvasSize, and each tile gets a
 * small random rotation and positional nudge for a hand-placed feel.
 */
export function computeAutoLayout(
  ids: string[],
  canvasSize: { width: number; height: number }
): Map<string, LayoutPosition> {
  const result = new Map<string, LayoutPosition>();
  const n = ids.length;
  if (n === 0 || canvasSize.width <= 0 || canvasSize.height <= 0) return result;

  const sizes = new Map(ids.map(id => [id, getTileSize(id)] as const));
  // Largest-first packs more predictably (big anchors first, small ones fill
  // gaps around them) — classic greedy shelf-packing order.
  const order = [...ids].sort((a, b) => {
    const areaA = sizes.get(a)!.width * sizes.get(a)!.height;
    const areaB = sizes.get(b)!.width * sizes.get(b)!.height;
    return areaB - areaA;
  });

  const packWidth = canvasSize.width;
  const positions = new Map<string, { x: number; y: number; width: number; height: number }>();

  let cursorX = 0;
  let cursorY = 0;
  let shelfHeight = 0;
  let maxX = 0;

  for (const id of order) {
    const { width, height } = sizes.get(id)!;
    if (cursorX > 0 && cursorX + width > packWidth) {
      // Wrap to a new shelf, tucked up under the previous one's overlap gap.
      cursorX = 0;
      cursorY += shelfHeight + SHELF_GAP;
      shelfHeight = 0;
    }
    positions.set(id, { x: cursorX, y: cursorY, width, height });
    cursorX += width + SHELF_GAP;
    shelfHeight = Math.max(shelfHeight, height);
    maxX = Math.max(maxX, cursorX - SHELF_GAP);
  }
  const packHeight = cursorY + shelfHeight;

  // Scale the packed block to fill canvasSize (up OR down) so a handful of
  // stickers doesn't sit tiny in a corner, and a packed-tight set doesn't
  // spill past the visible board.
  const scaleX = packWidth > 0 ? canvasSize.width / Math.max(maxX, 1) : 1;
  const scaleY = packHeight > 0 ? canvasSize.height / Math.max(packHeight, 1) : 1;
  const scale = Math.min(scaleX, scaleY, 1.6); // cap so sparse boards don't blow tiles up absurdly

  for (const id of order) {
    const pos = positions.get(id)!;
    const width = pos.width * scale;
    const height = pos.height * scale;

    // Deterministic jitter + rotation, biased so each tile looks nudged
    // from its packed slot rather than perfectly aligned to it.
    const jitterX = (seededRandom(id, 1) * 2 - 1) * OVERLAP_NUDGE;
    const jitterY = (seededRandom(id, 2) * 2 - 1) * OVERLAP_NUDGE;
    const rotation = (seededRandom(id, 3) * 2 - 1) * 12;

    const x = clamp(pos.x * scale + jitterX, 0, Math.max(0, canvasSize.width - width));
    const y = clamp(pos.y * scale + jitterY, 0, Math.max(0, canvasSize.height - height));

    result.set(id, { x, y, rotation, width, height });
  }

  return result;
}
