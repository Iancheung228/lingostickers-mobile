import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearPendingAvatar } from '@/lib/pendingAvatar';
import { clearReminders } from '@/lib/reminder';
import { clearNewCardsToday } from '@/lib/studyPrefs';
import { clearStickerCache } from '@/lib/stickerCache';
import { clearUsedAssets } from '@/lib/usedAssetsStore';

// Everything this device remembers about the signed-in account, wiped on
// sign-out, account deletion and session expiry so the next account on the
// phone starts clean. Study prefs are device settings and are kept.
// Never throws, and each step is independent so one failure skips nothing.
export async function clearLocalUserData(userId?: string | null): Promise<void> {
  const steps: Promise<unknown>[] = [
    clearReminders(),
    clearUsedAssets(),
    clearPendingAvatar(),
    clearNewCardsToday(),
    userId ? clearStickerCache(userId) : Promise.resolve(),
    // Also sweep any other account's cache left behind (e.g. an expired session).
    AsyncStorage.getAllKeys()
      .then(keys => AsyncStorage.multiRemove(keys.filter(k => k.startsWith('stickers:v1:'))))
      .catch(() => {}),
  ];
  await Promise.allSettled(steps);
}
