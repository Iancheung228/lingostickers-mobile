import {
  StyleSheet, TouchableOpacity,
  type StyleProp, type ViewStyle, type TouchableOpacityProps,
} from 'react-native';
import { router } from 'expo-router';
import { Settings } from 'lucide-react-native';
import { colors, radii, shadows } from '@/constants/theme';

interface SettingsButtonProps {
  // `chip` is the default: a card-coloured disc that reads as a button on
  // the cream screens. `bare` is the icon alone, for the rose bands where a
  // white disc would compete with the band's own white elements.
  variant?: 'chip' | 'bare';
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  /// Override where a neighbour sits closer than the default 10pt reaches.
  /// Two touch rectangles that overlap can only be hit reliably by one of
  /// them — see skills.md #9 — and this button is often the last thing in a
  /// tight row of icons.
  hitSlop?: TouchableOpacityProps['hitSlop'];
}

// The one way into Profile/Settings, so it looks and behaves the same
// wherever it's mounted. Every screen puts it last in its top row — the
// rightmost thing on the screen — so it's always in the same place even
// though each screen builds its own header.
export default function SettingsButton({
  variant = 'chip',
  size = variant === 'chip' ? 20 : 18,
  color = colors.inkDark,
  style,
  hitSlop = 10,
}: SettingsButtonProps) {
  return (
    <TouchableOpacity
      onPress={() => router.push('/profile')}
      style={[variant === 'chip' && styles.chip, style]}
      hitSlop={hitSlop}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Open your profile and settings"
    >
      <Settings size={size} color={color} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
});
