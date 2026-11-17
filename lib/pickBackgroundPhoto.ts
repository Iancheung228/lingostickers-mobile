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

/// Cap a photo at SOURCE_MAX_SIDE before it is stored as an uncropped source.
export async function shrinkForStorage(source: PickedPhoto): Promise<PickedPhoto> {
  const longSide = Math.max(source.width, source.height);
  if (longSide <= SOURCE_MAX_SIDE) return source;
  const ratio = SOURCE_MAX_SIDE / longSide;
  const rendered = await ImageManipulator.manipulate(source.uri)
    .resize({ width: Math.round(source.width * ratio), height: Math.round(source.height * ratio) })
    .renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
  return { uri: saved.uri, width: rendered.width, height: rendered.height };
}
