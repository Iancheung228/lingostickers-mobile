import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { BackgroundCrop, Board, BoardStickerWithSticker } from '@/lib/types';
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

  // The name was write-once until now: NewBoardSheet set it at creation and
  // nothing could ever change it, so fixing a typo meant deleting the board
  // and losing every sticker position on it. The column and the boards
  // `FOR ALL` RLS policy (014_custom_boards.sql) always allowed this.
  // Local-state patch rather than a refetch, so the rail's label — which
  // reads board.name off this same array — updates in the same frame.
  const renameBoard = useCallback(async (boardId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return { error: new Error('A board needs a name') };
    const { error } = await supabase.from('boards').update({ name: trimmed }).eq('id', boardId);
    if (!error) setBoards(prev => prev.map(b => b.id === boardId ? { ...b, name: trimmed } : b));
    return { error };
  }, []);

  // Each board carries its own cover photo (see 025_per_board_background.sql)
  // — patches a single board's row/local state rather than the whole list,
  // mirroring useProfile's per-field setters.
  // `crop` travels with the path because the two are only meaningful
  // together: it describes a region of the source photo that this exact
  // background was cut from, so a write that changed one without the other
  // would leave the editor reopening on a framing that belongs to a
  // different picture. Null on removal, and for callers with no stored
  // source — see 032_board_background_crop.sql.
  const setBoardBackground = useCallback(async (
    boardId: string, path: string | null, crop: BackgroundCrop | null = null
  ) => {
    const { error } = await supabase.from('boards')
      .update({ background_path: path, background_crop: crop })
      .eq('id', boardId);
    if (!error) {
      setBoards(prev => prev.map(b =>
        b.id === boardId ? { ...b, background_path: path, background_crop: crop } : b));
    }
    return { error };
  }, []);

  // dim is a percent (0-MAX_DIM_PCT, see WallBackground) via the board's
  // tint slider — not the fixed enum profiles.home_background_dim still uses.
  const setBoardBackgroundDim = useCallback(async (boardId: string, dim: number) => {
    const { error } = await supabase.from('boards').update({ background_dim: dim }).eq('id', boardId);
    if (!error) setBoards(prev => prev.map(b => b.id === boardId ? { ...b, background_dim: dim } : b));
    return { error };
  }, []);

  return {
    boards, loading, createBoard, deleteBoard, renameBoard,
    setBoardBackground, setBoardBackgroundDim,
    refetch: fetchBoards,
  };
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

// A thumbnail's worth of each board, for the Wall tab's bottom rail: enough
// sticker images to draw a miniature collage, plus the true total count.
export interface BoardPreview {
  paths: string[];
  count: number;
}

// How many cutouts a rail thumbnail scatters. Two, not a full collage — the
// tile is a miniature of the board, so the cover photo has to stay readable
// behind them. See BoardRail's SLOTS.
export const BOARD_PREVIEW_COUNT = 2;

// One query for *every* board's preview stickers, not one per board. The
// rail draws all boards at once, so a per-board `useBoardStickers` would
// mean N round-trips fired on mount — and, worse, N independent copies of
// state that drift from the carousel's own (skills.md #1). This is a
// read-only projection instead: the carousel page still owns the editable
// truth for the board it's showing, and calls `refetch` here after any
// add/remove so the rail follows along.
export function useBoardPreviews(userId: string | undefined) {
  const [previews, setPreviews] = useState<Map<string, BoardPreview>>(new Map());

  const fetchPreviews = useCallback(async () => {
    if (!userId) { setPreviews(new Map()); return; }
    const { data, error } = await supabase
      .from('board_stickers')
      .select('board_id, added_at, sticker:stickers(image_path)')
      .eq('user_id', userId)
      .order('added_at', { ascending: false });
    if (error || !data) return;

    const next = new Map<string, BoardPreview>();
    for (const row of data as unknown as Array<{ board_id: string; sticker: { image_path: string } | null }>) {
      const entry = next.get(row.board_id) ?? { paths: [], count: 0 };
      entry.count += 1;
      if (entry.paths.length < BOARD_PREVIEW_COUNT && row.sticker?.image_path) {
        entry.paths.push(row.sticker.image_path);
      }
      next.set(row.board_id, entry);
    }
    setPreviews(next);
  }, [userId]);

  useEffect(() => { fetchPreviews(); }, [fetchPreviews]);

  return { previews, refetch: fetchPreviews };
}
