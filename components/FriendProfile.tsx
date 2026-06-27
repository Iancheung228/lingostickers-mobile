import { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Alert, ActivityIndicator } from 'react-native';
import { X, Send, UserX } from 'lucide-react-native';
import { FriendWithProfile, Sticker } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { useFriends } from '@/hooks/useFriends';
import { useChallenges } from '@/hooks/useChallenges';
import StickerPickerModal from '@/components/StickerPickerModal';

interface FriendProfileProps {
  friend: FriendWithProfile | null;
  currentUserId: string | undefined;
  onClose: () => void;
  onRemoved: () => void;
}

export default function FriendProfile({ friend, currentUserId, onClose, onRemoved }: FriendProfileProps) {
  const { removeFriend } = useFriends();
  const { sendChallenge } = useChallenges();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [exchangeCount, setExchangeCount] = useState<number | null>(null);

  useEffect(() => {
    if (!friend || !currentUserId) { setExchangeCount(null); return; }
    const a = currentUserId, b = friend.friend.id;
    supabase
      .from('sticker_challenges')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'won')
      .or(`and(sender_id.eq.${a},receiver_id.eq.${b}),and(sender_id.eq.${b},receiver_id.eq.${a})`)
      .then(({ count }) => setExchangeCount(count ?? 0));
  }, [friend?.id, currentUserId]);

  const handleSelectSticker = async (sticker: Sticker) => {
    if (!friend || sending) return;
    setSending(true);
    setPickerOpen(false);
    const { error } = await sendChallenge(sticker.id, friend.friend.id);
    setSending(false);
    if (error) {
      Alert.alert('Challenge failed', error.message);
    } else {
      Alert.alert('Challenge sent!', `${friend.friend.username ?? 'Your friend'} will be notified.`);
    }
  };

  const handleRemove = () => {
    if (!friend) return;
    Alert.alert(
      'Remove Friend',
      `Remove ${friend.friend.username ?? 'this friend'} from your friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            await removeFriend(friend.id);
            onRemoved();
            onClose();
          },
        },
      ]
    );
  };

  if (!friend) return null;

  const friendsSince = new Date(friend.updated_at).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <Modal visible={!!friend} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Friend</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <X size={22} color="#1A1A2E" />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(friend.friend.username ?? '?').charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.username}>{friend.friend.username ?? 'Unknown'}</Text>
          <Text style={styles.since}>Friends since {friendsSince}</Text>

          <View style={styles.statBox}>
            {exchangeCount === null ? (
              <ActivityIndicator color="#A7D7C5" />
            ) : (
              <>
                <Text style={styles.statCount}>{exchangeCount}</Text>
                <Text style={styles.statLabel}>
                  {exchangeCount === 1 ? 'sticker exchanged' : 'stickers exchanged'}
                </Text>
              </>
            )}
          </View>

          <TouchableOpacity
            style={[styles.actionButton, styles.challengeButton]}
            onPress={() => setPickerOpen(true)}
            disabled={sending}
          >
            {sending
              ? <ActivityIndicator color="#fff" />
              : (
                <>
                  <Send size={16} color="#fff" />
                  <Text style={styles.challengeButtonText}>Send a Challenge</Text>
                </>
              )}
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, styles.removeButton]} onPress={handleRemove}>
            <UserX size={16} color="#EF4444" />
            <Text style={styles.removeButtonText}>Remove Friend</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <StickerPickerModal
        visible={pickerOpen}
        currentUserId={currentUserId}
        onSelect={handleSelectSticker}
        onClose={() => setPickerOpen(false)}
      />
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
  title: { fontSize: 20, fontWeight: '800', color: '#1A1A2E' },
  body: { flex: 1, alignItems: 'center', paddingTop: 12, paddingHorizontal: 32 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#A7D7C5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: { fontSize: 36, fontWeight: '800', color: '#fff' },
  username: { fontSize: 22, fontWeight: '800', color: '#1A1A2E', marginBottom: 4 },
  since: { fontSize: 13, color: '#9E9E9E', marginBottom: 24 },
  statBox: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 32,
    minWidth: 160,
  },
  statCount: { fontSize: 28, fontWeight: '800', color: '#1A1A2E' },
  statLabel: { fontSize: 12, color: '#9E9E9E', marginTop: 2 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    borderRadius: 14,
    paddingVertical: 15,
    marginBottom: 12,
  },
  challengeButton: { backgroundColor: '#A7D7C5' },
  challengeButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  removeButton: { backgroundColor: '#FEE2E2' },
  removeButtonText: { color: '#EF4444', fontSize: 15, fontWeight: '700' },
});
