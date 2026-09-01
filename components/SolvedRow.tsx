import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Avatar from '@/components/Avatar';
import { timeAgo } from '@/lib/relativeTime';
import { colors, radii, spacing, shadows, fonts } from '@/constants/theme';

// ---------------------------------------------------------------------------
// A challenge you sent that a friend solved.
//
// Worth being precise about what this row is, because the screen used to get
// it wrong. It was labelled "Friends' Discoveries" and read "ben learned 傘",
// which says ben found that word. He didn't — row-level security on
// sticker_challenges only returns rows where the reader is the sender or the
// receiver, and the receiver here is the friend, so the only rows that can
// ever appear are ones *you* sent. The feed was never friends' activity; it
// was your own challenges coming back solved.
//
// Which is a better feature than the one it was pretending to be — it closes
// the loop on something you did — and it makes the picture safe to show,
// since the sticker is yours.
// ---------------------------------------------------------------------------
interface SolvedRowProps {
  word: string;
  translation: string;
  solverName: string | null;
  solverAvatarPath: string | null;
  completedAt: string | null;
  /// Signed URL for the snapshot, resolved in a batch by the parent. Undefined
  /// while it is still in flight.
  imageUrl?: string;
}

export default function SolvedRow({
  word, translation, solverName, solverAvatarPath, completedAt, imageUrl,
}: SolvedRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.thumb}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.thumbImage}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={160}
          />
        ) : (
          // A quiet placeholder rather than a spinner: a dozen spinners
          // twitching down a list is noisier than the images arriving.
          <View style={styles.thumbEmpty} />
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.word} numberOfLines={1}>{word}</Text>
        <Text style={styles.translation} numberOfLines={1}>{translation}</Text>
      </View>

      <View style={styles.solver}>
        <Avatar name={solverName} avatarPath={solverAvatarPath} size={22} />
        <Text style={styles.solverText} numberOfLines={1}>
          {solverName ?? 'a friend'} solved it
        </Text>
        {!!completedAt && <Text style={styles.time}>{timeAgo(completedAt)}</Text>}
      </View>
    </View>
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
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.card,
  },
  thumb: {
    width: 46,
    height: 46,
    borderRadius: radii.sm,
    backgroundColor: colors.cardAlt,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: { width: '100%', height: '100%' },
  thumbEmpty: { width: '100%', height: '100%', backgroundColor: colors.cardAlt },
  body: { flex: 1, gap: 1 },
  word: { fontSize: 17, fontFamily: fonts.cozy, color: colors.inkDark },
  translation: { fontSize: 12, color: colors.inkLight, textTransform: 'capitalize' },
  solver: { alignItems: 'center', gap: 3, maxWidth: 92 },
  solverText: { fontSize: 10, color: colors.inkFaint, fontWeight: '600', textAlign: 'center' },
  time: { fontSize: 9, color: colors.inkFaint },
});
