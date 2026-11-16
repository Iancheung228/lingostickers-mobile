import type { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radii, spacing } from '@/constants/theme';
import OfflineBanner from '@/components/OfflineBanner';
import { BAND_HEIGHT } from '@/components/HomeHeader';
import { useThemedStyles, type Theme } from '@/hooks/useTheme';

// The rose band (C-look 3): title in the type scale, at most one subtitle line
// and one right-hand control, all in maroon (the contrast fix: inkDark washes
// out on the band). It runs up behind the status bar, so it does its own
// top inset. Collection, Calendar and Boards share one height (BAND_HEIGHT,
// the Home band at rest) and one title baseline; a card below overlaps the band
// by BAND_RADIUS. `fitContent` is for Profile only: a taller band sized by its
// avatar, with `bottomPad` of rose under it.
export const BAND_RADIUS = radii.lg; // 24

interface RoseBandProps {
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
  /** Content to the left of the title (Profile's avatar). */
  leading?: ReactNode;
  /** Size the band to its content (Profile, for the avatar) instead of the shared height. */
  fitContent?: boolean;
  bottomPad?: number;
  children?: ReactNode;
}

export default function RoseBand({ title, subtitle, right, leading, fitContent, bottomPad = spacing.md, children }: RoseBandProps) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.band, { paddingTop: insets.top + spacing.sm }, fitContent ? { paddingBottom: bottomPad } : { height: BAND_HEIGHT }]}>
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
      <OfflineBanner inline />
      {children}
    </View>
  );
}

const makeStyles = ({ colors, type }: Theme) => StyleSheet.create({
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
