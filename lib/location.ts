import * as Location from 'expo-location';

export interface CapturedLocation {
  latitude: number;
  longitude: number;
  locationLabel: string | null;
}

const LOCATION_TIMEOUT_MS = 8000;

/**
 * Reverse-geocodes known coordinates (e.g. from a photo's own EXIF/asset
 * GPS data). Never throws — a geocoding failure just yields
 * `locationLabel: null`, keeping the coordinates.
 */
export async function labelForCoordinates(latitude: number, longitude: number): Promise<CapturedLocation> {
  let locationLabel: string | null = null;
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
    locationLabel = place?.district ?? place?.city ?? place?.region ?? null;
  } catch {
    // Reverse-geocoding is best-effort — keep the coordinates without a label.
  }
  return { latitude, longitude, locationLabel };
}

/**
 * Captures the device's CURRENT location — for live camera captures only.
 * Never throws; returns null on permission denial, timeout, or any failure.
 */
export async function captureLocation(): Promise<CapturedLocation | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), LOCATION_TIMEOUT_MS)),
    ]);
    if (!position) return null;

    return await labelForCoordinates(position.coords.latitude, position.coords.longitude);
  } catch {
    return null;
  }
}
