import { Modal, View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { Check, RotateCcw } from 'lucide-react-native';
import { colors, radii, spacing, shadows, fonts } from '@/constants/theme';

interface ReviewSummaryProps {
  /// Null while no session has finished — the modal is driven entirely by
  /// this, so the parent never has to hold a separate "is it open" flag.
  stats: { graded: number; again: number } | null;
  onDone: () => void;
}

// The wind-down at the end of a study session. Deliberately small: the point
// is to mark that the queue is finished, not to grade the session — a screen
// full of accuracy percentages turns "I did my reviews" into something to
// feel bad about.
export default function ReviewSummary({ stats, onDone }: ReviewSummaryProps) {
  if (!stats) return null;
  const solid = stats.graded - stats.again;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDone}>
      {/* A card floating on a dimmed backdrop is read as "tap outside to
          close" everywhere else on a phone, and there is nothing here to lose
          by leaving — the session is already over and every grade is written.
          The inner Pressable is what stops a tap on the card itself from
          falling through to the scrim. */}
      <Pressable
        style={styles.overlay}
        onPress={onDone}
        accessibilityRole="button"
        accessibilityLabel="Close the session summary"
      >
        <Pressable style={styles.card} onPress={() => {}} accessible={false}>
          <View style={styles.badge}>
            <Check size={26} color={colors.white} strokeWidth={3} />
          </View>

          <Text style={styles.title}>Session done</Text>
          <Text style={styles.subtitle}>
            {stats.graded} card{stats.graded === 1 ? '' : 's'} reviewed
          </Text>

          <View style={styles.stats}>
            <Stat value={solid} label={solid === 1 ? 'recalled' : 'recalled'} />
            <View style={styles.divider} />
            <Stat value={stats.again} label="to revisit" muted icon />
          </View>

          <TouchableOpacity style={styles.doneBtn} onPress={onDone} activeOpacity={0.85}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Stat({ value, label, muted, icon }: { value: number; label: string; muted?: boolean; icon?: boolean }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statValueRow}>
        {icon && <RotateCcw size={14} color={colors.inkLight} />}
        <Text style={[styles.statValue, muted && styles.statValueMuted]}>{value}</Text>
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(43, 42, 40, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    ...shadows.card,
  },
  badge: {
    width: 56, height: 56, borderRadius: radii.full,
    backgroundColor: colors.blushDeep,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { fontSize: 22, fontFamily: fonts.display, color: colors.inkDark },
  subtitle: { fontSize: 14, fontFamily: fonts.text, color: colors.inkLight, marginTop: 2 },

  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statValue: { fontSize: 26, fontFamily: fonts.display, color: colors.inkDark },
  statValueMuted: { color: colors.inkLight },
  statLabel: { fontSize: 11, fontFamily: fonts.mono, color: colors.inkFaint, letterSpacing: 1 },
  divider: { width: 1, height: 34, backgroundColor: colors.borderLight },

  doneBtn: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: spacing.ms + 2,
    borderRadius: radii.full,
    backgroundColor: colors.terra,
  },
  doneText: { fontSize: 16, fontFamily: fonts.display, color: colors.white },
});
