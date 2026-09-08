import { forwardRef, useState } from 'react';
import {
  View, TextInput, TouchableOpacity, StyleSheet,
  TextInputProps, StyleProp, TextStyle,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { colors, spacing } from '@/constants/theme';

interface PasswordFieldProps extends Omit<TextInputProps, 'secureTextEntry' | 'style'> {
  /// The screen's own input style. Its margins are lifted onto the wrapper —
  /// see below — so a field can be dropped in wherever a plain TextInput was
  /// without the surrounding rhythm shifting.
  style?: StyleProp<TextStyle>;
}

// Room for the eye, so a long password doesn't run underneath it.
const TOGGLE_WIDTH = 44;

/**
 * A password box you can look inside.
 *
 * Typing a password blind on a phone keyboard and being told only afterwards
 * that it was wrong is the single most common way a sign-in goes bad, and
 * every app the user has ever signed into offers this. It was missing from
 * all four of this app's password fields.
 *
 * The margins are moved from the input to the wrapper on purpose: every
 * caller's `styles.input` carries a `marginBottom` for the gap to the next
 * field, and left on the input that margin would sit *inside* the wrapper —
 * centring the eye against the input plus its own gap, i.e. half a gap too
 * low, on every screen.
 */
const PasswordField = forwardRef<TextInput, PasswordFieldProps>(function PasswordField(
  { style, ...props }, ref,
) {
  const [visible, setVisible] = useState(false);
  const {
    margin, marginTop, marginBottom, marginLeft, marginRight,
    marginVertical, marginHorizontal,
    ...inputStyle
  } = (StyleSheet.flatten(style) ?? {}) as TextStyle;

  return (
    <View style={[
      styles.wrap,
      { margin, marginTop, marginBottom, marginLeft, marginRight, marginVertical, marginHorizontal },
    ]}>
      <TextInput
        ref={ref}
        {...props}
        style={[inputStyle, styles.input]}
        secureTextEntry={!visible}
      />
      <TouchableOpacity
        style={styles.toggle}
        onPress={() => setVisible(v => !v)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        accessibilityState={{ selected: visible }}
      >
        {visible
          ? <EyeOff size={18} color={colors.inkLight} />
          : <Eye size={18} color={colors.inkLight} />}
      </TouchableOpacity>
    </View>
  );
});

export default PasswordField;

const styles = StyleSheet.create({
  wrap: { position: 'relative', justifyContent: 'center' },
  input: { marginBottom: 0, paddingRight: TOGGLE_WIDTH },
  toggle: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: TOGGLE_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
