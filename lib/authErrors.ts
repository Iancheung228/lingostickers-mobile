import { isNetworkError } from '@/lib/friendlyError';

// Supabase auth returns developer-facing strings ("Invalid login credentials").
// They are remapped here so a screen never shows error.message (lesson 3); the
// screen decides where the copy goes by `field`, so a problem sits under the
// control that caused it. Anything unknown gets a generic line for the action.
export type AuthField = 'email' | 'username' | 'password' | 'form';
export interface AuthIssue { field: AuthField; message: string }

const OFFLINE = "Can't reach Tabi. Check your connection and try again.";
const BUSY = 'Too many attempts. Wait a minute and try again.';

type AuthLike = { message?: string; code?: string } | null | undefined;
const text = (e: AuthLike) => (e?.message ?? '').toLowerCase();
const isOffline = (e: AuthLike) => isNetworkError(new Error(e?.message ?? ''));
const isBusy = (e: AuthLike) => /rate limit|too many|over_.*_rate_limit/.test(text(e) + ' ' + (e?.code ?? ''));

export function signInIssue(error: AuthLike): AuthIssue {
  const m = text(error);
  if (m.includes('invalid login credentials')) {
    return { field: 'password', message: "That email and password don't match. Check them, or reset your password." };
  }
  if (isBusy(error)) return { field: 'form', message: BUSY };
  if (isOffline(error)) return { field: 'form', message: OFFLINE };
  return { field: 'form', message: 'Something went wrong signing in. Please try again.' };
}

export function signUpIssue(error: AuthLike): AuthIssue {
  const m = text(error);
  if (m.includes('already registered') || m.includes('already been registered')) {
    return { field: 'email', message: 'An account with that email already exists. Try signing in instead.' };
  }
  if (m.includes('database error saving new user')) {
    return { field: 'username', message: 'That username may have just been taken. Try a different one.' };
  }
  if (m.includes('password')) {
    return { field: 'password', message: 'Choose a password with at least 6 characters.' };
  }
  if (m.includes('email') && m.includes('invalid')) {
    return { field: 'email', message: 'Enter a valid email address.' };
  }
  if (isBusy(error)) return { field: 'form', message: BUSY };
  if (isOffline(error)) return { field: 'form', message: OFFLINE };
  return { field: 'form', message: "Couldn't create your account. Please try again." };
}

/** Resend / recovery / update-password failures that have no field of their own. */
export function authActionMessage(error: AuthLike, fallback: string): string {
  if (isBusy(error)) return BUSY;
  if (isOffline(error)) return OFFLINE;
  return fallback;
}

/** Back-compat for callers that only want a sign-in line. */
export function getAuthErrorMessage(error: AuthLike): string {
  return signInIssue(error).message;
}

// Shape check only: something@something.tld
export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
