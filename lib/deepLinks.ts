import * as Linking from 'expo-linking';
import { supabase } from './supabase';

export type DeepLinkAuthType = 'recovery' | 'signup' | 'invite' | 'email_change' | null;

export function parseAuthType(url: string): DeepLinkAuthType {
  const { queryParams } = Linking.parse(url);
  return (queryParams?.type as DeepLinkAuthType) ?? null;
}

export async function handleAuthDeepLink(url: string) {
  const type = parseAuthType(url);
  const { queryParams } = Linking.parse(url);

  if (queryParams?.error) {
    const message = (queryParams.error_description as string) ?? (queryParams.error as string);
    return { type, error: new Error(message) };
  }

  // Email templates link straight to our own domain with a token_hash,
  // rather than Supabase's default /auth/v1/verify + redirect_to hop —
  // Universal Links only intercept a tap whose immediate href is on the
  // associated domain, so a cross-domain redirect through supabase.co would
  // open Safari instead of the app, even with everything else configured.
  const tokenHash = queryParams?.token_hash as string | undefined;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    return { type, error };
  }

  if (!url.includes('code=')) return { type: null as DeepLinkAuthType, error: null };

  const { error } = await supabase.auth.exchangeCodeForSession(url);
  return { type, error };
}
