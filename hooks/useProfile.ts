import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Profile, Language } from '@/lib/types';

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

  return { profile, loading, setTargetLanguage };
}
