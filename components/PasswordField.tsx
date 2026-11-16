import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { MIN_TAP } from '@/constants/theme';
import Field, { type FieldProps } from '@/components/ui/Field';
import { useTheme, useThemedStyles, type Theme } from '@/hooks/useTheme';

/**
 * A password box you can look inside (typing blind on a phone keyboard and being
 * told afterwards it was wrong is the commonest way a sign-in goes bad). It is a
 * `Field` with the eye in its right edge: a 44pt control that sits inside the
 * 52pt box, so it needs no hitSlop (lesson 9). Callers pass the placeholder, the
 * autofill hints and `returnKeyType` (lesson 11) straight through.
 */
const PasswordField = forwardRef<TextInput, Omit<FieldProps, 'secureTextEntry' | 'right'>>(
  function PasswordField(props, ref) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
    const [visible, setVisible] = useState(false);
    return (
      <Field
        ref={ref}
        {...props}
        secureTextEntry={!visible}
        right={
          <Pressable
            style={styles.toggle}
            onPress={() => setVisible((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Hide password' : 'Show password'}
            accessibilityState={{ selected: visible }}
          >
            {visible
              ? <EyeOff size={20} strokeWidth={1.75} color={colors.inkLight} />
              : <Eye size={20} strokeWidth={1.75} color={colors.inkLight} />}
          </Pressable>
        }
      />
    );
  },
);

export default PasswordField;

const makeStyles = (_t: Theme) => StyleSheet.create({
  toggle: { width: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center', marginRight: -6 },
});
