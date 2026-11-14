import { FunctionsHttpError } from '@supabase/supabase-js';
import { getFunctionErrorMessage } from '@/lib/functionError';

// Maps any thrown thing to plain copy for a toast or inline error. Never
// returns `error.message` verbatim (lesson 3): an unknown error gets `fallback`.
// Pattern for fallbacks: "Couldn't <verb> <object>. <Recovery>." No "Oops".
//
// Server bodies from our edge functions ({ error: '...' }) are already written
// for users, so a *known short sentence* from one is passed through after the
// raw-looking ones (stack traces, SQL, status text) are filtered out.

/**
 * An error whose message was already written for the user (it went through
 * friendlyError at the boundary that threw it). friendlyError passes it through,
 * so a lower layer can pick the copy once and screens still never read
 * `error.message` themselves.
 */
export class UserFacingError extends Error {
  constructor(message: string) { super(message); this.name = 'UserFacingError'; }
}

const DEFAULT_FALLBACK = "Something went wrong. Please try again.";

const NETWORK = /network request failed|failed to fetch|network error|internet connection|timed out|timeout|econn|offline|load failed/i;
const AUTH = /jwt|not authenticated|invalid refresh|session.*(expired|missing)|unauthorized/i;
const RAW = /non-2xx|exception|stack|undefined|null|syntax|cannot read|\bat \w+\.|sql|postgres|pgrst|violates|\{|\}|<\w+>|status code/i;

export function isNetworkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  return NETWORK.test(msg);
}

function plain(msg: string, fallback: string): string {
  if (NETWORK.test(msg)) return "You're offline or the connection dropped. Check your connection and try again.";
  if (AUTH.test(msg)) return 'Your session has expired. Please sign in again.';
  if (/rate|quota|too many|429|capacity|overloaded|503/i.test(msg)) return 'Tabi is busy right now. Try again in a minute.';
  return fallback;
}

/** Synchronous mapping; use when you already have a message or can't await. */
export function friendlyErrorSync(err: unknown, fallback: string = DEFAULT_FALLBACK): string {
  if (err instanceof UserFacingError) return err.message;
  const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  return plain(msg, fallback);
}

/**
 * Async mapping that also unwraps edge-function bodies. A short, clean server
 * sentence is trusted; everything else falls back to plain copy.
 */
export async function friendlyError(err: unknown, fallback: string = DEFAULT_FALLBACK): Promise<string> {
  if (err instanceof FunctionsHttpError) return friendlyBody(await getFunctionErrorMessage(err), fallback);
  return friendlyErrorSync(err, fallback);
}

/** For a body string an edge function wrote ({ error: '...' }): a short clean sentence passes, anything else maps. */
export function friendlyBody(body: string, fallback: string = DEFAULT_FALLBACK): string {
  if (body && body.length <= 140 && !RAW.test(body) && !NETWORK.test(body) && !AUTH.test(body) && /[.!?]$/.test(body.trim())) {
    return body.trim();
  }
  return plain(body, fallback);
}
