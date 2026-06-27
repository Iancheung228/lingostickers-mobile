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

  if (!url.includes('code=')) return { type: null as DeepLinkAuthType, error: null };

  const { error } = await supabase.auth.exchangeCodeForSession(url);
  return { type, error };
}
