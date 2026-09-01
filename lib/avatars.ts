import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Profile pictures.
//
// Avatars live in their own PUBLIC `avatars` bucket rather than in
// sticker-images — see 030_profile_avatar.sql for why (sticker-images' RLS
// is per-owner-folder, so a friend could never load your face out of it).
// Being public means no signing at all: the URL is derived synchronously
// from the path, so an avatar is a plain <Image source> anywhere a person
// appears, with no round-trip per face and no useSignedUrls batching.
// ---------------------------------------------------------------------------
const BUCKET = 'avatars';

// Square, and small — this is drawn at 22–72pt almost everywhere and at 96pt
// at its very largest, so anything past this is bytes nobody sees.
const AVATAR_SIDE = 512;

/// Public URL for a stored avatar path. Synchronous and never fails, which
/// is the whole point of the public bucket; a missing path just means "no
/// picture yet", which every call site already renders as the initial.
export function avatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/// Opens the photo library with a square crop already enforced, so what the
/// user confirms in the system editor is exactly what ends up in the circle.
/// Returns a local file URI, or null if they cancelled or declined access —
/// the denial is explained here rather than at each call site, so nobody has
/// to re-derive which of the two "null" cases deserves a message.
export async function pickAvatarImage(): Promise<{ uri: string } | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      'Photos Access Needed',
      'LingoStickers needs access to your photo library to set a profile picture.'
    );
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (result.canceled || !result.assets[0]) return null;
  return { uri: result.assets[0].uri };
}

/// Uploads a picked photo as the user's avatar and returns its storage path.
/// The filename is a fresh timestamp every time, so the public URL changes
/// whenever the picture does — otherwise the CDN and expo-image would both
/// keep serving the old face from cache long after it was replaced.
export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  const context = ImageManipulator.manipulate(localUri).resize({ width: AVATAR_SIDE });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });

  const path = `${userId}/${Date.now()}.jpg`;
  const bytes = await new File(saved.uri).bytes();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;

  return path;
}

/// Best-effort cleanup of the file a profile row no longer points at. Called
/// only after the row is repointed, so a failure here leaves an orphaned
/// file rather than an avatar that 404s.
export async function deleteAvatarFile(path: string | null | undefined): Promise<void> {
  if (!path) return;
  await supabase.storage.from(BUCKET).remove([path]);
}
