import { useEffect } from 'react';
import { AppState } from 'react-native';
import { isOnline, markOnline, probeOnce, subscribeConnectivity } from '@/lib/connectivity';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const STEPS = [5000, 10000, 20000, 30000]; // 5 s backing off to 30 s

/**
 * While offline, pings the backend's health endpoint until it answers, and once
 * whenever the app returns to the foreground. Mount once, in the root layout.
 */
export function useConnectivityProbe() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let step = 0;
    let stopped = false;

    const clear = () => { if (timer) { clearTimeout(timer); timer = null; } };
    const check = async () => {
      clear();
      if (stopped || isOnline()) return;
      if (await probeOnce(URL, KEY)) { markOnline(); return; }
      if (stopped || isOnline()) return;
      timer = setTimeout(check, STEPS[Math.min(step++, STEPS.length - 1)]);
    };

    const unsub = subscribeConnectivity(() => {
      if (isOnline()) { clear(); step = 0; } else if (!timer) { timer = setTimeout(check, STEPS[0]); }
    });
    const app = AppState.addEventListener('change', (s) => { if (s === 'active' && !isOnline()) check(); });
    return () => { stopped = true; clear(); unsub(); app.remove(); };
  }, []);
}
