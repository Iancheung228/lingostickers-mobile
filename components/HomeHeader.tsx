import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import RoseBand from '@/components/RoseBand';
import { colors, radii, spacing, fonts } from '@/constants/theme';

interface HomeHeaderProps {
  dueCount: number;
  reviewMinutes: number;
  onStartReview: () => void;
}

// The rose band at the top of Home: the title and, when something is due, the
// "Review N" pill (40pt). Nothing else (owner, 2026-11-13). The wall card
// below overlaps the band's bottom edge, so the bottom padding reserves the
// overlap — see WALL_OVERLAP in collection.tsx.
export default function HomeHeader({ dueCount, reviewMinutes, onStartReview }: HomeHeaderProps) {
  return (
    <RoseBand
      title="Collection"
      bottomPad={56 + spacing.sm}
      right={dueCount > 0 ? (
        <TouchableOpacity
          style={styles.duePill}
          onPress={onStartReview}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Start reviewing — ${dueCount} card${dueCount === 1 ? '' : 's'} due, about ${reviewMinutes} minute${reviewMinutes === 1 ? '' : 's'}`}
        >
          <Text style={styles.dueText} maxFontSizeMultiplier={1.3}>Review {dueCount}</Text>
          <View style={styles.arrow}><ChevronRight size={18} color={colors.white} strokeWidth={2.5} /></View>
        </TouchableOpacity>
      ) : undefined}
    />
  );
}

const styles = StyleSheet.create({
  duePill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    backgroundColor: colors.white,
    borderRadius: radii.full,
    paddingLeft: spacing.md,
    paddingRight: 4,
    gap: spacing.sm,
  },
  dueText: { fontSize: 17, lineHeight: 22, fontFamily: fonts.display, color: colors.inkDark },
  arrow: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    backgroundColor: colors.terra,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
