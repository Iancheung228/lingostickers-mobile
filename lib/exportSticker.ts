import { Alert } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { trackEvent } from '@/lib/analytics';
import { Sticker } from '@/lib/types';
import { alertPermissionDenied } from '@/lib/permissions';

/**
 * Getting a sticker out of the app and into the rest of the phone — the
 * photo library, or straight into a chat via the share sheet.
 *
 * The cutout is exported byte-for-byte as it's stored: a transparent PNG
 * (see lib/cutout.ts). No re-encode, deliberately — that alpha channel is
 * the entire point. It's what lets iOS long-press a saved cutout in Photos
 * and lift it into a real chat sticker, and what keeps a shared one from
 * landing in a message inside a white box. Any pass through
 * ImageManipulator's JPEG path here would quietly destroy the feature.
 */

/**
 * Filesystem-safe stem, since `word` is routinely Japanese and `translation`
 * routinely has spaces. Falls back to a literal 'sticker' rather than an
 * empty name for a word that transliterates to nothing.
 */
function fileNameFor(sticker: Sticker): string {
  const stem = (sticker.translation || sticker.word)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${stem || 'sticker'}.png`;
}

/**
 * Signs the cutout and pulls it down to a local file the OS APIs can take —
 * neither MediaLibrary nor Sharing will accept a remote URL.
 *
 * Re-downloaded on every export rather than cached: this lives in the cache
 * directory the OS may evict at any moment, and one fetch per tap is
 * cheaper than reasoning about a stale copy (same call this makes in
 * BoardCarouselPage's reposition path).
 */
async function downloadCutoutUri(sticker: Sticker): Promise<string> {
  const { data, error } = await supabase.storage
    .from('sticker-images')
    .createSignedUrl(sticker.image_path, 3600);
  if (error || !data) throw error ?? new Error('Could not read this sticker.');

  const dest = new File(Paths.cache, fileNameFor(sticker));
  if (dest.exists) dest.delete();
  const downloaded = await File.downloadFileAsync(data.signedUrl, dest);
  return downloaded.uri;
}

/**
 * Saves the cutout into the photo library.
 *
 * Asks for write-only access on purpose: this feature never reads the
 * library, so it should request exactly the grant that
 * NSPhotoLibraryAddUsageDescription covers and no more. Reading photo EXIF
 * (lib/photoMetadata.ts) is a separate, much wider permission — don't
 * collapse the two into one request just because both say "photos".
 */
export async function saveStickerToPhotos(sticker: Sticker): Promise<boolean> {
  try {
    const { granted, canAskAgain } = await MediaLibrary.requestPermissionsAsync(true);
    if (!granted) {
      // 'silent' because they just tapped "Don't Allow" on our own dialog.
      alertPermissionDenied(
        'Photos access is off',
        'Tabi Stickers needs permission to add pictures to your photo library before it can save a sticker there.',
        canAskAgain,
        'silent'
      );
      return false;
    }

    const uri = await downloadCutoutUri(sticker);
    await MediaLibrary.saveToLibraryAsync(uri);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    trackEvent('sticker_saved_to_photos');
    return true;
  } catch (err: any) {
    Alert.alert("Couldn't save the sticker", err?.message ?? 'Something went wrong.');
    return false;
  }
}

/**
 * Opens the system share sheet on the cutout, which is what actually gets a
 * sticker into a conversation. Resolves once the sheet closes — the OS does
 * not tell us whether anything was sent, so there's no success message here
 * on purpose: the sheet was the feedback.
 */
export async function shareSticker(sticker: Sticker): Promise<boolean> {
  try {
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Sharing unavailable', "This device can't open the share sheet.");
      return false;
    }

    const uri = await downloadCutoutUri(sticker);
    await Sharing.shareAsync(uri, {
      UTI: 'public.png',
      mimeType: 'image/png',
      dialogTitle: `Share "${sticker.word}"`,
    });

    trackEvent('sticker_shared');
    return true;
  } catch (err: any) {
    Alert.alert("Couldn't share the sticker", err?.message ?? 'Something went wrong.');
    return false;
  }
}
