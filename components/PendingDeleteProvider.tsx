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

export function PendingDeleteProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set());
  // Waiting for the window to close.
  const waiting = useRef(new Map<string, { sticker: Sticker; timer: ReturnType<typeof setTimeout> }>());

  const commit = useCallback(async (sticker: Sticker) => {
    const entry = waiting.current.get(sticker.id);
    if (entry) { clearTimeout(entry.timer); waiting.current.delete(sticker.id); }
    const paths = filesOf(sticker);
    const [{ error }] = await Promise.all([
      supabase.from('stickers').delete().eq('id', sticker.id),
      paths.length ? supabase.storage.from('sticker-images').remove(paths) : Promise.resolve(null),
    ]);
    if (error) {
      // Not deleted after all: let it back into the lists and say so.
      setIds(prev => { const n = new Set(prev); n.delete(sticker.id); return n; });
      haptic.error();
      toast.show({ kind: 'error', message: `Couldn't delete “${sticker.word}”. It's back in your collection.` });
    }
  }, [toast]);

  const flushAll = useCallback(() => {
    for (const { sticker } of [...waiting.current.values()]) void commit(sticker);
  }, [commit]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => { if (state !== 'active') flushAll(); });
    return () => { sub.remove(); flushAll(); };
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

  const api = useMemo(() => ({ pendingDeleteIds: ids, deleteWithUndo }), [ids, deleteWithUndo]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
