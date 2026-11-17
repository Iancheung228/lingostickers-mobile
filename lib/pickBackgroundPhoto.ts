import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { alertPermissionDenied } from '@/lib/permissions';
import type { PickedPhoto } from '@/lib/backgroundLibrary';

/// The uncropped source is kept only so the framing can be changed later, and
/// it's never drawn at full size — so it's capped, a little above the visible
/// cap (1600) to leave real room to zoom into. Uncapped it would be the entire
/// original photo, several MB each, uploaded to be looked at approximately never.
export const SOURCE_MAX_SIDE = 2048;

/// How many photos "Add photos to saved" takes in one go. Each is an upload
/// of up to ~1 MB plus a thumbnail, done one after another.
export const LIBRARY_ADD_LIMIT = 20;

async function ensurePhotosPermission(): Promise<boolean> {
  const { granted, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!granted) {
    alertPermissionDenied(
      'Photos Access Needed',
      'Tabi Stickers needs access to your photo library to set a board background.',
      canAskAgain,
    );
  }
  return granted;
}

/// The one "Choose from Photos" path for board backgrounds (board menu and
/// New board both use it): permission, then the library picker. Null when
/// denied or cancelled.
export async function pickBackgroundPhoto(): Promise<PickedPhoto | null> {
  if (!(await ensurePhotosPermission())) return null;
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  const asset = !result.canceled ? result.assets[0] : null;
  return asset ? { uri: asset.uri, width: asset.width, height: asset.height } : null;
}

/// Several photos at once, for stocking the saved-backgrounds library without
/// applying any of them. Empty when denied or cancelled.
export async function pickBackgroundPhotos(limit = LIBRARY_ADD_LIMIT): Promise<PickedPhoto[]> {
  if (!(await ensurePhotosPermission())) return [];
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsMultipleSelection: true,
    selectionLimit: limit,
    orderedSelection: true,
  });
  if (result.canceled) return [];
  return result.assets.map(a => ({ uri: a.uri, width: a.width, height: a.height }));
}

/// Re-encode a photo as JPEG, capped at SOURCE_MAX_SIDE on its long side,
/// before it is stored as an uncropped source. Always re-encoded: the file is
/// uploaded as image/jpeg under a .jpg name, and a PNG/HEIC original would be
/// mislabelled. Only the long side is passed to resize (the other follows the
/// real aspect), and the returned size is read off the rendered result, since
/// picker metadata can be pre-rotation (EXIF) and stretch a rotated image.
export async function shrinkForStorage(source: PickedPhoto): Promise<PickedPhoto> {
  const ctx = ImageManipulator.manipulate(source.uri);
  if (Math.max(source.width, source.height) > SOURCE_MAX_SIDE) {
    ctx.resize(source.width >= source.height ? { width: SOURCE_MAX_SIDE } : { height: SOURCE_MAX_SIDE });
  }
  const rendered = await ctx.renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
  return { uri: saved.uri, width: rendered.width, height: rendered.height };
}
