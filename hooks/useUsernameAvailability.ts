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
    const handle = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', trimmed)
        .maybeSingle();
      setStatus(data ? 'taken' : 'available');
    }, 400);

    return () => clearTimeout(handle);
  }, [username]);

  return status;
}
