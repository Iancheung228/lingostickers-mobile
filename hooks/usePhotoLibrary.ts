import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { BATCH_MAX } from '@/lib/batchScan';
import { toggleSelection } from '@/lib/photoSelection';
import { loadUsedAssets } from '@/lib/usedAssetsStore';
import { fetchRecent, getLibraryAccess, resolvePhoto, type LibAsset, type LibraryAccess, type PickedPhoto } from '@/lib/photoLibrary';

// State shared by the Scan screen's recent strip and the full picker. It lives
// above both (one owner, lesson 1) so a selection made in the strip is still
// there when the picker opens, and a swipe-down on the picker's pageSheet loses
// nothing (lesson 10: the exit can't be vetoed, so the draft outlives it).
export function usePhotoLibrary(userId?: string | null) {
  const [access, setAccess] = useState<LibraryAccess>('denied');
  const [recent, setRecent] = useState<LibAsset[]>([]);
  const [used, setUsed] = useState<ReadonlySet<string>>(new Set());
  const [selected, setSelected] = useState<LibAsset[]>([]);
  const [capped, setCapped] = useState(false);
  // Bumped when the system may have changed what we can see ("Allow more
  // photos"): access stays 'limited', so nothing else would tell the picker.
  const [reloadToken, setReloadToken] = useState(0);
  const seq = useRef(0);

  /** Re-reads permission, the used-photo list and the newest photos. Returns the access it found. */
  const refresh = useCallback(async (): Promise<LibraryAccess> => {
    const ticket = ++seq.current;
    const a = await getLibraryAccess();
    if (a === 'denied') {
      if (ticket === seq.current) { setAccess(a); setRecent([]); setSelected([]); }
      return a;
    }
    const [r, u] = await Promise.all([fetchRecent().catch(() => [] as LibAsset[]), loadUsedAssets()]);
    if (ticket === seq.current) { setAccess(a); setRecent(r); setUsed(u); }
    return a;
  }, []);

  /** refresh(), then tell the picker to re-read its grid and albums. */
  const reload = useCallback(async () => {
    const a = await refresh();
    setReloadToken((t) => t + 1);
    return a;
  }, [refresh]);

  // A different account on this device: drop what the last one marked used
  // (sign-out clears the store on disk) and read it again.
  const lastUser = useRef(userId);
  useEffect(() => {
    if (lastUser.current === userId) return;
    lastUser.current = userId;
    setUsed(new Set());
    setSelected([]);
    void refresh();
  }, [userId, refresh]);

  // Access can change in Settings while the app is backgrounded.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void refresh(); });
    return () => sub.remove();
  }, [refresh]);

  /** A photo just became a sticker: show it as used now, not at the next refocus. */
  const markUsed = useCallback((ids: readonly (string | null | undefined)[]) => {
    const real = ids.filter((x): x is string => !!x);
    if (!real.length) return;
    setUsed((cur) => new Set([...cur, ...real]));
  }, []);

  const toggle = useCallback((asset: LibAsset) => {
    setSelected((cur) => {
      const r = toggleSelection(cur.map((x) => x.id), asset.id, BATCH_MAX);
      setCapped(r.capped);
      if (r.capped) return cur;
      return r.ids.map((id) => cur.find((x) => x.id === id) ?? asset);
    });
  }, []);

  const clear = useCallback(() => { setSelected([]); setCapped(false); }, []);

  /** Local file uris for the selection, in tap order. A photo that can't be read is dropped and counted in `failed`. */
  const resolveSelected = useCallback(async (): Promise<{ photos: PickedPhoto[]; failed: number }> => {
    const out = await Promise.all(selected.map((a) => resolvePhoto(a).catch(() => null)));
    const photos = out.filter((x): x is PickedPhoto => !!x);
    return { photos, failed: out.length - photos.length };
  }, [selected]);

  return { access, recent, used, selected, capped, reloadToken, refresh, reload, markUsed, toggle, clear, resolveSelected };
}
