import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Profile, Language, WallDisplayStyle, CutoutBorderStyle, WallBackgroundDim } from '@/lib/types';

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

  const setWallBackground = useCallback(async (path: string | null) => {
    if (!userId) return { error: new Error('Not signed in') };
    const { error } = await supabase
      .from('profiles')
      .update({ wall_background_path: path })
      .eq('id', userId);

    if (!error) setProfile((p) => (p ? { ...p, wall_background_path: path } : p));
    return { error };
  }, [userId]);

  const setWallBackgroundDim = useCallback(async (dim: WallBackgroundDim) => {
    if (!userId) return { error: new Error('Not signed in') };
    const { error } = await supabase
      .from('profiles')
      .update({ wall_background_dim: dim })
      .eq('id', userId);

    if (!error) setProfile((p) => (p ? { ...p, wall_background_dim: dim } : p));
    return { error };
  }, [userId]);

  return {
    profile, loading,
    setTargetLanguage, setWallDisplayStyle, setCutoutBorderStyle,
    setWallBackground, setWallBackgroundDim,
    refetch: fetchProfile,
  };
}
