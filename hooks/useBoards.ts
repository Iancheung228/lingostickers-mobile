import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Board, BoardStickerWithSticker } from '@/lib/types';

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
      .eq('board_id', boardId);
    if (!error && data) setItems(data as unknown as BoardStickerWithSticker[]);
    setLoading(false);
  }, [boardId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const addSticker = useCallback(async (stickerId: string, userId: string, x: number, y: number) => {
    if (!boardId) return { error: new Error('No board') };
    const { data, error } = await supabase
      .from('board_stickers')
      .insert({ board_id: boardId, sticker_id: stickerId, user_id: userId, x, y })
      .select('*, sticker:stickers(*)')
      .single();
    if (!error && data) setItems(prev => [...prev, data as unknown as BoardStickerWithSticker]);
    return { error };
  }, [boardId]);

  const removeSticker = useCallback(async (stickerId: string) => {
    if (!boardId) return { error: new Error('No board') };
    const previous = items;
    setItems(prev => prev.filter(i => i.sticker_id !== stickerId));
    const { error } = await supabase
      .from('board_stickers')
      .delete()
      .eq('board_id', boardId)
      .eq('sticker_id', stickerId);
    if (error) setItems(previous);
    return { error };
  }, [boardId, items]);

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

  return { items, loading, addSticker, removeSticker, updatePosition, refetch: fetchItems };
}
