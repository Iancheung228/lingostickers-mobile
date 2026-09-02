import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, SectionList, StyleSheet, SafeAreaView,
  TouchableOpacity, RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { UserPlus } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useFriends } from '@/hooks/useFriends';
import { useChallenges } from '@/hooks/useChallenges';
import FriendSearch from '@/components/FriendSearch';
import ChallengeScreen from '@/components/ChallengeScreen';
import ChallengeSuccess from '@/components/ChallengeSuccess';
import FriendProfile from '@/components/FriendProfile';
import FriendRail from '@/components/FriendRail';
import FriendsEmpty from '@/components/FriendsEmpty';
import SolvedRow from '@/components/SolvedRow';
import ReportSheet from '@/components/ReportSheet';
import { FriendRequestRow, ChallengeRow } from '@/components/InboxRow';
import { ChallengeWithSender, FriendWithProfile, PersonSummary } from '@/lib/types';
import {
  buildInboxItems, buildSections, subtitleFor, isFirstRun, type Row,
} from '@/lib/friendsSections';
import { colors, shadows, radii, spacing, fonts } from '@/constants/theme';
import { TAB_BAR_CLEARANCE } from '@/constants/tabBar';
import { enablePushNotifications } from '@/lib/notifications';

// ---------------------------------------------------------------------------
// Friends.
//
// The page is organised around one question — is anything waiting on me? —
// rather than around the three queries that happen to feed it. Everything
// actionable is merged into a single group at the top; the friends directory
// compresses to a rail so it can't push that group off screen; and what used
// to be called a feed sits underneath as the reading material it actually is.
//
// Both sections always render, with resting copy when empty. A page whose
// shape depends on your data can't be learned, and a section that vanishes
// takes the evidence that its feature exists with it.
// ---------------------------------------------------------------------------

export default function FriendsScreen() {
  const { user } = useAuth();
  const {
    friends, loading: friendsLoading, respondToRequest,
    blockUser, refetch: refetchFriends,
  } = useFriends();
  const {
    inbox, feed, loading: challengesLoading,
    fetchInbox, fetchFeed, getChallengeImageUrls,
  } = useChallenges();

  const [searchVisible, setSearchVisible] = useState(false);
  const [activeChallenge, setActiveChallenge] = useState<ChallengeWithSender | null>(null);
  const [wonState, setWonState] = useState<{ challenge: ChallengeWithSender; stickerId: string } | null>(null);
  const [selectedFriend, setSelectedFriend] = useState<FriendWithProfile | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [solvedImages, setSolvedImages] = useState<Record<string, string>>({});
  // The person a pending request's "⋯" was opened against, held so the report
  // sheet knows who it is about. Null when the sheet is closed.
  const [reportTarget, setReportTarget] = useState<PersonSummary | null>(null);

  const acceptedFriends = useMemo(() => friends.filter(f => f.status === 'accepted'), [friends]);
  const pendingReceived = useMemo(
    () => friends.filter(f => f.status === 'pending' && !f.is_requester),
    [friends],
  );

  // `silent` separates the two reasons this runs. A pull-to-refresh drives the
  // spinner because the user asked for it; arriving on the tab should not, or
  // every switch back flashes a refresh indicator nobody requested.
  const refresh = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const friendIds = acceptedFriends.map(f => f.friend.id);
      await Promise.all([refetchFriends(), fetchInbox(), fetchFeed(friendIds)]);
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, [refetchFriends, fetchInbox, fetchFeed, acceptedFriends]);

  // Held in a ref because `refresh` is rebuilt whenever the friend list
  // changes, and useFocusEffect must run the current one. This previously
  // passed `[]` directly, which captured the very first render's empty friend
  // list forever — so on every later focus the feed was fetched for a stale
  // set of ids, and quietly came back empty.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useFocusEffect(useCallback(() => { refreshRef.current(true); }, []));

  // Thumbnails for the solved rows, in one call rather than one per row.
  // Keyed off the ids actually present, so it re-runs when the list changes
  // and not when it merely re-renders.
  const feedIds = useMemo(() => feed.map(c => c.id).join(','), [feed]);
  useEffect(() => {
    const ids = feedIds ? feedIds.split(',') : [];
    if (ids.length === 0) { setSolvedImages({}); return; }
    let cancelled = false;
    getChallengeImageUrls(ids).then(urls => { if (!cancelled) setSolvedImages(urls); });
    return () => { cancelled = true; };
  }, [feedIds, getChallengeImageUrls]);

  const inboxItems = useMemo(
    () => buildInboxItems(pendingReceived, inbox),
    [pendingReceived, inbox],
  );
  const sections = useMemo(() => buildSections(inboxItems, feed), [inboxItems, feed]);

  const loading = friendsLoading || challengesLoading;
  const hasNobody = isFirstRun(acceptedFriends.length, pendingReceived.length);
  const subtitle = subtitleFor(acceptedFriends.length);

  // Friends the user owes something to, so the rail can echo the inbox.
  const awaitingIds = useMemo(
    () => new Set(inbox.map(c => c.sender.id)),
    [inbox],
  );

  // Accepting a request is the point where challenges from this person become
  // possible, so it is a moment where a notification prompt explains itself.
  // No-ops if they already answered the system dialog either way.
  const handleAccept = useCallback(async (friendshipId: string) => {
    await respondToRequest(friendshipId, 'accepted');
    if (user?.id) enablePushNotifications(user.id);
  }, [respondToRequest, user?.id]);

  // An unanswered request is the only way a stranger reaches you, so the
  // safety controls have to be reachable before you decide. Blocking here
  // also disposes of the request itself — the trigger in migration 034 deletes
  // the friendship row, so there is nothing left to answer.
  const handleFlagRequest = useCallback((person: PersonSummary) => {
    const name = person.username ?? 'this person';
    Alert.alert(
      name,
      'This person sent you a friend request.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Report', onPress: () => setReportTarget(person) },
        {
          text: 'Block', style: 'destructive',
          onPress: async () => {
            const { error } = await blockUser(person.id);
            if (error) Alert.alert("Couldn't block", error.message);
          },
        },
      ],
    );
  }, [blockUser]);

  const renderRow = useCallback((row: Row) => {
    switch (row.kind) {
      case 'request':
        return (
          <FriendRequestRow
            username={row.friendship.friend.username}
            avatarPath={row.friendship.friend.avatar_path}
            onAccept={() => handleAccept(row.friendship.id)}
            onDecline={() => respondToRequest(row.friendship.id, 'declined')}
            onFlag={() => handleFlagRequest(row.friendship.friend)}
          />
        );
      case 'challenge':
        return (
          <ChallengeRow
            senderName={row.challenge.sender.username}
            senderAvatarPath={row.challenge.sender.avatar_path}
            sentAt={row.challenge.sent_at}
            inProgress={row.challenge.status === 'active'}
            onPress={() => setActiveChallenge(row.challenge)}
          />
        );
      case 'solved':
        return (
          <SolvedRow
            word={row.challenge.snapshot_word}
            language={row.challenge.snapshot_language}
            translation={row.challenge.snapshot_translation}
            solverName={row.challenge.receiver?.username ?? null}
            solverAvatarPath={row.challenge.receiver?.avatar_path ?? null}
            completedAt={row.challenge.completed_at ?? null}
            imageUrl={solvedImages[row.challenge.id]}
          />
        );
      case 'resting':
        return <Text style={styles.resting}>{row.text}</Text>;
    }
  }, [handleAccept, respondToRequest, handleFlagRequest, solvedImages]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Friends</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <TouchableOpacity
          onPress={() => setSearchVisible(true)}
          style={styles.addBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Add a friend"
        >
          <UserPlus size={20} color={colors.inkDark} />
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator style={styles.loader} color={colors.terra} size="large" />
      ) : hasNobody ? (
        <FriendsEmpty onAdd={() => setSearchVisible(true)} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.key}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => refresh()} tintColor={colors.terra} />
          }
          ListHeaderComponent={
            acceptedFriends.length > 0 ? (
              <FriendRail
                friends={acceptedFriends}
                awaitingIds={awaitingIds}
                onSelect={setSelectedFriend}
                onAdd={() => setSearchVisible(true)}
              />
            ) : null
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>{section.title.toUpperCase()}</Text>
              {section.count > 0 && (
                <View style={styles.countPill}>
                  <Text style={styles.countText}>{section.count}</Text>
                </View>
              )}
            </View>
          )}
          renderItem={({ item }) => renderRow(item)}
          contentContainerStyle={styles.listContent}
        />
      )}

      <FriendSearch visible={searchVisible} onClose={() => setSearchVisible(false)} />

      <ChallengeScreen
        challenge={activeChallenge}
        onClose={() => setActiveChallenge(null)}
        onWin={(stickerId) => {
          if (activeChallenge) setWonState({ challenge: activeChallenge, stickerId });
          setActiveChallenge(null);
          fetchInbox();
        }}
      />

      <ChallengeSuccess
        challenge={wonState?.challenge ?? null}
        wonStickerId={wonState?.stickerId ?? ''}
        onClose={() => setWonState(null)}
      />

      <FriendProfile
        friend={selectedFriend}
        currentUserId={user?.id}
        onClose={() => setSelectedFriend(null)}
        onRemoved={refetchFriends}
      />

      <ReportSheet
        visible={!!reportTarget}
        reporterId={user?.id}
        reportedUserId={reportTarget?.id}
        reportedName={reportTarget?.username ?? null}
        onBlock={async () => {
          if (!reportTarget) return;
          const { error } = await blockUser(reportTarget.id);
          if (error) Alert.alert("Couldn't block", error.message);
        }}
        onClose={() => setReportTarget(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sky, paddingBottom: TAB_BAR_CLEARANCE },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  headerText: { flex: 1, gap: 1 },
  title: { fontSize: 24, fontFamily: fonts.display, color: colors.inkDark, letterSpacing: -0.5 },
  subtitle: { fontSize: 12, fontFamily: fonts.display, color: colors.inkLight},
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  loader: { marginTop: 60 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  sectionLabel: { fontSize: 11, fontFamily: fonts.monoBold, color: colors.inkFaint, letterSpacing: 1.5 },
  countPill: {
    minWidth: 18,
    height: 18,
    borderRadius: radii.full,
    backgroundColor: colors.sageDark,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  countText: { fontSize: 10, fontFamily: fonts.display, color: colors.white },
  resting: { fontSize: 13, fontFamily: fonts.text, color: colors.inkFaint, paddingHorizontal: spacing.md, paddingBottom: spacing.sm, lineHeight: 18, },
  listContent: { paddingBottom: spacing.xxl },
});
