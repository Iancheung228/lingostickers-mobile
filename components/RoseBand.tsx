import type { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, spacing, type } from '@/constants/theme';

// The rose band (C-look 3): title in the type scale, at most one subtitle line
// and one right-hand control, all in maroon (the contrast fix: inkDark washes
// out on the band). It runs up behind the status bar, so it does its own
// top inset. `bottomPad` lets a screen reserve room for a card that overlaps it.
export const BAND_RADIUS = radii.lg; // 24

interface RoseBandProps {
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
  /** Content to the left of the title (Profile's avatar). */
  leading?: ReactNode;
  bottomPad?: number;
  children?: ReactNode;
}

export default function RoseBand({ title, subtitle, right, leading, bottomPad = spacing.md, children }: RoseBandProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.band, { paddingTop: insets.top + spacing.sm, paddingBottom: bottomPad }]}>
      <View style={styles.row}>
        {leading}
        <View style={styles.titleWrap}>
          <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>{title}</Text>
          {typeof subtitle === 'string'
            ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
            : subtitle}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    backgroundColor: colors.blush,
    borderBottomLeftRadius: BAND_RADIUS,
    borderBottomRightRadius: BAND_RADIUS,
    paddingHorizontal: 20,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
  titleWrap: { flex: 1 },
  title: { ...type.title, color: colors.maroon },
  subtitle: { ...type.small, color: colors.maroon },
});
