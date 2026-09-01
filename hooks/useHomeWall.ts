import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { HomeStickerWithSticker } from '@/lib/types';
import { computeHomeLayout, findFreeSpot } from '@/lib/homeWall';

// The stickers the user has pinned to the home screen's mini wall, and
// where they dragged each one to (normalized — see lib/homeWall.ts).
//
// Mounted once, in MiniStickerWall, and passed down to the editor as props
// rather than the editor calling this hook a second time: two call sites
// would each get their own private copy of the list and silently diverge
// the moment one of them mutated — skills.md #1. There's no cross-screen
// reader here, so a plain hook with one owner is the right shape; it
// doesn't need to become a Context.
export function useHomeWall(userId: string | undefined) {
  const [items, setItems] = useState<HomeStickerWithSticker[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('home_stickers')
      .select('*, sticker:stickers(*)')
      .eq('user_id', userId)
      .order('added_at', { ascending: true });
    if (!error && data) {
      // A sticker deleted from the collection leaves its home_stickers row
      // to cascade away, but an in-flight fetch can still see the join come
      // back null — drop those rather than rendering a tile with no image.
      setItems((data as unknown as HomeStickerWithSticker[]).filter(i => !!i.sticker));
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const addSticker = useCallback(async (stickerId: string, aspect: number) => {
    if (!userId) return { error: new Error('Not signed in') };
    const spot = findFreeSpot(
      items.map(i => ({ id: i.sticker_id, x: i.x, y: i.y })),
      stickerId,
      aspect
    );
    const { data, error } = await supabase
      .from('home_stickers')
      .insert({ user_id: userId, sticker_id: stickerId, ...spot })
      .select('*, sticker:stickers(*)')
      .single();
    if (!error && data) setItems(prev => [...prev, data as unknown as HomeStickerWithSticker]);
    return { error };
  }, [userId, items]);

  const removeSticker = useCallback(async (stickerId: string) => {
    if (!userId) return { error: new Error('Not signed in') };
    const previous = items;
    setItems(prev => prev.filter(i => i.sticker_id !== stickerId));
    const { error } = await supabase
      .from('home_stickers')
      .delete()
      .eq('user_id', userId)
      .eq('sticker_id', stickerId);
    if (error) setItems(previous);
    return { error };
  }, [userId, items]);

  // Fire-and-forget on the write: the tile the user dragged is already
  // sitting where they let go of it, so awaiting the round-trip would only
  // add a stall before the next drag. Still has to be .then()'d — supabase-js
  // query builders are lazy thenables and never run otherwise.
  const moveSticker = useCallback((stickerId: string, x: number, y: number) => {
    if (!userId) return;
    setItems(prev => prev.map(i => i.sticker_id === stickerId ? { ...i, x, y } : i));
    supabase.from('home_stickers').update({ x, y })
      .eq('user_id', userId).eq('sticker_id', stickerId)
      .then(() => {});
  }, [userId]);

  // Re-flows every pinned sticker into a fresh collage — the escape hatch
  // for a wall that free placement has left in a heap. Deterministic in the
  // sticker ids, so tapping it twice is a no-op rather than a reshuffle.
  const tidy = useCallback(async (aspect: number) => {
    if (!userId || items.length === 0) return { error: null };
    const layout = computeHomeLayout(items.map(i => i.sticker_id), aspect);
    setItems(prev => prev.map(i => {
      const pos = layout.get(i.sticker_id);
      return pos ? { ...i, ...pos } : i;
    }));
    const results = await Promise.all(
      items.map(i => {
        const pos = layout.get(i.sticker_id);
        if (!pos) return Promise.resolve({ error: null });
        return supabase.from('home_stickers')
          .update({ x: pos.x, y: pos.y, rotation: pos.rotation })
          .eq('user_id', userId).eq('sticker_id', i.sticker_id);
      })
    );
    return { error: (results.find(r => r.error)?.error as Error | undefined) ?? null };
  }, [userId, items]);

  // One-time hand-off from the auto fan to a real arrangement: the first
  // time the user opens the editor, whatever the panel was already showing
  // becomes their starting wall, laid out tidily so every tile is grabbable.
  // Without this, "Arrange" would open onto an empty canvas and the wall
  // they'd been looking at for weeks would appear to have been thrown away.
  const seedFrom = useCallback(async (stickerIds: string[], aspect: number) => {
    if (!userId || stickerIds.length === 0) return { error: null };
    const layout = computeHomeLayout(stickerIds, aspect);
    const rows = stickerIds.map(id => ({
      user_id: userId,
      sticker_id: id,
      ...(layout.get(id) ?? { x: 0, y: 0, rotation: 0 }),
    }));
    const { data, error } = await supabase
      .from('home_stickers')
      .insert(rows)
      .select('*, sticker:stickers(*)');
    if (!error && data) setItems(data as unknown as HomeStickerWithSticker[]);
    return { error };
  }, [userId]);

  return { items, loading, addSticker, removeSticker, moveSticker, tidy, seedFrom, refetch: fetchItems };
}
