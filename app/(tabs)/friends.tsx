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
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Friends</Text>
        <TouchableOpacity onPress={() => setSearchVisible(true)} style={styles.addBtn} hitSlop={8}>
          <UserPlus size={20} color="#1A1A2E" />
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
        <ActivityIndicator style={{ marginTop: 60 }} color="#A7D7C5" size="large" />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          stickySectionHeadersEnabled={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#A7D7C5" />}
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F0E8' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: { fontSize: 28, fontWeight: '800', color: '#1A1A2E' },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  requestsWrap: { paddingHorizontal: 16, marginBottom: 4 },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#A7D7C5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  requestName: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  requestActions: { flexDirection: 'row', gap: 8 },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  acceptBtn: { backgroundColor: '#A7D7C5', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  acceptText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  declineBtn: { backgroundColor: '#FEE2E2', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  declineText: { color: '#EF4444', fontWeight: '700', fontSize: 13 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9E9E9E',
    letterSpacing: 1.5,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  feedItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  feedText: { fontSize: 14, color: '#6B7280', lineHeight: 20 },
  feedBold: { fontWeight: '700', color: '#1A1A2E' },
  feedItalic: { fontStyle: 'italic' },
  listContent: { paddingBottom: 32 },
  empty: { flex: 1, alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A2E', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#9E9E9E', textAlign: 'center', lineHeight: 22 },
});
