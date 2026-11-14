import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Sticker } from '@/lib/types';

// Read cache for the Home list (B-app 9 item 4), so a cold start with no network
// still shows the collection. Rows hold storage paths (`image_path`, never signed
// URLs: they expire, lesson 17); images come from expo-image's disk cache under the
// same cacheKey. Read-only: nothing here is a write queue.
const key = (userId: string) => `stickers:v1:${userId}`;

export async function readStickerCache(userId: string): Promise<Sticker[] | null> {
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Sticker[]) : null;
  } catch {
    return null;
  }
}

export async function writeStickerCache(userId: string, stickers: Sticker[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key(userId), JSON.stringify(stickers));
  } catch {
    // Best effort: a full disk must not break the screen.
  }
}

export async function clearStickerCache(userId: string): Promise<void> {
  try { await AsyncStorage.removeItem(key(userId)); } catch { /* ignore */ }
}
