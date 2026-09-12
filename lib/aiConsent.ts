import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------------------------------------------------------------------------
// Consent to sending a photo to third-party AI services.
//
// App Store Review Guideline 5.1.2(i), revised 13 November 2025:
//
//   "You must clearly disclose where personal data will be shared with third
//    parties, including with third-party AI, and obtain explicit permission
//    before doing so."
//
// A link to the privacy policy does not satisfy this — Apple has been explicit
// that the disclosure has to be in-app and the permission explicit, obtained
// BEFORE the first transmission. Scanning is the only thing this app does that
// sends a photo anywhere, so the gate sits in front of the scanner, ahead of
// even the camera-permission prompt: there is no reason to ask for the camera
// before the person has agreed to what happens to what it captures.
//
// Stored per user id rather than per device, so switching accounts on a shared
// phone re-asks. Deliberately NOT stored server-side: a local record means a
// reinstall re-asks, which is the safe direction to be wrong in.
// ---------------------------------------------------------------------------

const PREFIX = 'aiConsent:v1:';

/**
 * The processors a scan actually reaches, and what each one does.
 *
 * This list is the disclosure. It MUST stay in step with the table in
 * `docs/privacy.html` — if a processor is added or removed there and not here,
 * the consent the user gave no longer covers what the app does. Bumping the
 * PREFIX version above re-asks everyone, which is the correct response to this
 * list changing.
 */
export const AI_PROCESSORS = [
  { name: 'Google', short: 'reads it and writes the word' },
  { name: 'Replicate', short: 'cuts out the background' },
  { name: 'remove.bg', short: 'backup for the background' },
] as const;

export function useAiConsent(userId: string | undefined) {
  // `undefined` means "not known yet" — the gate must not flash before the
  // stored answer has been read, or every launch shows a consent screen for a
  // frame to someone who already agreed.
  const [accepted, setAccepted] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setAccepted(undefined);
      return;
    }
    AsyncStorage.getItem(PREFIX + userId)
      .then((value) => {
        if (!cancelled) setAccepted(value === '1');
      })
      .catch(() => {
        // A storage fault must not silently grant consent.
        if (!cancelled) setAccepted(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const accept = useCallback(async () => {
    if (!userId) return;
    setAccepted(true);
    await AsyncStorage.setItem(PREFIX + userId, '1').catch(() => {});
  }, [userId]);

  return { accepted, accept };
}
