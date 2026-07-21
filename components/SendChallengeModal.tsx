import { useState } from 'react';
import { Modal, View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Image } from 'react-native';
import { X, Check } from 'lucide-react-native';
import { Sticker, FriendWithProfile } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { colors, radii, spacing, fonts } from '@/constants/theme';

interface SendChallengeModalProps {
  sticker: Sticker | null;
  friends: FriendWithProfile[];
  onSend: (receiverId: string) => Promise<void>;
  onClose: () => void;
}

export default function SendChallengeModal({ sticker, friends, onSend, onClose }: SendChallengeModalProps) {
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const acceptedFriends = friends.filter(f => f.status === 'accepted');

  // Fetch signed URL for sticker preview
  if (sticker?.image_path && !imageUrl) {
    supabase.storage.from('sticker-images')
      .createSignedUrl(sticker.image_path, 3600)
      .then(({ data }) => { if (data) setImageUrl(data.signedUrl); });
  }

  const handleSend = async (friendId: string) => {
    setSending(friendId);
    await onSend(friendId);
    setSent(prev => new Set([...prev, friendId]));
    setSending(null);
  };

  return (
    <Modal visible={!!sticker} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Challenge a Friend</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <X size={22} color={colors.inkDark} />
          </TouchableOpacity>
        </View>

        {/* Sticker preview */}
        {sticker && (
          <View style={styles.preview}>
            {imageUrl
              ? <Image source={{ uri: imageUrl }} style={styles.stickerImage} resizeMode="contain" />
              : <View style={styles.stickerPlaceholder} />}
            <Text style={styles.word}>{sticker.word}</Text>
            <Text style={styles.translation}>{sticker.translation}</Text>
          </View>
        )}

        <Text style={styles.sectionLabel}>SEND TO</Text>

        {acceptedFriends.length === 0 ? (
          <Text style={styles.empty}>Add friends first to send challenges</Text>
        ) : (
          <FlatList
            data={acceptedFriends}
            keyExtractor={f => f.id}
            renderItem={({ item }) => {
              const isSending = sending === item.friend.id;
              const isSent = sent.has(item.friend.id);
              return (
                <View style={styles.friendRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(item.friend.username ?? '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.username}>{item.friend.username ?? 'Friend'}</Text>
                  <TouchableOpacity
                    style={[styles.sendButton, isSent && styles.sendButtonSent]}
                    onPress={() => !isSent && !isSending && handleSend(item.friend.id)}
                    disabled={isSent || !!sending}
                  >
                    {isSending
                      ? <ActivityIndicator size="small" color={colors.white} />
                      : isSent
                        ? <Check size={14} color={colors.white} />
                        : <Text style={styles.sendText}>Send</Text>}
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sky },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.inkDark },
  preview: { alignItems: 'center', paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  stickerImage: { width: 120, height: 120, marginBottom: 10 },
  stickerPlaceholder: { width: 120, height: 120, backgroundColor: colors.borderLight, borderRadius: 16, marginBottom: 10 },
  word: { fontSize: 22, fontWeight: '800', color: colors.inkDark, marginBottom: 4 },
  translation: { fontSize: 14, color: colors.inkMid },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 1.5,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  empty: { color: colors.inkFaint, textAlign: 'center', marginTop: 40, fontSize: 14, paddingHorizontal: 32 },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.terra,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 16, fontWeight: '800', color: colors.white },
  username: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.inkDark },
  sendButton: {
    backgroundColor: colors.terra,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  sendButtonSent: { backgroundColor: colors.inkFaint },
  sendText: { color: colors.white, fontWeight: '700', fontSize: 14 },
});
