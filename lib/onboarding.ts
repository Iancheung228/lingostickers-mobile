import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

// First-run onboarding gate (SPEC "Onboarding"): shown once, only when this device
// hasn't marked it done for this user AND the account has no stickers, so an
// existing user never sees it. The flag is per user id (B-app 5).
const key = (userId: string) => `tabi.onboarding.done.v1:${userId}`;

const listeners = new Set<(userId: string) => void>();
export function onOnboardingDone(l: (userId: string) => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export async function markOnboardingDone(userId: string): Promise<void> {
  try { await AsyncStorage.setItem(key(userId), '1'); } catch { /* best effort */ }
  listeners.forEach((l) => l(userId));
}

/**
 * True when this user should see onboarding now. Existing users (flag unset but
 * stickers present) are marked done so the count query runs once. If the count
 * can't be read (offline), onboarding is skipped for this launch and not marked,
 * so a brand-new user still gets it next time.
 */
export async function shouldShowOnboarding(userId: string): Promise<boolean> {
  try {
    if (await AsyncStorage.getItem(key(userId))) return false;
  } catch {
    return false;
  }
  const { count, error } = await supabase
    .from('stickers')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error || count === null) return false;
  if (count > 0) {
    try { await AsyncStorage.setItem(key(userId), '1'); } catch { /* ignore */ }
    return false;
  }
  return true;
}
