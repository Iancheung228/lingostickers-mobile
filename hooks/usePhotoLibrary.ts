import { useCallback, useRef, useState } from 'react';
import { BATCH_MAX } from '@/lib/batchScan';
import { toggleSelection } from '@/lib/photoSelection';
import { loadUsedAssets } from '@/lib/usedAssetsStore';
import { fetchRecent, getLibraryAccess, resolvePhoto, type LibAsset, type LibraryAccess, type PickedPhoto } from '@/lib/photoLibrary';

// State shared by the Scan screen's recent strip and the full picker. It lives
// above both (one owner, lesson 1) so a selection made in the strip is still
// there when the picker opens, and a swipe-down on the picker's pageSheet loses
// nothing (lesson 10: the exit can't be vetoed, so the draft outlives it).
export function usePhotoLibrary() {
  const [access, setAccess] = useState<LibraryAccess>('denied');
  const [recent, setRecent] = useState<LibAsset[]>([]);
  const [used, setUsed] = useState<ReadonlySet<string>>(new Set());
  const [selected, setSelected] = useState<LibAsset[]>([]);
  const [capped, setCapped] = useState(false);
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

  const toggle = useCallback((asset: LibAsset) => {
    setSelected((cur) => {
      const r = toggleSelection(cur.map((x) => x.id), asset.id, BATCH_MAX);
      setCapped(r.capped);
      if (r.capped) return cur;
      return r.ids.map((id) => cur.find((x) => x.id === id) ?? asset);
    });
  }, []);

  const clear = useCallback(() => { setSelected([]); setCapped(false); }, []);

  /** Local file uris for the selection, in tap order. A photo that can't be read is dropped. */
  const resolveSelected = useCallback(async (): Promise<PickedPhoto[]> => {
    const out = await Promise.all(selected.map((a) => resolvePhoto(a).catch(() => null)));
    return out.filter((x): x is PickedPhoto => !!x);
  }, [selected]);

  return { access, recent, used, selected, capped, refresh, toggle, clear, resolveSelected };
}
