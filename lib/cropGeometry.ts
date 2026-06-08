export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Corner = 'tl' | 'tr' | 'bl' | 'br';

export interface Point {
  x: number;
  y: number;
}

// Shoelace formula — area enclosed by a closed polygon (the loop is treated
// as implicitly closed, so callers don't need to repeat the first point).
function polygonArea(points: Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

// How much of its own bounding box a loop actually fills. A loose, irregular
// loop (the common case when circling an organic object) has a low ratio —
// its bbox already contains "dead corner" background the user never circled —
// while a loop that hugs a roughly rectangular object sits close to 1. Used
// to scale how much extra margin we add: tight loops need more slack to avoid
// clipping, loose loops already have plenty and need less.
export function polygonFillRatio(points: Point[], bbox: Rect): number {
  if (bbox.width <= 0 || bbox.height <= 0) return 0;
  return polygonArea(points) / (bbox.width * bbox.height);
}

export function boundingBoxOfPoints(points: Point[]): Rect {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// The rect (in container-local coordinates) where a `resizeMode="contain"`
// image actually renders, accounting for letterboxing on the long axis.
export function computeContainRect(containerW: number, containerH: number, imageW: number, imageH: number): Rect {
  'worklet';
  if (containerW <= 0 || containerH <= 0 || imageW <= 0 || imageH <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const containerAspect = containerW / containerH;
  const imageAspect = imageW / imageH;
  if (imageAspect > containerAspect) {
    const width = containerW;
    const height = width / imageAspect;
    return { x: 0, y: (containerH - height) / 2, width, height };
  }
  const height = containerH;
  const width = height * imageAspect;
  return { x: (containerW - width) / 2, y: 0, width, height };
}

export function clampBox(box: Rect, bounds: Rect): Rect {
  'worklet';
  const width = Math.min(box.width, bounds.width);
  const height = Math.min(box.height, bounds.height);
  const x = Math.min(Math.max(box.x, bounds.x), bounds.x + bounds.width - width);
  const y = Math.min(Math.max(box.y, bounds.y), bounds.y + bounds.height - height);
  return { x, y, width, height };
}

// Expands `box` by `ratio` on every side (a conservative margin so a rough
// lasso never clips the object), then clamps the result to `bounds`.
export function padBox(box: Rect, ratio: number, bounds: Rect): Rect {
  'worklet';
  const padX = box.width * ratio;
  const padY = box.height * ratio;
  return clampBox(
    { x: box.x - padX, y: box.y - padY, width: box.width + padX * 2, height: box.height + padY * 2 },
    bounds,
  );
}

// Resizes `start` by dragging `corner` by (dx, dy), keeping the opposite
// corner anchored, enforcing a minimum size, and clamping to `bounds`.
export function resizeBoxFromCorner(corner: Corner, start: Rect, dx: number, dy: number, bounds: Rect, minSize: number): Rect {
  'worklet';
  let { x, y, width, height } = start;
  const right = start.x + start.width;
  const bottom = start.y + start.height;

  if (corner === 'tl' || corner === 'bl') {
    x = start.x + dx;
    width = right - x;
  } else {
    width = start.width + dx;
  }
  if (corner === 'tl' || corner === 'tr') {
    y = start.y + dy;
    height = bottom - y;
  } else {
    height = start.height + dy;
  }

  if (width < minSize) {
    width = minSize;
    if (corner === 'tl' || corner === 'bl') x = right - width;
  }
  if (height < minSize) {
    height = minSize;
    if (corner === 'tl' || corner === 'tr') y = bottom - height;
  }

  if (x < bounds.x) { width -= bounds.x - x; x = bounds.x; }
  if (y < bounds.y) { height -= bounds.y - y; y = bounds.y; }
  if (x + width > bounds.x + bounds.width) width = bounds.x + bounds.width - x;
  if (y + height > bounds.y + bounds.height) height = bounds.y + bounds.height - y;

  return { x, y, width: Math.max(width, minSize), height: Math.max(height, minSize) };
}

// Converts a box drawn in container-local coordinates (relative to where the
// `contain`-mode image actually renders) into a pixel crop rect in the
// original image's coordinate space.
export function boxToImageCrop(box: Rect, displayRect: Rect, imageW: number, imageH: number) {
  const scale = imageW / displayRect.width; // contain mode: scaleX === scaleY
  const originX = Math.round((box.x - displayRect.x) * scale);
  const originY = Math.round((box.y - displayRect.y) * scale);
  const width = Math.round(box.width * scale);
  const height = Math.round(box.height * scale);
  return {
    originX: Math.max(0, Math.min(originX, imageW - 1)),
    originY: Math.max(0, Math.min(originY, imageH - 1)),
    width: Math.max(1, Math.min(width, imageW - Math.max(0, Math.min(originX, imageW - 1)))),
    height: Math.max(1, Math.min(height, imageH - Math.max(0, Math.min(originY, imageH - 1)))),
  };
}
