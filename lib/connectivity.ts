import { useSyncExternalStore } from 'react';

// Online/offline from what the app itself observes (B-app 9, JS-only: no NetInfo,
// no expo-network, both native). Any HTTP response from our backend means we are
// online; a network rejection, or a request that never answers, means we are not.
// The module is a singleton external store, so every screen reads the same value
// (skills.md #1); <ConnectivityProvider> in the root layout runs the probe.

type Listener = () => void;

let online = true;
const listeners = new Set<Listener>();

export function isOnline(): boolean {
  return online;
}

function set(next: boolean) {
  if (online === next) return;
  online = next;
  listeners.forEach((l) => l());
}

export const markOnline = () => set(true);
export const markOffline = () => set(false);

export function subscribeConnectivity(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** True unless a recent request failed at the network. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribeConnectivity, isOnline, isOnline);
}

const REQUEST_TIMEOUT_MS = 15000;
const PROBE_TIMEOUT_MS = 3000;

function urlOf(input: RequestInfo | URL): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
}

/**
 * `fetch` for the Supabase client. Tracks reachability and puts a 15 s limit on
 * data and auth calls (edge functions and storage transfers are legitimately
 * slow, so they get none).
 */
export const trackedFetch: typeof fetch = async (input, init) => {
  const url = urlOf(input);
  const limited = /\/(rest|auth)\/v1\//.test(url);
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let nextInit = init;
  if (limited) {
    const ctl = new AbortController();
    const outer = init?.signal;
    if (outer) {
      if (outer.aborted) ctl.abort();
      else outer.addEventListener('abort', () => ctl.abort());
    }
    timer = setTimeout(() => { timedOut = true; ctl.abort(); }, REQUEST_TIMEOUT_MS);
    nextInit = { ...init, signal: ctl.signal };
  }
  try {
    const res = await fetch(input, nextInit);
    markOnline();
    return res;
  } catch (err) {
    const aborted = (err as { name?: string })?.name === 'AbortError';
    // A caller cancelling its own request says nothing about the network.
    if (!aborted || timedOut) markOffline();
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

/** One health check: resolves true when the backend answers at all. */
export async function probeOnce(baseUrl: string, anonKey: string): Promise<boolean> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), PROBE_TIMEOUT_MS);
  try {
    await fetch(`${baseUrl}/auth/v1/health`, { headers: { apikey: anonKey }, signal: ctl.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
