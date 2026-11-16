import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { fonts, radii, spacing } from '@/constants/theme';
import { useTheme, useThemedStyles, type Theme } from '@/hooks/useTheme';

interface RowProps {
  title: string;
  value?: string;
  /** 20pt lucide icon (or any node) shown in a 36pt sand disc. */
  icon?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  /** Draws the inset divider below (not for the last row of a group). */
  divider?: boolean;
  /** Replaces the chevron (e.g. a Switch). */
  right?: ReactNode;
  testID?: string;
  accessibilityLabel?: string;
}

// C-look 4 "Profile row": 56 tall, 16 padding, 36pt sand icon disc, title 16, value
// small inkLight on the right, chevron 16. Group rows inside a <RowGroup>.
export default function Row({ title, value, icon, onPress, destructive, divider, right, testID, accessibilityLabel }: RowProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const body = (
    <>
      {icon !== undefined && (
        <View style={[styles.disc, destructive && styles.discDestructive]}>{icon}</View>
      )}
      <Text style={[styles.title, destructive && styles.titleDestructive]} numberOfLines={1} maxFontSizeMultiplier={1.5}>{title}</Text>
      {value ? <Text style={styles.value} numberOfLines={1} maxFontSizeMultiplier={1.5}>{value}</Text> : null}
      {right ?? (onPress ? <ChevronRight size={16} strokeWidth={2} color={colors.inkLight} /> : null)}
    </>
  );
  return (
    <View>
      {onPress ? (
        <Pressable
          testID={testID}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? (value ? `${title}, ${value}` : title)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          {body}
        </Pressable>
      ) : (
        <View style={styles.row} testID={testID}>{body}</View>
      )}
      {divider && <View style={[styles.divider, icon !== undefined && styles.dividerInset]} />}
    </View>
  );
}

/** White radius-16 card that groups rows. */
export function RowGroup({ children }: { children: ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  return <View style={styles.group}>{children}</View>;
}

const makeStyles = ({ colors }: Theme) => StyleSheet.create({
  group: { backgroundColor: colors.card, borderRadius: radii.md, overflow: 'hidden' },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.ms, paddingHorizontal: spacing.md },
  pressed: { backgroundColor: colors.sand },
  disc: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  discDestructive: { backgroundColor: colors.errorLight },
  title: { flex: 1, fontFamily: fonts.text, fontSize: 16, lineHeight: 24, color: colors.inkMid },
  titleDestructive: { color: colors.errorInk },
  value: { fontFamily: fonts.text, fontSize: 14, lineHeight: 20, color: colors.inkLight, maxWidth: '45%' },
  divider: { height: 1, backgroundColor: colors.divider, marginLeft: spacing.md },
  dividerInset: { marginLeft: spacing.md + 36 + spacing.ms },
});
