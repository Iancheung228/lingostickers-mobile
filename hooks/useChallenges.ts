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

  const fetchInbox = useCallback(async () => {
    if (!userId) { setInbox([]); return; }

    const { data } = await supabase
      .from('sticker_challenges')
      .select('*')
      .eq('receiver_id', userId)
      .in('status', ['pending', 'active'])
      .order('sent_at', { ascending: false });

    if (!data) return;

    const senderIds = [...new Set(data.map(c => c.sender_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', senderIds);

    const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));

    setInbox(data.map(c => ({
      ...c,
      sender: profileMap.get(c.sender_id) ?? { id: c.sender_id, username: null },
    })));
  }, [userId]);

  const fetchFeed = useCallback(async (friendIds: string[]) => {
    if (!userId || friendIds.length === 0) { setFeed([]); return; }

    const { data } = await supabase
      .from('sticker_challenges')
      .select('*')
      .in('receiver_id', friendIds)
      .eq('status', 'won')
      .order('completed_at', { ascending: false })
      .limit(30);

    if (!data) return;

    const receiverIds = [...new Set(data.map(c => c.receiver_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', receiverIds);

    const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));

    setFeed(data.map(c => ({
      ...c,
      receiver: profileMap.get(c.receiver_id) ?? { id: c.receiver_id, username: null },
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
    if (res.error) throw res.error;
    fetchInbox();
    return res.data as SubmitAnswerResult;
  }, [fetchInbox]);

  const useHint = useCallback(async (challengeId: string): Promise<SubmitAnswerResult> => {
    const res = await supabase.functions.invoke('submit-challenge-answer', {
      body: { challenge_id: challengeId, use_hint: true },
    });
    if (res.error) throw res.error;
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

  return {
    inbox,
    feed,
    loading,
    pendingCount: inbox.filter(c => c.status === 'pending').length,
    fetchInbox,
    fetchFeed,
    sendChallenge,
    submitAnswer,
    useHint,
    getChallengeImageUrl,
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
