import { createContext, useContext, useState, useEffect, ReactNode, createElement } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Language } from '@/lib/types';
import { getFunctionErrorMessage } from '@/lib/functionError';

function useAuthState() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // PASSWORD_RECOVERY fires (instead of SIGNED_IN) when a session comes from
    // a recovery flow, so the root layout can route to reset-password instead
    // of treating it like a normal login.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const clearPasswordRecovery = () => setIsPasswordRecovery(false);

  // `target_language` rides along in the same metadata as `username` and is
  // read by the handle_new_user trigger (migration 039), so the profile row is
  // right the first time. Doing it as a follow-up UPDATE instead would fail
  // whenever email confirmation is on — there is no session yet at that point
  // — and would leave the choice parked on the device until first launch.
  const signUp = async (
    email: string,
    password: string,
    username: string,
    targetLanguage: Language,
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username, target_language: targetLanguage } },
    });
    return { data, error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // Permanently deletes the account (Apple Guideline 5.1.1(v) requires this
  // to be possible from inside the app, not just via support). The edge
  // function does the actual deletion with the service role key — clients
  // can never delete an auth.users row directly — then this clears the
  // local session so the root layout routes straight to sign-in.
  const deleteAccount = async () => {
    const { error } = await supabase.functions.invoke('delete-account');
    if (error) return { error: new Error(await getFunctionErrorMessage(error)) };
    await supabase.auth.signOut();
    return { error: null };
  };

  const resetPasswordForEmail = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://tabistickers.com/reset-password?type=recovery',
    });
    return { error };
  };

  const verifyRecoveryOtp = async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'recovery' });
    return { error };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error };
  };

  const resendSignupEmail = async (email: string) => {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    return { error };
  };

  return {
    session, user, loading, isPasswordRecovery,
    signUp, signIn, signOut, deleteAccount,
    resetPasswordForEmail, verifyRecoveryOtp, updatePassword, resendSignupEmail,
    clearPasswordRecovery,
  };
}

const AuthContext = createContext<ReturnType<typeof useAuthState> | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const value = useAuthState();
  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
