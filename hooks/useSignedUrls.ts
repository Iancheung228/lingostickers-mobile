import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Signs a whole batch of storage paths in one request instead of one
// createSignedUrl round-trip per item — see skills.md's wall-loading note.
// Firing N individual signed-url requests (one per rendered tile/card) is
// what made stickers visibly pop in one-by-one; this replaces that with a
// single createSignedUrls call, returning a path -> signedUrl map as soon as
// it resolves.
export function useSignedUrls(paths: (string | null | undefined)[]): Map<string, string> {
  const uniquePaths = Array.from(new Set(paths.filter((p): p is string => !!p))).sort();
  const key = uniquePaths.join('|');
  const [urls, setUrls] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!key) { setUrls(new Map()); return; }
    let cancelled = false;
    supabase.storage.from('sticker-images')
      .createSignedUrls(key.split('|'), 3600)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const map = new Map<string, string>();
        for (const entry of data) {
          if (entry.path && entry.signedUrl) map.set(entry.path, entry.signedUrl);
        }
        setUrls(map);
      });
    return () => { cancelled = true; };
  }, [key]);

  return urls;
}
