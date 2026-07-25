import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Board, BoardStickerWithSticker } from '@/lib/types';
import { computeAutoLayout } from '@/lib/boardLayout';

export function useBoards(userId: string | undefined) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBoards = useCallback(async () => {
    if (!userId) {
      setBoards([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('boards')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (!error && data) setBoards(data as Board[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchBoards(); }, [fetchBoards]);

  const createBoard = useCallback(async (name: string) => {
    if (!userId) return { error: new Error('Not signed in'), board: null };
    const { data, error } = await supabase
      .from('boards')
      .insert({ user_id: userId, name })
      .select()
      .single();
    if (!error && data) setBoards(prev => [data as Board, ...prev]);
    return { error, board: (data as Board | null) ?? null };
  }, [userId]);

  const deleteBoard = useCallback(async (id: string) => {
    const previous = boards;
    setBoards(prev => prev.filter(b => b.id !== id));
    const { error } = await supabase.from('boards').delete().eq('id', id);
    if (error) setBoards(previous);
    return { error };
  }, [boards]);

  return { boards, loading, createBoard, deleteBoard, refetch: fetchBoards };
}

// Manages one board's stickers — membership plus each sticker's dragged
// (x, y, rotation) on that board's freeform canvas.
export function useBoardStickers(boardId: string | undefined) {
  const [items, setItems] = useState<BoardStickerWithSticker[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    if (!boardId) {
      setItems([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('board_stickers')
      .select('*, sticker:stickers(*)')
      .eq('board_id', boardId)
      .order('added_at', { ascending: true });
    if (!error && data) setItems(data as unknown as BoardStickerWithSticker[]);
    setLoading(false);
  }, [boardId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // Persists a freshly-computed layout for a set of existing items —
  // updates local state immediately, then fires the DB writes in parallel.
  const persistLayout = useCallback((
    current: BoardStickerWithSticker[],
    layout: Map<string, { x: number; y: number; rotation: number }>
  ) => {
    if (!boardId) return;
    const relaid = current.map(i => {
      const pos = layout.get(i.sticker_id);
      return pos ? { ...i, x: pos.x, y: pos.y, rotation: pos.rotation } : i;
    });
    setItems(relaid);
    Promise.all(relaid.map(i => {
      const pos = layout.get(i.sticker_id);
      if (!pos) return Promise.resolve();
      return supabase.from('board_stickers')
        .update({ x: pos.x, y: pos.y, rotation: pos.rotation })
        .eq('board_id', boardId).eq('sticker_id', i.sticker_id);
    })).then(() => {});
  }, [boardId]);

  // Adds a sticker and re-flows the whole board into a fresh scattered-grid
  // layout (see lib/boardLayout.ts) rather than dropping it at a fixed,
  // near-center spot — keeps a batch of adds from piling up overlapping.
  const addSticker = useCallback(async (
    stickerId: string, userId: string, canvasSize: { width: number; height: number }
  ) => {
    if (!boardId) return { error: new Error('No board') };
    const ids = [...items.map(i => i.sticker_id), stickerId];
    const layout = computeAutoLayout(ids, canvasSize);
    const { x, y, rotation } = layout.get(stickerId) ?? { x: 0, y: 0, rotation: 0 };

    const { data, error } = await supabase
      .from('board_stickers')
      .insert({ board_id: boardId, sticker_id: stickerId, user_id: userId, x, y, rotation })
      .select('*, sticker:stickers(*)')
      .single();
    if (error || !data) return { error };

    const newItem = data as unknown as BoardStickerWithSticker;
    persistLayout(items, layout); // re-flow the existing stickers into their new slots
    setItems(prev => [...prev, newItem]);
    return { error: null };
  }, [boardId, items, persistLayout]);

  const removeSticker = useCallback(async (
    stickerId: string, canvasSize?: { width: number; height: number }
  ) => {
    if (!boardId) return { error: new Error('No board') };
    const previous = items;
    const remaining = items.filter(i => i.sticker_id !== stickerId);
    setItems(remaining);
    const { error } = await supabase
      .from('board_stickers')
      .delete()
      .eq('board_id', boardId)
      .eq('sticker_id', stickerId);
    if (error) {
      setItems(previous);
      return { error };
    }
    // Close the gap left behind by re-flowing what's left, so removing one
    // sticker from the middle doesn't leave an empty hole in the collage.
    if (canvasSize && remaining.length > 0) {
      const layout = computeAutoLayout(remaining.map(i => i.sticker_id), canvasSize);
      persistLayout(remaining, layout);
    }
    return { error: null };
  }, [boardId, items, persistLayout]);

  // Re-flows every current sticker into a fresh layout on demand — useful
  // after manual dragging has left things messy, or the canvas was resized.
  const autoArrange = useCallback((canvasSize: { width: number; height: number }) => {
    if (items.length === 0) return;
    const layout = computeAutoLayout(items.map(i => i.sticker_id), canvasSize);
    persistLayout(items, layout);
  }, [items, persistLayout]);

  // Fire-and-forget: called on drag end, no optimistic rollback needed since
  // the dragged view already reflects the new position locally. Still has to
  // be .then()'d though — supabase-js query builders are lazy thenables and
  // never issue the request at all unless awaited or .then()'d.
  const updatePosition = useCallback((stickerId: string, x: number, y: number) => {
    if (!boardId) return;
    setItems(prev => prev.map(i => i.sticker_id === stickerId ? { ...i, x, y } : i));
    supabase.from('board_stickers').update({ x, y }).eq('board_id', boardId).eq('sticker_id', stickerId)
      .then(({ error }) => { if (error) console.warn('Failed to save board sticker position', error); });
  }, [boardId]);

  return { items, loading, addSticker, removeSticker, updatePosition, autoArrange, refetch: fetchItems };
}
