import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { uploadAvatar } from '@/lib/avatars';

// ---------------------------------------------------------------------------
// The sign-up screen asks for a profile picture, but at that moment there is
// no session yet — email confirmation lands the user on check-email, and the
// account only becomes real when they follow the link. Storage writes are
// gated on `auth.uid()` matching the folder, so the picture simply can't be
// uploaded there and then.
//
// So the picked photo is parked here (the file itself stays in the app's
// cache, this only remembers where) and uploaded on the first launch that
// actually has a session. If sign-up *did* return a session immediately, the
// caller uploads directly and never touches this.
// ---------------------------------------------------------------------------
const KEY = 'pendingAvatarUri';

export async function stashPendingAvatar(uri: string): Promise<void> {
  await AsyncStorage.setItem(KEY, uri);
}

export async function clearPendingAvatar(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

/// Uploads a photo picked during sign-up, once the user is finally signed in.
/// Deliberately best-effort and one-shot: the cached file may be long gone by
/// the time the confirmation link is followed, and a profile picture is not
/// worth an error dialog on first launch — the profile screen can always set
/// one instead.
export async function flushPendingAvatar(userId: string): Promise<void> {
  const uri = await AsyncStorage.getItem(KEY);
  if (!uri) return;
  await AsyncStorage.removeItem(KEY);

  try {
    // Never clobber a picture the user has since chosen for themselves — a
    // stale stash from an abandoned sign-up must not overwrite it.
    const { data } = await supabase
      .from('profiles')
      .select('avatar_path')
      .eq('id', userId)
      .single();
    if (data?.avatar_path) return;

    const path = await uploadAvatar(userId, uri);
    await supabase.from('profiles').update({ avatar_path: path }).eq('id', userId);
  } catch {
    // Cache evicted, or the upload failed. Nothing to recover, nothing to say.
  }
}
