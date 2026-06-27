import { useState, useCallback } from 'react';
import { Modal, View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { X, UserPlus, Check } from 'lucide-react-native';
import { useFriends } from '@/hooks/useFriends';

interface FriendSearchProps {
  visible: boolean;
  onClose: () => void;
}

export default function FriendSearch({ visible, onClose }: FriendSearchProps) {
  const { searchResults, searching, searchUsers, sendFriendRequest, removeFriend, friends } = useFriends();
  const [query, setQuery] = useState('');
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const handleQuery = useCallback((text: string) => {
    setQuery(text);
    searchUsers(text);
  }, [searchUsers]);

  const handleAdd = useCallback(async (userId: string) => {
    await sendFriendRequest(userId);
    setSentIds(prev => new Set([...prev, userId]));
  }, [sendFriendRequest]);

  const pendingReceived = friends.filter(f => f.status === 'pending' && !f.is_requester);
  const pendingSent = friends.filter(f => f.status === 'pending' && f.is_requester);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Add Friend</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <X size={22} color="#1A1A2E" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchRow}>
          <TextInput
            style={styles.input}
            placeholder="Search by username..."
            placeholderTextColor="#9E9E9E"
            value={query}
            onChangeText={handleQuery}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
          {searching && <ActivityIndicator color="#A7D7C5" style={styles.spinner} />}
        </View>

        {/* Search results */}
        {query.length >= 2 && (
          <FlatList
            data={searchResults}
            keyExtractor={item => item.id}
            style={styles.list}
            ListEmptyComponent={
              !searching ? (
                <Text style={styles.empty}>No users found</Text>
              ) : null
            }
            renderItem={({ item }) => {
              const sent = sentIds.has(item.id);
              return (
                <View style={styles.resultRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(item.username ?? '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.username}>{item.username ?? 'Unknown'}</Text>
                  <TouchableOpacity
                    style={[styles.addButton, sent && styles.addButtonSent]}
                    onPress={() => !sent && handleAdd(item.id)}
                    disabled={sent}
                  >
                    {sent
                      ? <Check size={14} color="#fff" />
                      : <UserPlus size={14} color="#fff" />}
                    <Text style={styles.addText}>{sent ? 'Sent' : 'Add'}</Text>
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        )}

        {/* Pending requests received */}
        {pendingReceived.length > 0 && query.length < 2 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>FRIEND REQUESTS</Text>
            {pendingReceived.map(f => (
              <View key={f.id} style={styles.resultRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(f.friend.username ?? '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.username}>{f.friend.username ?? 'Unknown'}</Text>
                <Text style={styles.pendingBadge}>Incoming</Text>
              </View>
            ))}
          </View>
        )}

        {/* Pending sent */}
        {pendingSent.length > 0 && query.length < 2 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SENT REQUESTS</Text>
            {pendingSent.map(f => (
              <View key={f.id} style={styles.resultRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(f.friend.username ?? '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.username}>{f.friend.username ?? 'Unknown'}</Text>
                <TouchableOpacity style={styles.cancelButton} onPress={() => removeFriend(f.id)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {query.length < 2 && pendingReceived.length === 0 && pendingSent.length === 0 && (
          <Text style={styles.hint}>Type at least 2 characters to search</Text>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F0E8' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#1A1A2E' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1A1A2E',
  },
  spinner: { marginLeft: 10 },
  list: { flex: 1 },
  section: { paddingHorizontal: 16, marginTop: 8 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9E9E9E',
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 8,
  },
  resultRow: {
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
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#A7D7C5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  username: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#A7D7C5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  addButtonSent: { backgroundColor: '#9E9E9E' },
  addText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  pendingBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A7D7C5',
    borderWidth: 1,
    borderColor: '#A7D7C5',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  cancelButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cancelText: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  empty: { color: '#9E9E9E', textAlign: 'center', marginTop: 32, fontSize: 14 },
  hint: { color: '#9E9E9E', textAlign: 'center', marginTop: 48, fontSize: 14, paddingHorizontal: 32 },
});
