import AsyncStorage from '@react-native-async-storage/async-storage';
import { addUsedAssets, parseUsedAssets } from './usedAssets';

// Per-device record of photo-library asset ids that have become a sticker.
// Written when a card made from an imported asset is saved (scan.tsx handleAdd,
// hooks/useBatchCreate.ts add). Drives the picker's "New" filter. No DB change.
const KEY = 'tabi.used-asset-ids';

let chain: Promise<unknown> = Promise.resolve();

export async function loadUsedAssets(): Promise<Set<string>> {
  try {
    return new Set(parseUsedAssets(await AsyncStorage.getItem(KEY)));
  } catch {
    return new Set();
  }
}

/** Never throws and is safe to fire and forget; writes are serialised so two saves can't clobber each other. */
export function markAssetsUsed(ids: readonly (string | null | undefined)[]): Promise<void> {
  if (!ids.some(Boolean)) return Promise.resolve();
  const run = chain.then(async () => {
    try {
      const cur = parseUsedAssets(await AsyncStorage.getItem(KEY));
      await AsyncStorage.setItem(KEY, JSON.stringify(addUsedAssets(cur, ids)));
    } catch { /* a missed mark only means the photo shows under New again */ }
  });
  chain = run;
  return run;
}
