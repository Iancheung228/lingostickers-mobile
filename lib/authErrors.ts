// Supabase auth returns developer-facing strings ("Invalid login credentials").
// Known ones are remapped here so screens never show error.message directly
// (same idea as lib/functionError.ts); anything unknown gets a generic line.
export function getAuthErrorMessage(error: { message?: string } | null | undefined): string {
  const message = (error?.message ?? '').toLowerCase();
  if (message.includes('invalid login credentials')) {
    return "That email and password don't match. Check them, or reset your password.";
  }
  if (message.includes('rate limit') || message.includes('too many')) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  if (message.includes('network') || message.includes('fetch')) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  return 'Something went wrong signing in. Please try again.';
}

// Shape check only: something@something.tld
export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
