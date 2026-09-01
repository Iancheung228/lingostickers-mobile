import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Profile, Language, WallDisplayStyle, CutoutBorderStyle } from '@/lib/types';
import { uploadAvatar, deleteAvatarFile } from '@/lib/avatars';

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) setProfile(data as Profile);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const setTargetLanguage = useCallback(async (language: Language) => {
    if (!userId) return { error: new Error('Not signed in') };
    const { error } = await supabase
      .from('profiles')
      .update({ target_language: language })
      .eq('id', userId);

    if (!error) setProfile((p) => (p ? { ...p, target_language: language } : p));
    return { error };
  }, [userId]);

  const setWallDisplayStyle = useCallback(async (style: WallDisplayStyle) => {
    if (!userId) return { error: new Error('Not signed in') };
    const { error } = await supabase
      .from('profiles')
      .update({ wall_display_style: style })
      .eq('id', userId);

    if (!error) setProfile((p) => (p ? { ...p, wall_display_style: style } : p));
    return { error };
  }, [userId]);

  const setCutoutBorderStyle = useCallback(async (style: CutoutBorderStyle) => {
    if (!userId) return { error: new Error('Not signed in') };
    const { error } = await supabase
      .from('profiles')
      .update({ cutout_border_style: style })
      .eq('id', userId);

    if (!error) setProfile((p) => (p ? { ...p, cutout_border_style: style } : p));
    return { error };
  }, [userId]);

  const setHomeBackground = useCallback(async (path: string | null) => {
    if (!userId) return { error: new Error('Not signed in') };
    const { error } = await supabase
      .from('profiles')
      .update({ home_background_path: path })
      .eq('id', userId);

    if (!error) setProfile((p) => (p ? { ...p, home_background_path: path } : p));
    return { error };
  }, [userId]);

  // Flipped the first time the user arranges the home mini wall by hand.
  // It lives here rather than being derived from "are there any
  // home_stickers rows" so that a wall the user deliberately emptied stays
  // empty, instead of the auto fan quietly growing back — see
  // 031_home_wall.sql. Idempotent: the editor calls this on its first edit
  // without checking, and a no-op write is cheaper than a read first.
  const setHomeWallArranged = useCallback(async () => {
    if (!userId) return { error: new Error('Not signed in') };
    const { error } = await supabase
      .from('profiles')
      .update({ home_wall_arranged: true })
      .eq('id', userId);

    if (!error) setProfile((p) => (p ? { ...p, home_wall_arranged: true } : p));
    return { error };
  }, [userId]);

  // Uploads a picked photo and points the profile row at it. The old file is
  // removed only after the row has moved, and only if that succeeded — the
  // failure mode of the other order is an avatar_path pointing at a file that
  // no longer exists, which every viewer would see as a broken picture rather
  // than as no picture.
  const setAvatar = useCallback(async (localUri: string) => {
    if (!userId) return { error: new Error('Not signed in') };
    try {
      const previous = profile?.avatar_path ?? null;
      const path = await uploadAvatar(userId, localUri);
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_path: path })
        .eq('id', userId);
      if (error) {
        await deleteAvatarFile(path);
        return { error };
      }
      setProfile((p) => (p ? { ...p, avatar_path: path } : p));
      if (previous && previous !== path) await deleteAvatarFile(previous);
      return { error: null };
    } catch (err: any) {
      return { error: err instanceof Error ? err : new Error('Something went wrong') };
    }
  }, [userId, profile?.avatar_path]);

  const removeAvatar = useCallback(async () => {
    if (!userId) return { error: new Error('Not signed in') };
    const previous = profile?.avatar_path ?? null;
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_path: null })
      .eq('id', userId);
    if (error) return { error };
    setProfile((p) => (p ? { ...p, avatar_path: null } : p));
    await deleteAvatarFile(previous);
    return { error: null };
  }, [userId, profile?.avatar_path]);

  return {
    profile, loading,
    setTargetLanguage, setWallDisplayStyle, setCutoutBorderStyle,
    setHomeBackground, setHomeWallArranged, setAvatar, removeAvatar,
    refetch: fetchProfile,
  };
}
