import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, Search, Settings } from 'lucide-react-native';
import { colors, radii, spacing, fonts } from '@/constants/theme';

interface HomeHeaderProps {
  foundToday: number;
  goal: number;
  dueCount: number;
  reviewMinutes: number;
  onStartReview: () => void;
  onSearch: () => void;
  onSettings: () => void;
}

// The rose band at the top of the home screen. It runs edge-to-edge and up
// behind the status bar — so this deliberately does its own `insets.top`
// padding rather than sitting inside a SafeAreaView, which would leave a
// cream strip above it.
//
// Text on the band is `maroon`, not the usual `inkDark`: the heading
// rose-brown is only a couple of steps darker than the band itself and
// washes out completely against it.
export default function HomeHeader({
  foundToday, goal, dueCount, reviewMinutes, onStartReview, onSearch, onSettings,
}: HomeHeaderProps) {
  const insets = useSafeAreaInsets();
  const today = new Date()
    .toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
    .toUpperCase();

  return (
    <View style={[styles.band, { paddingTop: insets.top + spacing.xs }]}>
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{today}</Text>
        <View style={styles.metaRight}>
          <TouchableOpacity
            onPress={onSearch}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Search your collection"
          >
            <Search size={15} color={colors.maroon} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onSettings}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Open your profile and settings"
          >
            <Settings size={15} color={colors.maroon} />
          </TouchableOpacity>
          <Text style={styles.metaText}>GOAL {goal}</Text>
        </View>
      </View>

      <View style={styles.statRow}>
        <View style={styles.countWrap}>
          <Text style={styles.count}>{foundToday}</Text>
          {/* Two stacked lines rather than one — the numeral is tall enough
              that a single baseline beside it leaves the row lopsided. */}
          <View>
            <Text style={styles.countLabel}>FOUND</Text>
            <Text style={styles.countLabel}>TODAY</Text>
          </View>
        </View>

        {dueCount > 0 && (
          <TouchableOpacity style={styles.duePill} onPress={onStartReview} activeOpacity={0.85}>
            <View>
              <Text style={styles.dueCount}>{dueCount} due</Text>
              <Text style={styles.dueTime}>{reviewMinutes} min</Text>
            </View>
            <View style={styles.dueArrow}>
              <ChevronRight size={18} color={colors.white} strokeWidth={2.5} />
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    backgroundColor: colors.blush,
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
    paddingHorizontal: spacing.lg,
    // The wall card below overlaps this band, so the padding here has to
    // clear the overlap as well as the content — see WALL_OVERLAP in
    // collection.tsx, which pulls the card up by all but this margin of it.
    paddingBottom: 56 + spacing.sm,
  },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.ms },
  metaText: {
    fontSize: 10,
    fontFamily: fonts.monoBold,
    color: colors.maroon,
    letterSpacing: 1.6,
  },

  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  countWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.ms },
  count: { fontSize: 40, lineHeight: 44, fontFamily: fonts.display, color: colors.maroon },
  countLabel: {
    fontSize: 10.5,
    lineHeight: 14,
    fontFamily: fonts.monoBold,
    color: colors.maroon,
    letterSpacing: 1.4,
  },

  duePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    backgroundColor: colors.white,
    borderRadius: radii.full,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs + 1,
    shadowColor: colors.maroon,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  dueCount: { fontSize: 15, fontFamily: fonts.display, color: colors.blushDeep },
  dueTime: { fontSize: 10, fontFamily: fonts.mono, color: colors.inkLight, marginTop: 1 },
  dueArrow: {
    width: 34,
    height: 34,
    borderRadius: radii.full,
    backgroundColor: colors.blushDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
