function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h;
}

// Deterministic per-sticker "randomness" (rotation, jitter, tape color, …)
// so scatter/tape layouts don't reshuffle on every re-render.
export function seededRandom(seed: string, salt: number): number {
  const x = Math.sin(hashString(`${seed}:${salt}`)) * 10000;
  return x - Math.floor(x);
}
