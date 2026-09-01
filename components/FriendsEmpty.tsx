import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { UserPlus } from 'lucide-react-native';
import { colors, radii, spacing, typography, shadows } from '@/constants/theme';

// ---------------------------------------------------------------------------
// First run: you have no friends yet.
//
// This replaced a `ListEmptyComponent`, which on a SectionList only renders
// when *every* section is empty — so a user with one friend and nothing else
// saw a single bare row and no guidance at all. And it said "No activity yet",
// naming a symptom, when the actual state is "you haven't added anyone" and
// the actual need is a button.
//
// Deliberately not shown once there is even one friend: from then on the
// sections carry their own resting copy, and an empty-state panel over a
// populated screen would be shouting about the wrong thing.
// ---------------------------------------------------------------------------
interface FriendsEmptyProps {
  onAdd: () => void;
}

export default function FriendsEmpty({ onAdd }: FriendsEmptyProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Learn alongside someone</Text>
      <Text style={styles.body}>
        Add a friend to send each other stickers as challenges — guess their word,
        win it for your own collection.
      </Text>
      <TouchableOpacity
        style={styles.cta}
        onPress={onAdd}
        activeOpacity={0.85}
        accessibilityRole="button"
      >
        <UserPlus size={17} color={colors.inkDark} />
        <Text style={styles.ctaText}>Find a friend</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  title: { ...typography.h3, textAlign: 'center' },
  body: {
    ...typography.body,
    color: colors.inkLight,
    textAlign: 'center',
    maxWidth: 300,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.terra,
    borderRadius: radii.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.ms,
    marginTop: spacing.xs,
    ...shadows.card,
  },
  ctaText: { fontSize: 15, fontWeight: '800', color: colors.inkDark },
});
