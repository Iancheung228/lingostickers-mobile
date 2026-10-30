// ---------------------------------------------------------------------------
// Request-body images for the scene paths (create-card, scene-words).
//
// The client sends JPEGs as base64, with or without a data-URL prefix. These
// are forwarded to a paid model, so they are bounded here before any spend:
// a client sending a 40MB "photo" should get a 413, not a large bill.
// ---------------------------------------------------------------------------

/** About 3MB of JPEG. The app sends 800–1600px images, well under this. */
export const MAX_IMAGE_BASE64_CHARS = 4_000_000;

export class ImageError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'ImageError';
  }
}

/** Strips a data-URL prefix and bounds the size. Absent → undefined; malformed → throws. */
export function readImage(raw: unknown, field: string): string | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw !== 'string') throw new ImageError(400, `Invalid ${field}`);
  const data = raw.includes(',') ? raw.split(',')[1] : raw;
  if (!data) throw new ImageError(400, `Invalid ${field}`);
  if (data.length > MAX_IMAGE_BASE64_CHARS) throw new ImageError(413, 'That photo is too large. Try a smaller one.');
  return data;
}
