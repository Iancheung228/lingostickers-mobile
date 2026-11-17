import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import { supabase } from '@/lib/supabase';
import { withThumbPath } from '@/lib/thumbnails';
import type { Sticker } from '@/lib/types';
import { useToast } from '@/components/ToastProvider';
import { haptic } from '@/lib/haptics';

// Deleting a card shows an undo toast instead of a confirm (B-core 5, SPEC
// "Undo"). The server delete is DEFERRED until the toast expires, the app
// backgrounds, or the provider unmounts, whichever is first, and then it is
// flushed, never dropped, or Undo would lie.
//
// While a card is waiting, and after it has been deleted, its id is in
// `pendingDeleteIds`. Every list that fetches stickers filters through it, so a
// focus refetch cannot resurrect a card that is mid-delete (skills.md #1: one
// provider, mounted in app/_layout.tsx, not a bare hook per screen).

const UNDO_WINDOW_MS = 6500;

interface PendingDeleteApi {
  pendingDeleteIds: ReadonlySet<string>;
  /// Hide `sticker` now and delete it for real after the undo window.
  deleteWithUndo: (sticker: Sticker, opts?: { onUndo?: () => void }) => void;
  /// The same for a board (stickers on it stay in the collection). `commit`
  /// performs the real delete once the undo window closes; return an error to
  /// bring the board back.
  deleteBoardWithUndo: (
    board: { id: string; name: string },
    commit: () => Promise<{ error: unknown }>,
    opts?: { onUndo?: () => void },
  ) => void;
}

const Ctx = createContext<PendingDeleteApi | null>(null);

export function usePendingDeletes(): PendingDeleteApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePendingDeletes must be used inside <PendingDeleteProvider>');
  return v;
}

/** Storage objects a card owns: cutout, thumbnails, memory photo, voice note. */
function filesOf(sticker: Sticker): string[] {
  const paths: string[] = [];
  if (sticker.image_path) paths.push(...withThumbPath(sticker.image_path));
  if (sticker.thumb_path && !paths.includes(sticker.thumb_path)) paths.push(sticker.thumb_path);
  if (sticker.memory_photo_path) paths.push(sticker.memory_photo_path);
  if (sticker.voice_note_path) paths.push(sticker.voice_note_path);
  return paths;
}

// Lets sign-out / delete-account (which live above this provider) commit what
// is still inside the undo window while the session still exists.
let flushHandler: (() => Promise<void>) | null = null;
export async function flushPendingDeletes(): Promise<void> {
  try { await flushHandler?.(); } catch { /* never block sign-out */ }
}

export function PendingDeleteProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set());
  // Waiting for the window to close.
  const waiting = useRef(new Map<string, { sticker: Sticker; timer: ReturnType<typeof setTimeout> }>());
  const waitingBoards = useRef(new Map<string, {
    board: { id: string; name: string }; run: () => Promise<{ error: unknown }>; timer: ReturnType<typeof setTimeout>;
  }>());

  const commitBoard = useCallback(async (id: string) => {
    const entry = waitingBoards.current.get(id);
    if (!entry) return;
    clearTimeout(entry.timer);
    waitingBoards.current.delete(id);
    const { error } = await entry.run();
    if (error) {
      setIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      haptic.error();
      toast.show({ kind: 'error', message: `Couldn't delete the board “${entry.board.name}”. It's back.` });
    }
  }, [toast]);

  const commit = useCallback(async (sticker: Sticker) => {
    const entry = waiting.current.get(sticker.id);
    if (entry) { clearTimeout(entry.timer); waiting.current.delete(sticker.id); }
    // Row first: if it fails the card stays, and must keep its images.
    const { error } = await supabase.from('stickers').delete().eq('id', sticker.id);
    if (!error) {
      const paths = filesOf(sticker);
      if (paths.length) await supabase.storage.from('sticker-images').remove(paths).catch(() => {});
    }
    if (error) {
      // Not deleted after all: let it back into the lists and say so.
      setIds(prev => { const n = new Set(prev); n.delete(sticker.id); return n; });
      haptic.error();
      toast.show({ kind: 'error', message: `Couldn't delete “${sticker.word}”. It's back in your collection.` });
    }
  }, [toast]);

  const flushAll = useCallback((): Promise<void> => {
    const runs: Promise<void>[] = [];
    for (const { sticker } of [...waiting.current.values()]) runs.push(commit(sticker));
    for (const id of [...waitingBoards.current.keys()]) runs.push(commitBoard(id));
    return Promise.all(runs).then(() => undefined);
  }, [commit, commitBoard]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => { if (state !== 'active') void flushAll(); });
    flushHandler = flushAll;
    return () => {
      sub.remove();
      if (flushHandler === flushAll) flushHandler = null;
      void flushAll();
    };
  }, [flushAll]);

  const deleteWithUndo = useCallback<PendingDeleteApi['deleteWithUndo']>((sticker, opts) => {
    if (waiting.current.has(sticker.id)) return;
    setIds(prev => new Set(prev).add(sticker.id));
    const timer = setTimeout(() => { void commit(sticker); }, UNDO_WINDOW_MS);
    waiting.current.set(sticker.id, { sticker, timer });
    haptic.success();
    toast.show({
      kind: 'undo',
      message: 'Card deleted',
      action: {
        label: 'Undo',
        onPress: () => {
          const entry = waiting.current.get(sticker.id);
          if (!entry) return; // already flushed; nothing left to undo
          clearTimeout(entry.timer);
          waiting.current.delete(sticker.id);
          setIds(prev => { const n = new Set(prev); n.delete(sticker.id); return n; });
          opts?.onUndo?.();
        },
      },
    });
  }, [commit, toast]);

  const deleteBoardWithUndo = useCallback<PendingDeleteApi['deleteBoardWithUndo']>((board, run, opts) => {
    if (waitingBoards.current.has(board.id)) return;
    setIds(prev => new Set(prev).add(board.id));
    const timer = setTimeout(() => { void commitBoard(board.id); }, UNDO_WINDOW_MS);
    waitingBoards.current.set(board.id, { board, run, timer });
    haptic.success();
    toast.show({
      kind: 'undo',
      message: 'Board deleted',
      action: {
        label: 'Undo',
        onPress: () => {
          const entry = waitingBoards.current.get(board.id);
          if (!entry) return;
          clearTimeout(entry.timer);
          waitingBoards.current.delete(board.id);
          setIds(prev => { const n = new Set(prev); n.delete(board.id); return n; });
          opts?.onUndo?.();
        },
      },
    });
  }, [commitBoard, toast]);

  const api = useMemo(
    () => ({ pendingDeleteIds: ids, deleteWithUndo, deleteBoardWithUndo }),
    [ids, deleteWithUndo, deleteBoardWithUndo],
  );
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
