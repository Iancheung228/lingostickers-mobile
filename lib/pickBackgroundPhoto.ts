import * as ImagePicker from 'expo-image-picker';
import { alertPermissionDenied } from '@/lib/permissions';
import type { PickedPhoto } from '@/lib/backgroundLibrary';

/// The one "Choose from Photos" path for board backgrounds (board menu and
/// New board both use it): permission, then the library picker. Null when
/// denied or cancelled.
export async function pickBackgroundPhoto(): Promise<PickedPhoto | null> {
  const { granted, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!granted) {
    alertPermissionDenied(
      'Photos Access Needed',
      'Tabi Stickers needs access to your photo library to set a board background.',
      canAskAgain,
    );
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  const asset = !result.canceled ? result.assets[0] : null;
  return asset ? { uri: asset.uri, width: asset.width, height: asset.height } : null;
}
