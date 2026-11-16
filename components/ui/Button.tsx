import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { fonts, radii, spacing, MIN_TAP, PRESS_SCALE } from '@/constants/theme';
import { dur, useMotion } from '@/lib/motion';
import { useTheme, useThemedStyles, type Theme } from '@/hooks/useTheme';
import type { Palette } from '@/constants/palettes';

export type ButtonKind = 'primary' | 'secondary' | 'tertiary' | 'destructive';

interface ButtonProps {
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

// C-look 4 "Buttons": height 52, radius full, Newsreader 17; tertiary is 44 tall.
// Press = scale .98 over 80 ms plus the colour step; disabled never lowers text
// opacity. A loading button keeps its width and ignores taps (double-tap guard).
const schemeFor = (colors: Palette): Record<ButtonKind, { bg: string; pressed: string; fg: string; dbg: string; dfg: string }> => ({
  primary:     { bg: colors.terra,    pressed: colors.terraDark,        fg: colors.white,    dbg: colors.terraLight, dfg: colors.inkLight },
  secondary:   { bg: colors.terraLight, pressed: colors.terraTintPressed, fg: colors.inkDark, dbg: colors.terraLight, dfg: colors.inkLight },
  tertiary:    { bg: colors.transparent, pressed: colors.terraLight,    fg: colors.inkDark,  dbg: colors.transparent, dfg: colors.inkLight },
  destructive: { bg: colors.errorLight, pressed: colors.errorPressed,   fg: colors.errorInk,    dbg: colors.errorLight, dfg: colors.inkLight },
});

export default function Button({
  label, onPress, kind = 'primary', disabled, loading, icon, style, testID, accessibilityLabel, accessibilityHint,
}: ButtonProps) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { reduced } = useMotion();
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const s = schemeFor(colors)[kind];
  const off = disabled || loading;

  return (
    <Animated.View style={[anim, style]}>
      <Pressable
        testID={testID}
        onPress={off ? undefined : onPress}
        onPressIn={() => { if (!reduced && !off) scale.value = withTiming(PRESS_SCALE, { duration: 80 }); }}
        onPressOut={() => { scale.value = withTiming(1, { duration: dur.fast }); }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: !!off, busy: !!loading }}
        style={({ pressed }) => [
          styles.base,
          kind === 'tertiary' && styles.tertiary,
          { backgroundColor: disabled ? s.dbg : pressed && !loading ? s.pressed : s.bg },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={s.fg} />
        ) : (
          <View style={styles.row}>
            {icon}
            <Text
              style={[styles.label, { color: disabled ? s.dfg : s.fg }]}
              maxFontSizeMultiplier={1.5}
              numberOfLines={1}
            >
              {label}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const makeStyles = (_t: Theme) => StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radii.full,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tertiary: { minHeight: MIN_TAP, paddingHorizontal: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { fontFamily: fonts.display, fontSize: 17, lineHeight: 22 },
});
