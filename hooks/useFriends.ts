import { createContext, useContext, useState, useCallback, useEffect, ReactNode, createElement } from 'react';
import { supabase } from '@/lib/supabase';
import { FriendWithProfile } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';

function useFriendsState() {
  const { user } = useAuth();
  const userId = user?.id;
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<{ id: string; username: string | null }[]>([]);
  const [searching, setSearching] = useState(false);

  const fetchFriends = useCallback(async () => {
    if (!userId) { setFriends([]); setLoading(false); return; }

    const { data, error } = await supabase
      .from('friendships')
      .select('*')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error || !data) { setLoading(false); return; }

    const friendIds = data.map(f =>
      f.requester_id === userId ? f.addressee_id : f.requester_id
    );

    if (friendIds.length === 0) { setFriends([]); setLoading(false); return; }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', friendIds);

    const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));

    const enriched: FriendWithProfile[] = data.map(f => {
      const friendId = f.requester_id === userId ? f.addressee_id : f.requester_id;
      return {
        ...f,
        friend: profileMap.get(friendId) ?? { id: friendId, username: null },
        is_requester: f.requester_id === userId,
      };
    });

    setFriends(enriched);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchFriends(); }, [fetchFriends]);

  const searchUsers = useCallback(async (query: string) => {
    if (!userId || query.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);

    const existingIds = new Set(friends.map(f => f.friend.id));
    existingIds.add(userId);

    const { data } = await supabase
      .from('profiles')
      .select('id, username')
      .ilike('username', `${query.trim()}%`)
      .neq('id', userId)
      .limit(10);

    setSearchResults((data ?? []).filter(p => !existingIds.has(p.id)));
    setSearching(false);
  }, [userId, friends]);

  const sendFriendRequest = useCallback(async (addresseeId: string) => {
    if (!userId) return { error: new Error('Not signed in') };

    const res = await supabase.functions.invoke('send-friend-request', {
      body: { addressee_id: addresseeId },
    });

    if (!res.error) fetchFriends();
    return { error: res.error as Error | null };
  }, [userId, fetchFriends]);

  const respondToRequest = useCallback(async (friendshipId: string, status: 'accepted' | 'declined') => {
    const res = await supabase.functions.invoke('respond-friend-request', {
      body: { friendship_id: friendshipId, status },
    });

    if (!res.error) fetchFriends();
    return { error: res.error as Error | null };
  }, [fetchFriends]);

  const removeFriend = useCallback(async (friendshipId: string) => {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);

    if (!error) fetchFriends();
    return { error };
  }, [fetchFriends]);

  return {
    friends,
    loading,
    searchResults,
    searching,
    searchUsers,
    sendFriendRequest,
    respondToRequest,
    removeFriend,
    refetch: fetchFriends,
  };
}

const FriendsContext = createContext<ReturnType<typeof useFriendsState> | null>(null);

export function FriendsProvider({ children }: { children: ReactNode }) {
  const value = useFriendsState();
  return createElement(FriendsContext.Provider, { value }, children);
}

export function useFriends() {
  const ctx = useContext(FriendsContext);
  if (!ctx) throw new Error('useFriends must be used within a FriendsProvider');
  return ctx;
}
