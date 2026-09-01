import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
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
      <View style={styles.overlay}>
        <View style={styles.card}>
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
        </View>
      </View>
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
  title: { fontSize: 22, fontFamily: fonts.cozy, color: colors.inkDark },
  subtitle: { fontSize: 14, color: colors.inkLight, marginTop: 2 },

  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statValue: { fontSize: 26, fontFamily: fonts.cozy, color: colors.inkDark },
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
  doneText: { fontSize: 16, fontFamily: fonts.cozy, color: colors.white },
});
