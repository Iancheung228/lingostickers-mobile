import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Check, X, Play, MoreHorizontal } from 'lucide-react-native';
import Avatar from '@/components/Avatar';
import { timeAgo } from '@/lib/relativeTime';
import { colors, radii, spacing, shadows } from '@/constants/theme';

// ---------------------------------------------------------------------------
// One row for everything that is waiting on the user.
//
// A friend request and a challenge are the same job wearing two costumes:
// someone did something, and it needs an answer. They used to render in
// entirely different places — requests in a fixed block above the list,
// challenges inside it — with different shapes and different weights, so the
// screen had two inboxes that didn't look related.
//
// The amber edge is reserved for this row and nothing else on the page, so
// "needs you" is legible before any of the words are read.
// ---------------------------------------------------------------------------


interface FriendRequestRowProps {
  username: string | null;
  avatarPath: string | null;
  onAccept: () => void;
  onDecline: () => void;
  /// Opens the report/block options. An unanswered request from a stranger is
  /// the one place someone can reach you without your consent, so the safety
  /// controls have to be here and not only on a friend's profile — by the time
  /// FriendProfile is reachable you have already accepted them.
  onFlag: () => void;
}

export function FriendRequestRow({ username, avatarPath, onAccept, onDecline, onFlag }: FriendRequestRowProps) {
  const name = username ?? 'Someone';
  return (
    <View style={styles.row}>
      <Avatar name={username} avatarPath={avatarPath} size={38} />
      <View style={styles.body}>
        <Text style={styles.line} numberOfLines={2}>
          <Text style={styles.strong}>{name}</Text> wants to be friends
        </Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.iconBtn, styles.more]}
          onPress={onFlag}
          accessibilityRole="button"
          accessibilityLabel={`Report or block ${name}`}
          hitSlop={6}
        >
          <MoreHorizontal size={16} color={colors.inkLight} strokeWidth={2.5} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.iconBtn, styles.accept]}
          onPress={onAccept}
          accessibilityRole="button"
          accessibilityLabel={`Accept ${name}`}
          hitSlop={6}
        >
          <Check size={16} color={colors.white} strokeWidth={3} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.iconBtn, styles.decline]}
          onPress={onDecline}
          accessibilityRole="button"
          accessibilityLabel={`Decline ${name}`}
          hitSlop={6}
        >
          <X size={16} color={colors.inkLight} strokeWidth={3} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface ChallengeRowProps {
  senderName: string | null;
  senderAvatarPath: string | null;
  sentAt: string;
  /// 'active' means they've already opened it and are part-way through.
  inProgress: boolean;
  onPress: () => void;
}

export function ChallengeRow({ senderName, senderAvatarPath, sentAt, inProgress, onPress }: ChallengeRowProps) {
  const name = senderName ?? 'A friend';
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Play the challenge from ${name}`}
    >
      <Avatar name={senderName} avatarPath={senderAvatarPath} size={38} />
      <View style={styles.body}>
        {/* The word itself is deliberately not shown — it is the answer. */}
        <Text style={styles.line} numberOfLines={1}>
          <Text style={styles.strong}>{name}</Text> sent you a challenge
        </Text>
        <Text style={styles.meta}>
          {inProgress ? 'In progress · ' : ''}
          {timeAgo(sentAt)}
        </Text>
      </View>
      <View style={styles.playBtn}>
        <Play size={13} color={colors.inkDark} fill={colors.inkDark} />
        <Text style={styles.playText}>{inProgress ? 'Resume' : 'Play'}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.ms,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    // The one amber edge on the page. Nothing else earns it.
    borderColor: colors.sage,
    ...shadows.card,
  },
  body: { flex: 1, gap: 2 },
  line: { fontSize: 14, color: colors.inkMid, lineHeight: 19 },
  strong: { fontWeight: '800', color: colors.inkDark },
  meta: { fontSize: 11, color: colors.inkFaint, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 6 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accept: { backgroundColor: colors.sageDark },
  decline: { backgroundColor: colors.cardAlt },
  // Quieter than the two answers it sits beside: this is the escape hatch, not
  // a third thing being asked of the user.
  more: { backgroundColor: colors.transparent },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.sageLight,
    borderRadius: radii.full,
    paddingHorizontal: spacing.ms,
    paddingVertical: 7,
  },
  playText: { fontSize: 12, fontWeight: '800', color: colors.inkDark },
});
