import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, MIN_TAP } from '@/constants/theme';
import { haptic } from '@/lib/haptics';

export const ICON_BUTTON_SIZE = MIN_TAP; // 44

interface IconButtonProps {
  label: string;
  onPress: () => void;
  children: ReactNode;
  testID?: string;
  selected?: boolean;
  /** A small terra dot (e.g. a filter is on). */
  dot?: boolean;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

// The one round icon button (final review, fix 11): 44pt, white fill, 1px
// `ctl` border (3:1 on cream), no shadow, on every screen. The camera's primary
// side buttons are the only ones allowed to be larger.
export default function IconButton({ label, onPress, children, testID, selected, dot, loading, disabled, style }: IconButtonProps) {
  return (
    <Pressable
      testID={testID}
      onPress={() => { haptic.select(); onPress(); }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, ...(selected === undefined ? {} : { selected }) }}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed, disabled && styles.disabled, style]}
    >
      {loading ? <ActivityIndicator size="small" color={colors.inkDark} /> : children}
      {dot && <View style={styles.dot} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: ICON_BUTTON_SIZE, height: ICON_BUTTON_SIZE, borderRadius: radii.full,
    borderWidth: 1, borderColor: colors.ctl, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
  },
  pressed: { backgroundColor: colors.terraLight },
  disabled: { opacity: 0.4 },
  dot: { position: 'absolute', top: 9, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.terra },
});
