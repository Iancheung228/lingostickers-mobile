import { useState, useCallback } from 'react';
import {
  View, Text, SectionList, StyleSheet, SafeAreaView,
  TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { UserPlus } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useFriends } from '@/hooks/useFriends';
import { useChallenges } from '@/hooks/useChallenges';
import ChallengeCard from '@/components/ChallengeCard';
import FriendSearch from '@/components/FriendSearch';
import ChallengeScreen from '@/components/ChallengeScreen';
import ChallengeSuccess from '@/components/ChallengeSuccess';
import FriendProfile from '@/components/FriendProfile';
import { ChallengeWithSender, ChallengeWithReceiver, FriendWithProfile } from '@/lib/types';
import CozyBackground from '@/components/CozyBackground';
import OtterMascot from '@/components/illustrations/OtterMascot';
import { colors, shadows, radii, spacing, typography } from '@/constants/theme';

export default function FriendsScreen() {
  const { user } = useAuth();
  const { friends, loading: friendsLoading, respondToRequest, refetch: refetchFriends } = useFriends();
  const { inbox, feed, loading: challengesLoading, fetchInbox, fetchFeed } = useChallenges();

  const [searchVisible, setSearchVisible] = useState(false);
  const [activeChallenge, setActiveChallenge] = useState<ChallengeWithSender | null>(null);
  const [wonState, setWonState] = useState<{ challenge: ChallengeWithSender; stickerId: string } | null>(null);
  const [selectedFriend, setSelectedFriend] = useState<FriendWithProfile | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const acceptedFriends = friends.filter(f => f.status === 'accepted');
  const pendingReceived = friends.filter(f => f.status === 'pending' && !f.is_requester);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const friendIds = acceptedFriends.map(f => f.friend.id);
    await Promise.all([refetchFriends(), fetchInbox(), fetchFeed(friendIds)]);
    setRefreshing(false);
  }, [refetchFriends, fetchInbox, fetchFeed, acceptedFriends]);

  useFocusEffect(useCallback(() => { refresh(); }, []));

  const sections = [
    { title: 'Friends', data: acceptedFriends as unknown as (ChallengeWithSender | ChallengeWithReceiver)[] },
    { title: 'Challenges', data: inbox as (ChallengeWithSender | ChallengeWithReceiver)[] },
    { title: "Friends' Discoveries", data: feed as (ChallengeWithSender | ChallengeWithReceiver)[] },
  ];

  return (
    <CozyBackground variant="strip">
      <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Friends</Text>
        <TouchableOpacity onPress={() => setSearchVisible(true)} style={styles.addBtn} hitSlop={8}>
          <UserPlus size={20} color={colors.inkMid} />
        </TouchableOpacity>
      </View>

      {/* Pending friend requests */}
      {pendingReceived.length > 0 && (
        <View style={styles.requestsWrap}>
          <Text style={styles.sectionLabel}>FRIEND REQUESTS</Text>
          {pendingReceived.map(f => (
            <View key={f.id} style={styles.requestRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(f.friend.username ?? '?').charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={styles.requestName}>{f.friend.username ?? 'Unknown'}</Text>
              <View style={styles.requestActions}>
                <TouchableOpacity style={styles.acceptBtn} onPress={() => respondToRequest(f.id, 'accepted')}>
                  <Text style={styles.acceptText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.declineBtn} onPress={() => respondToRequest(f.id, 'declined')}>
                  <Text style={styles.declineText}>Decline</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {challengesLoading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.terra} size="large" />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          stickySectionHeadersEnabled={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.terra} />}
          renderSectionHeader={({ section: { title, data } }) =>
            data.length > 0 ? (
              <Text style={styles.sectionLabel}>{title.toUpperCase()}</Text>
            ) : null
          }
          renderItem={({ item, section }) => {
            if (section.title === 'Friends') {
              const f = item as unknown as FriendWithProfile;
              return (
                <TouchableOpacity style={styles.friendRow} onPress={() => setSelectedFriend(f)} activeOpacity={0.7}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{(f.friend.username ?? '?').charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.requestName}>{f.friend.username ?? 'Unknown'}</Text>
                </TouchableOpacity>
              );
            }
            if (section.title === 'Challenges') {
              const c = item as ChallengeWithSender;
              return <ChallengeCard challenge={c} onPress={() => setActiveChallenge(c)} />;
            }
            const c = item as ChallengeWithReceiver;
            return (
              <View style={styles.feedItem}>
                <Text style={styles.feedText}>
                  <Text style={styles.feedBold}>{c.receiver?.username ?? 'Friend'}</Text>
                  {' learned '}
                  <Text style={styles.feedBold}>{c.snapshot_word}</Text>
                  {' · '}
                  <Text style={styles.feedItalic}>{c.snapshot_translation}</Text>
                </Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <OtterMascot size={80} variant="small" />
              <Text style={styles.emptyTitle}>No activity yet</Text>
              <Text style={styles.emptySubtitle}>
                Add friends and challenge them with your best stickers!
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      <FriendSearch
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
      />

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
    </SafeAreaView>
    </CozyBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.inkDark,
    letterSpacing: -0.5,
    fontStyle: 'italic',
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  requestsWrap: { paddingHorizontal: spacing.md, marginBottom: spacing.xs },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.sm + 4,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    ...shadows.card,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: colors.terra,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  avatarText: { fontSize: 14, fontWeight: '800', color: colors.card },
  requestName: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.inkDark },
  requestActions: { flexDirection: 'row', gap: spacing.sm },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.sm + 4,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    ...shadows.card,
  },
  acceptBtn: {
    backgroundColor: colors.sage,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 6,
  },
  acceptText: { color: colors.card, fontWeight: '700', fontSize: 13 },
  declineBtn: {
    backgroundColor: colors.errorLight,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 6,
  },
  declineText: { color: colors.error, fontWeight: '700', fontSize: 13 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 1.5,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  feedItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    backgroundColor: colors.card,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    ...shadows.card,
  },
  feedText: { fontSize: 14, color: colors.inkMid, lineHeight: 20 },
  feedBold: { fontWeight: '700', color: colors.inkDark },
  feedItalic: { fontStyle: 'italic' },
  listContent: { paddingBottom: spacing.xxl },
  empty: {
    alignItems: 'center',
    paddingTop: spacing.xxl + spacing.lg,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  emptyTitle: { ...typography.h3, textAlign: 'center' },
  emptySubtitle: { ...typography.body, color: colors.inkLight, textAlign: 'center' },
});
