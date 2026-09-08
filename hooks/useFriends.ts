import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode, createElement } from 'react';
import { supabase } from '@/lib/supabase';
import { getFunctionErrorMessage } from '@/lib/functionError';
import { BlockedUser, FriendWithProfile, PersonSummary } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';

const SEARCH_DEBOUNCE_MS = 280;

function useFriendsState() {
  const { user } = useAuth();
  const userId = user?.id;
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<PersonSummary[]>([]);
  const [searching, setSearching] = useState(false);
  // Long enough that a typed-out username is one request, short enough that
  // pausing mid-word still feels immediate.
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Which search is allowed to write the results — see searchUsers.
  const searchSeq = useRef(0);
  // Blocks live here, next to the friend graph, because blocking is the one
  // action that changes both at once — the trigger in migration 034 severs the
  // friendship, so a block that didn't also refresh this list would leave the
  // rail showing someone who is no longer a friend.
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);

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
      .select('id, username, avatar_path')
      .in('id', friendIds);

    const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));

    const enriched: FriendWithProfile[] = data.map(f => {
      const friendId = f.requester_id === userId ? f.addressee_id : f.requester_id;
      return {
        ...f,
        friend: profileMap.get(friendId) ?? { id: friendId, username: null, avatar_path: null },
        is_requester: f.requester_id === userId,
      };
    });

    setFriends(enriched);
    setLoading(false);
  }, [userId]);

  const fetchBlocked = useCallback(async () => {
    if (!userId) { setBlocked([]); return; }

    const { data, error } = await supabase
      .from('user_blocks')
      .select('id, blocked_id, created_at')
      .eq('blocker_id', userId)
      .order('created_at', { ascending: false });

    // A failed read leaves the previous list alone rather than reporting an
    // empty one — "you have blocked nobody" is a claim, and we couldn't ask.
    if (error || !data) return;
    if (data.length === 0) { setBlocked([]); return; }

    // Blocking does not hide the blocked person's *profile* from the blocker —
    // only their content. That is on purpose: you have to be able to read the
    // name of the person you blocked in order to unblock them.
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, avatar_path')
      .in('id', data.map(b => b.blocked_id));

    const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));
    setBlocked(data.map(b => ({
      ...b,
      blocked: profileMap.get(b.blocked_id) ?? { id: b.blocked_id, username: null, avatar_path: null },
    })));
  }, [userId]);

  useEffect(() => { fetchFriends(); }, [fetchFriends]);
  useEffect(() => { fetchBlocked(); }, [fetchBlocked]);
  // A search still pending when the screen closes has nothing left to update.
  useEffect(() => () => { if (searchTimer.current) clearTimeout(searchTimer.current); }, []);

  /**
   * Username search, called on every keystroke.
   *
   * Two things it has to do that the straight-through version didn't:
   *
   * - **Wait.** It used to fire one RPC per character, so typing a seven
   *   letter name was seven round trips, six of which nobody would ever read.
   * - **Ignore the losers.** Those requests can also come back *out of
   *   order*: the reply for "mi" arriving after the reply for "michael"
   *   overwrote the right answer with a stale one, which reads as the search
   *   ignoring what you finished typing. Each call takes a ticket, and a
   *   reply that isn't holding the current one is dropped on the floor.
   */
  const searchUsers = useCallback((query: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = query.trim();
    if (!userId || q.length < 2) {
      searchSeq.current += 1;
      setSearchResults([]);
      setSearching(false);
      return;
    }
    // Set immediately, not inside the timer: the spinner should appear the
    // moment there is something to wait for, not a beat later.
    setSearching(true);
    const seq = (searchSeq.current += 1);

    searchTimer.current = setTimeout(async () => {
      const existingIds = new Set(friends.map(f => f.friend.id));
      existingIds.add(userId);

      // Goes through the search_profiles RPC rather than querying `profiles`
      // directly. A client-side query can only exclude the blocks *you* made —
      // it cannot see a block made against you, so someone who blocked you would
      // still appear here with a working Add button that then failed at the
      // trigger. The RPC applies the same both-directions predicate the RLS
      // policies use. See migration 034 §6.
      const { data } = await supabase.rpc('search_profiles', { q });
      if (seq !== searchSeq.current) return;

      setSearchResults((data ?? []).filter((p: PersonSummary) => !existingIds.has(p.id)));
      setSearching(false);
    }, SEARCH_DEBOUNCE_MS);
  }, [userId, friends]);

  const sendFriendRequest = useCallback(async (addresseeId: string) => {
    if (!userId) return { error: new Error('Not signed in') };

    const res = await supabase.functions.invoke('send-friend-request', {
      body: { addressee_id: addresseeId },
    });

    if (res.error) {
      // skills.md #3 — the raw error only ever says "non-2xx status code".
      return { error: new Error(await getFunctionErrorMessage(res.error)) };
    }
    fetchFriends();
    return { error: null };
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

  /**
   * Block someone. This is the strong version of removeFriend: the row here is
   * what stops them coming back.
   *
   * Only the insert is done from the client. Severing the friendship and
   * withdrawing challenges still in flight happen in a database trigger, so
   * they are atomic with the block — see migration 034 §3. Both lists are
   * refetched afterwards because both changed.
   */
  const blockUser = useCallback(async (blockedId: string) => {
    if (!userId) return { error: new Error('Not signed in') };

    const { error } = await supabase
      .from('user_blocks')
      .insert({ blocker_id: userId, blocked_id: blockedId });

    // Blocking twice is not an error worth surfacing — the end state the user
    // asked for is the end state they have.
    if (error && !error.message.includes('duplicate key')) return { error };

    await Promise.all([fetchFriends(), fetchBlocked()]);
    return { error: null };
  }, [userId, fetchFriends, fetchBlocked]);

  /**
   * Lift a block. Deliberately does NOT restore the friendship the block
   * severed — unblocking means "you may contact me again", not "we are friends
   * again", and silently re-friending someone you had blocked would be a
   * surprise in the wrong direction.
   */
  const unblockUser = useCallback(async (blockId: string) => {
    const { error } = await supabase
      .from('user_blocks')
      .delete()
      .eq('id', blockId);

    if (!error) await fetchBlocked();
    return { error };
  }, [fetchBlocked]);

  return {
    friends,
    loading,
    searchResults,
    searching,
    searchUsers,
    sendFriendRequest,
    respondToRequest,
    removeFriend,
    blocked,
    blockUser,
    unblockUser,
    refetchBlocked: fetchBlocked,
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
