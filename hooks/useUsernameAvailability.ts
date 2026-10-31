import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type UsernameAvailability = 'idle' | 'checking' | 'available' | 'taken';

export function useUsernameAvailability(username: string): UsernameAvailability {
  const [status, setStatus] = useState<UsernameAvailability>('idle');

  useEffect(() => {
    const trimmed = username.trim();
    if (trimmed.length < 3) {
      setStatus('idle');
      return;
    }

    setStatus('checking');
    let current = true;
    const handle = setTimeout(async () => {
      // An RPC, not a profiles query: sign-up runs signed out, and profiles
      // are readable only when signed in (033), so the old query returned
      // nothing and called every name "available". See migration 044.
      const { data, error } = await supabase.rpc('username_available', { q: trimmed });
      if (!current) return;
      // Say nothing rather than a false "available"; the unique constraint
      // still has the last word on submit.
      setStatus(error ? 'idle' : data ? 'available' : 'taken');
    }, 400);

    return () => { current = false; clearTimeout(handle); };
  }, [username]);

  return status;
}
