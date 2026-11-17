import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';
import { debugWarn } from '@/lib/debug';
import { useAuth } from '@/hooks/useAuth';
import { useSignedUrls } from '@/hooks/useSignedUrls';
import {
  LIBRARY_THUMB_SIDE, PickedPhoto, SavedBackground,
  libraryFilesFor, libraryPathFor, libraryThumbPathFor, newBackgroundId, newestFirst,
} from '@/lib/backgroundLibrary';

// The saved-backgrounds library (migration 048). One provider, mounted in
// app/_layout.tsx, because the board menu's sheet and the New board sheet both
// read it and must agree (skills.md #1). Boards never reference these files:
// choosing one runs the crop flow and writes the board's own copy.

function useSavedBackgroundsState() {
  const { user } = useAuth();
  const userId = user?.id;
  const [rows, setRows] = useState<SavedBackground[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!userId) { setRows([]); setLoading(false); return; }
    const { data, error } = await supabase
      .from('saved_backgrounds')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (!error && data) setRows(data as SavedBackground[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => { setLoading(true); refetch(); }, [refetch]);

  // Grid tiles draw the thumbnail. The path we sign, the URL we load and the
  // cacheKey the tile passes are all this one value (lesson 17).
  const thumbPaths = useMemo(() => rows.map(r => libraryThumbPathFor(r.path)), [rows]);
  const thumbUrls = useSignedUrls(thumbPaths);

  /// Keep a picked photo in the library. `source` is the uncropped image
  /// (already capped for storage). Best effort: returns null on any failure,
  /// and the board background it came with is unaffected. The thumbnail is
  /// required: a row only exists if both files do, so a tile never has to fall
  /// back to the full-size image.
  const save = useCallback(async (source: PickedPhoto): Promise<SavedBackground | null> => {
    if (!userId) return null;
    const id = newBackgroundId();
    const path = libraryPathFor(userId, id);
    const thumbPath = libraryThumbPathFor(path);
    let thumbTemp: File | null = null;
    try {
      const longSide = Math.max(source.width, source.height);
      const ctx = ImageManipulator.manipulate(source.uri);
      // Long side only: the other follows the real aspect (source dims come
      // from shrinkForStorage's rendered result, so they are already true).
      if (longSide > LIBRARY_THUMB_SIDE) {
        ctx.resize(source.width >= source.height ? { width: LIBRARY_THUMB_SIDE } : { height: LIBRARY_THUMB_SIDE });
      }
      const thumb = await (await ctx.renderAsync()).saveAsync({ format: SaveFormat.WEBP, compress: 0.8 });
      thumbTemp = new File(thumb.uri);

      const bucket = supabase.storage.from('sticker-images');
      const { error: e1 } = await bucket.upload(path, await new File(source.uri).bytes(), { contentType: 'image/jpeg' });
      if (e1) throw e1;
      const { error: e2 } = await bucket.upload(thumbPath, await new File(thumb.uri).bytes(), { contentType: 'image/webp' });
      if (e2) { await bucket.remove([path]); throw e2; }

      const { data, error } = await supabase
        .from('saved_backgrounds')
        .insert({ id, user_id: userId, path, width: source.width, height: source.height })
        .select()
        .single();
      if (error || !data) { await bucket.remove(libraryFilesFor(path)); throw error ?? new Error('insert failed'); }
      setRows(prev => newestFirst([data as SavedBackground, ...prev]));
      return data as SavedBackground;
    } catch (err) {
      debugWarn('saved background not kept', err);
      return null;
    } finally {
      try { if (thumbTemp?.exists) thumbTemp.delete(); } catch { /* temp cleanup is best effort */ }
    }
  }, [userId]);

  /// Delete a library entry. Boards hold their own cropped copy
  /// (`board-{id}-background.jpg`), so this normally cannot affect any board.
  /// The ref-check is for safety anyway: if a board ever does point at this
  /// file, the row goes but the file stays.
  const remove = useCallback(async (item: SavedBackground): Promise<{ error: Error | null }> => {
    const { error } = await supabase.from('saved_backgrounds').delete().eq('id', item.id);
    if (error) return { error };
    setRows(prev => prev.filter(r => r.id !== item.id));
    const { data: refs, error: refError } = await supabase
      .from('boards').select('id').eq('background_path', item.path).limit(1);
    if (refError || (refs && refs.length > 0)) return { error: null };
    await supabase.storage.from('sticker-images').remove(libraryFilesFor(item.path));
    return { error: null };
  }, []);

  const thumbUrlFor = useCallback(
    (item: SavedBackground) => thumbUrls.get(libraryThumbPathFor(item.path)) ?? null,
    [thumbUrls],
  );

  return { backgrounds: rows, loading, refetch, save, remove, thumbUrlFor };
}

const SavedBackgroundsContext = createContext<ReturnType<typeof useSavedBackgroundsState> | null>(null);

export function SavedBackgroundsProvider({ children }: { children: ReactNode }) {
  const value = useSavedBackgroundsState();
  return <SavedBackgroundsContext.Provider value={value}>{children}</SavedBackgroundsContext.Provider>;
}

export function useSavedBackgrounds() {
  const ctx = useContext(SavedBackgroundsContext);
  if (!ctx) throw new Error('useSavedBackgrounds must be used within a SavedBackgroundsProvider');
  return ctx;
}
