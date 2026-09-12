import { createContext, useContext, useState, useCallback, useEffect, ReactNode, createElement } from 'react';
import { supabase } from '@/lib/supabase';
import { ChallengeWithSender, ChallengeWithReceiver, SubmitAnswerResult } from '@/lib/types';
import { getFunctionErrorMessage } from '@/lib/functionError';
import { useAuth } from '@/hooks/useAuth';

// The edge function's literal duplicate-challenge message, remapped to
// something a user can actually act on.
const ALREADY_EXISTS_MESSAGE = 'A pending challenge with this sticker already exists';
const FRIENDLY_ALREADY_EXISTS = "You've already sent this challenge — wait for your friend to finish it before sending it again.";

function useChallengesState() {
  const { user } = useAuth();
  const userId = user?.id;
  const [inbox, setInbox] = useState<ChallengeWithSender[]>([]);
  const [feed, setFeed] = useState<ChallengeWithReceiver[]>([]);
  const [loading, setLoading] = useState(true);
  // Distinguishes "nothing is waiting on you" from "we couldn't ask".
  const [loadError, setLoadError] = useState(false);

  const fetchInbox = useCallback(async () => {
    if (!userId) { setInbox([]); return; }

    const { data, error } = await supabase
      .from('sticker_challenges')
      .select('*')
      .eq('receiver_id', userId)
      .in('status', ['pending', 'active'])
      .order('sent_at', { ascending: false });

    // A failed fetch used to `return` here, silently leaving the previous
    // inbox and its tab badge in place — so the badge could keep claiming a
    // challenge was waiting long after it had been answered elsewhere, and a
    // first-ever failure showed an empty inbox as though there were none.
    // collection.tsx and profile.tsx already make this distinction; this is
    // the same idea, and the badge is why it matters more here.
    if (error) { setLoadError(true); return; }
    setLoadError(false);
    if (!data) return;

    const senderIds = [...new Set(data.map(c => c.sender_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, avatar_path')
      .in('id', senderIds);

    const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));

    setInbox(data.map(c => ({
      ...c,
      sender: profileMap.get(c.sender_id) ?? { id: c.sender_id, username: null, avatar_path: null },
    })));
  }, [userId]);

  const fetchFeed = useCallback(async (friendIds: string[]) => {
    if (!userId || friendIds.length === 0) { setFeed([]); return; }

    const { data, error } = await supabase
      .from('sticker_challenges')
      .select('*')
      .in('receiver_id', friendIds)
      .eq('status', 'won')
      .order('completed_at', { ascending: false })
      // Trimmed from 30. This list is a "your challenge landed" notice, not an
      // archive — a dozen recent ones is all anyone reads, and each row now
      // carries a thumbnail that has to be signed.
      .limit(12);

    if (error) { setLoadError(true); return; }
    setLoadError(false);
    if (!data) return;

    const receiverIds = [...new Set(data.map(c => c.receiver_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, avatar_path')
      .in('id', receiverIds);

    const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));

    setFeed(data.map(c => ({
      ...c,
      receiver: profileMap.get(c.receiver_id) ?? { id: c.receiver_id, username: null, avatar_path: null },
    })));
  }, [userId]);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    fetchInbox().then(() => setLoading(false));
  }, [fetchInbox]);

  const sendChallenge = useCallback(async (stickerId: string, receiverId: string) => {
    const res = await supabase.functions.invoke('send-challenge', {
      body: { sticker_id: stickerId, receiver_id: receiverId },
    });
    if (res.error) {
      const message = await getFunctionErrorMessage(res.error);
      const friendly = message === ALREADY_EXISTS_MESSAGE ? FRIENDLY_ALREADY_EXISTS : message;
      return { error: new Error(friendly), challenge_id: null };
    }
    fetchInbox();
    return { error: null, challenge_id: res.data?.challenge_id as string };
  }, [fetchInbox]);

  const submitAnswer = useCallback(async (challengeId: string, answer: string): Promise<SubmitAnswerResult> => {
    const res = await supabase.functions.invoke('submit-challenge-answer', {
      body: { challenge_id: challengeId, answer },
    });
    // Unwrapped here rather than at the screen: a raw FunctionsHttpError
    // stringifies to "Edge Function returned a non-2xx status code", which is
    // what the challenge screen ended up showing for every failure — see
    // skills.md #3. The function's own message ("this challenge has already
    // been answered") is the one worth reading.
    if (res.error) throw new Error(await getFunctionErrorMessage(res.error));
    fetchInbox();
    return res.data as SubmitAnswerResult;
  }, [fetchInbox]);

  const requestHint = useCallback(async (challengeId: string): Promise<SubmitAnswerResult> => {
    const res = await supabase.functions.invoke('submit-challenge-answer', {
      body: { challenge_id: challengeId, use_hint: true },
    });
    if (res.error) throw new Error(await getFunctionErrorMessage(res.error));
    return res.data as SubmitAnswerResult;
  }, []);

  // The snapshot image lives in the sender's storage folder, unreadable by
  // the receiver directly — this asks a service-role edge function (which
  // verifies the caller is a party to the challenge) to sign it instead.
  const getChallengeImageUrl = useCallback(async (challengeId: string): Promise<string | null> => {
    const res = await supabase.functions.invoke('get-challenge-image', {
      body: { challenge_id: challengeId },
    });
    if (res.error || !res.data?.url) return null;
    return res.data.url as string;
  }, []);

  // Batched form, for a list of rows that each want a thumbnail. One
  // invocation instead of one per row; the function still authorises each id
  // separately and simply omits any the caller isn't party to.
  const getChallengeImageUrls = useCallback(
    async (challengeIds: string[]): Promise<Record<string, string>> => {
      if (challengeIds.length === 0) return {};
      const res = await supabase.functions.invoke('get-challenge-image', {
        body: { challenge_ids: challengeIds.slice(0, 30) },
      });
      if (res.error || !res.data?.urls) return {};
      return res.data.urls as Record<string, string>;
    },
    [],
  );

  return {
    inbox,
    feed,
    loading,
    loadError,
    // Everything in the inbox, not just untouched ones. `fetchInbox` already
    // filters to pending + active, and an active challenge is one the user
    // opened and didn't finish — still owed, still worth a badge. Counting
    // only 'pending' also made the tab badge disagree with the Friends tab's
    // own "Needs you" count, which reads the whole inbox.
    pendingCount: inbox.length,
    fetchInbox,
    fetchFeed,
    sendChallenge,
    submitAnswer,
    requestHint,
    getChallengeImageUrl,
    getChallengeImageUrls,
  };
}

const ChallengesContext = createContext<ReturnType<typeof useChallengesState> | null>(null);

export function ChallengesProvider({ children }: { children: ReactNode }) {
  const value = useChallengesState();
  return createElement(ChallengesContext.Provider, { value }, children);
}

export function useChallenges() {
  const ctx = useContext(ChallengesContext);
  if (!ctx) throw new Error('useChallenges must be used within a ChallengesProvider');
  return ctx;
}
