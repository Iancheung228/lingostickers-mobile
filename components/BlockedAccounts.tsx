import { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, FlatList, ActivityIndicator, Alert,
} from 'react-native';
import { X } from 'lucide-react-native';
import Avatar from '@/components/Avatar';
import { useFriends } from '@/hooks/useFriends';
import type { BlockedUser } from '@/lib/types';
import { colors, radii, spacing, shadows, fonts, typography } from '@/constants/theme';

// ---------------------------------------------------------------------------
// The list of people you have blocked, and the only way to undo it.
//
// A block you cannot review or lift is a trap rather than a control, so this
// screen is not optional decoration around the block button — it is the other
// half of it, and it is where a reviewer checking Guideline 1.2 will look.
// ---------------------------------------------------------------------------

interface BlockedAccountsProps {
  visible: boolean;
  onClose: () => void;
}

export default function BlockedAccounts({ visible, onClose }: BlockedAccountsProps) {
  const { blocked, unblockUser } = useFriends();
  const [working, setWorking] = useState<string | null>(null);

  const handleUnblock = (item: BlockedUser) => {
    const name = item.blocked.username ?? 'this person';
    Alert.alert(
      `Unblock ${name}?`,
      `${name} will be able to find you and send you a friend request again. You won't be friends again unless one of you asks.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            setWorking(item.id);
            const { error } = await unblockUser(item.id);
            setWorking(null);
            if (error) Alert.alert("Couldn't unblock", error.message);
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Blocked accounts</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close blocked accounts"
          >
            <X size={22} color={colors.inkDark} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={blocked}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Nobody is blocked</Text>
              <Text style={styles.emptyBody}>
                If someone sends you something they shouldn&rsquo;t, you can block them
                from their profile or straight from the challenge.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const name = item.blocked.username ?? 'Unknown';
            return (
              <View style={styles.row}>
                <Avatar name={item.blocked.username} avatarPath={item.blocked.avatar_path} size={38} />
                <Text style={styles.name} numberOfLines={1}>{name}</Text>
                <TouchableOpacity
                  style={styles.unblock}
                  onPress={() => handleUnblock(item)}
                  disabled={working === item.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Unblock ${name}`}
                  accessibilityState={{ disabled: working === item.id, busy: working === item.id }}
                >
                  {working === item.id
                    ? <ActivityIndicator size="small" color={colors.inkDark} />
                    : <Text style={styles.unblockText}>Unblock</Text>}
                </TouchableOpacity>
              </View>
            );
          }}
        />
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: { fontSize: 20, fontFamily: fonts.display, color: colors.inkDark },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.ms,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.card,
  },
  name: { flex: 1, fontSize: 15, fontFamily: fonts.display, color: colors.inkDark },
  unblock: {
    backgroundColor: colors.cardAlt,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    minWidth: 78,
    alignItems: 'center',
  },
  unblockText: { fontSize: 12, fontFamily: fonts.display, color: colors.inkDark },
  empty: { alignItems: 'center', paddingTop: 72, paddingHorizontal: spacing.xl, gap: spacing.sm },
  emptyTitle: { ...typography.h3, textAlign: 'center' },
  emptyBody: { ...typography.body, textAlign: 'center', color: colors.inkLight },
});
