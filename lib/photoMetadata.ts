import * as MediaLibrary from 'expo-media-library';
import { CapturedLocation, labelForCoordinates } from './location';

export interface ImportedPhotoMetadata {
  /** ISO timestamp from the photo's own creation date, or null if unknown. */
  discoveredAt: string | null;
  /** Location from the photo's own GPS data, or null if unavailable. */
  location: CapturedLocation | null;
}

const EMPTY_METADATA: ImportedPhotoMetadata = { discoveredAt: null, location: null };

/**
 * Reads the original creation date and GPS location off an imported photo
 * via its media-library asset info — so an imported memory keeps the date
 * and place it actually happened, not "now"/"here".
 *
 * Never throws; returns empty metadata if `assetId` is missing, permission
 * is denied, or the asset has no creation time / location.
 */
export async function getImportedPhotoMetadata(assetId: string | null | undefined): Promise<ImportedPhotoMetadata> {
  if (!assetId) return EMPTY_METADATA;

  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') return EMPTY_METADATA;

    const info = await MediaLibrary.getAssetInfoAsync(assetId);
    const discoveredAt = info.creationTime ? new Date(info.creationTime).toISOString() : null;
    const location = info.location
      ? await labelForCoordinates(info.location.latitude, info.location.longitude)
      : null;

    return { discoveredAt, location };
  } catch {
    return EMPTY_METADATA;
  }
}
