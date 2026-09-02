import { Alert, Linking } from 'react-native';

/**
 * The one route back out of a permission the user has already denied.
 *
 * `canAskAgain: false` is the case that needs the help: iOS will not show the
 * system dialog again, so calling `request*Async()` a second time resolves
 * straight to `denied` with no UI at all. A "Grant Permission" button in that
 * state looks alive and does nothing, forever. Settings is the only place the
 * decision can still be undone, so that's where we point.
 *
 * While the user *can* still be asked, `reAskable` picks the tone:
 * - `'alert'` repeats the explanation — they may have declined by reflex
 *   mid-flow and want to know what they just lost.
 * - `'silent'` says nothing — they tapped "Don't Allow" on a dialog whose
 *   text we wrote, so they already know.
 */
export function alertPermissionDenied(
  title: string,
  message: string,
  canAskAgain: boolean,
  reAskable: 'alert' | 'silent' = 'alert'
) {
  if (canAskAgain) {
    if (reAskable === 'alert') Alert.alert(title, message);
    return;
  }
  Alert.alert(title, `${message}\n\nYou can turn it back on in Settings.`, [
    { text: 'Not now', style: 'cancel' },
    { text: 'Open Settings', onPress: () => Linking.openSettings() },
  ]);
}
