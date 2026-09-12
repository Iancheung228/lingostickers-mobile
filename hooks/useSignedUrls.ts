import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '@/lib/supabase';

// How long the URLs we mint are good for, and how old we let them get before
// replacing them. The gap between the two is the safety margin: a URL handed
// to <Image> at minute 44 still has a quarter of an hour to actually load.
const SIGNED_URL_TTL_SECONDS = 3600;
const REFRESH_AFTER_MS = 45 * 60 * 1000;
// How often we bother to check. Cheap — a subtraction — and coarse on purpose,
// since every screen using this hook runs its own.
const STALENESS_CHECK_MS = 5 * 60 * 1000;

// Signs a whole batch of storage paths in one request instead of one
// createSignedUrl round-trip per item — see skills.md's wall-loading note.
// Firing N individual signed-url requests (one per rendered tile/card) is
// what made stickers visibly pop in one-by-one; this replaces that with a
// single createSignedUrls call, returning a path -> signedUrl map as soon as
// it resolves.
//
// The URLs expire after an hour, and this used to be the end of the story:
// the effect keyed on the *set of paths*, and a focus refetch returns the same
// paths, so it never re-fired. Images already on screen survived that —
// expo-image caches them on disk under the sticker's storage path, not the
// signed URL — but anything scrolled to for the first time after the hour was
// up got a dead link and rendered as nothing, with no error and no way back
// short of relaunching the app. Long sessions are exactly when someone is
// browsing deep into a collection, so the failure landed on the people using
// the app most.
export function useSignedUrls(paths: (string | null | undefined)[]): Map<string, string> {
  const uniquePaths = Array.from(new Set(paths.filter((p): p is string => !!p))).sort();
  const key = uniquePaths.join('|');
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  // Bumped to force a re-sign of the same paths. Part of the effect key below,
  // which is the whole mechanism — the path list alone cannot express "these
  // are the same files, but the links to them have gone stale".
  const [epoch, setEpoch] = useState(0);
  const signedAtRef = useRef(0);

  useEffect(() => {
    const refreshIfStale = () => {
      if (signedAtRef.current === 0) return; // nothing signed yet
      if (Date.now() - signedAtRef.current < REFRESH_AFTER_MS) return;
      setEpoch((e) => e + 1);
    };

    // Two triggers, for the two ways an hour passes: the app sat in the
    // background (foregrounding is the moment that matters), or it was open
    // the whole time and nobody navigated (the interval catches that).
    const timer = setInterval(refreshIfStale, STALENESS_CHECK_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshIfStale();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (!key) { setUrls(new Map()); return; }
    let cancelled = false;
    supabase.storage.from('sticker-images')
      .createSignedUrls(key.split('|'), SIGNED_URL_TTL_SECONDS)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const map = new Map<string, string>();
        for (const entry of data) {
          if (entry.path && entry.signedUrl) map.set(entry.path, entry.signedUrl);
        }
        // Stamped only on success. A failed batch leaves the clock where it
        // was, so the next check retries rather than waiting another 45
        // minutes for a refresh that never happened.
        signedAtRef.current = Date.now();
        setUrls(map);
      });
    return () => { cancelled = true; };
  }, [key, epoch]);

  return urls;
}
