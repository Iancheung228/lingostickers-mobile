import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChallengeWithSender } from '@/lib/types';
import { colors, fonts } from '@/constants/theme';

interface ChallengeCardProps {
  challenge: ChallengeWithSender;
  onPress: () => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ChallengeCard({ challenge, onPress }: ChallengeCardProps) {
  const senderName = challenge.sender.username ?? 'Friend';

  const badge = challenge.status === 'pending'
    ? { label: 'New', color: colors.terra }
    : { label: 'In Progress', color: colors.sageDark };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarText}>{senderName.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          <Text style={styles.bold}>{senderName}</Text>
          {' challenged you!'}
        </Text>
        <Text style={styles.word} numberOfLines={1}>
          {challenge.snapshot_translation}
        </Text>
        <Text style={styles.time}>{timeAgo(challenge.sent_at)}</Text>
      </View>
      <View style={[styles.badge, { backgroundColor: badge.color + '22', borderColor: badge.color }]}>
        <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.terra,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: colors.white },
  content: { flex: 1 },
  title: { fontSize: 14, color: colors.inkMid, marginBottom: 2 },
  bold: { fontWeight: '700', color: colors.inkDark },
  word: { fontSize: 15, fontFamily: fonts.jp, color: colors.inkDark, marginBottom: 2 },
  time: { fontSize: 11, color: colors.inkFaint },
  badge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
});
