import { Pressable, StyleSheet, Text } from 'react-native';
import { fonts, radii, spacing } from '@/constants/theme';
import { haptic } from '@/lib/haptics';
import { useThemedStyles, type Theme } from '@/hooks/useTheme';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
}

// C-look 4 "Chips": 36 tall, 16 side padding, 1px ctl border, white; selected is
// terra fill with white text. 4pt vertical slop (hitSlop is vertical only, so a
// row of chips with gap >= 8 never overlaps, lesson 9). Fires the `select` haptic.
export default function Chip({ label, selected, onPress, testID }: ChipProps) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      testID={testID}
      onPress={() => { haptic.select(); onPress?.(); }}
      hitSlop={{ top: 4, bottom: 4 }}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.on : pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.text, selected && styles.textOn]} maxFontSizeMultiplier={1.15} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = ({ colors }: Theme) => StyleSheet.create({
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.ctl,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  on: { backgroundColor: colors.terra, borderColor: colors.terra },
  pressed: { backgroundColor: colors.sand },
  text: { fontFamily: fonts.text, fontSize: 15, lineHeight: 20, color: colors.inkMid },
  textOn: { fontFamily: fonts.display, color: colors.white },
});
