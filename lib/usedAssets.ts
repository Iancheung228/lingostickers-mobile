// Pure rules for "which photos already became a sticker". Framework-free so a
// node test pins them down (scripts/test-photo-picker.mts); the AsyncStorage
// side is lib/usedAssetsStore.ts.
//
// Stickers do not store their source asset id, so this is a per-device list:
// a photo used on another phone, or before this shipped, still counts as New.

/** Newest ids are kept; the oldest fall off past this many. */
export const USED_ASSETS_CAP = 5000;

export function parseUsedAssets(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is string => typeof x === 'string' && x.length > 0);
  } catch {
    return [];
  }
}

/** Appends `ids` (deduped, moved to newest), then trims to `cap` keeping the newest. */
export function addUsedAssets(list: readonly string[], ids: readonly (string | null | undefined)[], cap = USED_ASSETS_CAP): string[] {
  const add = ids.filter((x): x is string => !!x);
  if (!add.length) return list.slice();
  const drop = new Set(add);
  const next = [...list.filter((x) => !drop.has(x)), ...new Set(add)];
  return next.length > cap ? next.slice(next.length - cap) : next;
}
