import { forwardRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { fonts, radii, spacing } from '@/constants/theme';
import { useTheme, useThemedStyles, type Theme } from '@/hooks/useTheme';

export interface FieldProps extends Omit<TextInputProps, 'style'> {
  /** Inline error under the field: pass friendlyError()-style copy, never error.message. */
  error?: string | null;
  /** Neutral helper under the field when there is no error. */
  hint?: string;
  /** A control inside the right edge (the password eye). */
  right?: ReactNode;
  /** Colour for a positive hint (e.g. "Username available"). */
  hintTone?: 'ok' | 'muted';
}

// C-look 4 "Inputs": 52 tall, white, `ctl` border (3:1), radius 16, Newsreader 16,
// placeholder `inkLight`. Focus: border `terra` 2px; error: border `err` and 14pt
// `err` text under it (no shake). The visible label is the placeholder: Maestro and
// the approved flows address these fields by it ("Email", "Password"), so a second
// text label above would steal the tap. The accessibilityLabel is the placeholder.
const Field = forwardRef<TextInput, FieldProps>(function Field(
  { error, hint, right, hintTone = 'muted', onFocus, onBlur, placeholder, accessibilityLabel, ...props }, ref,
) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [focused, setFocused] = useState(false);
  const border = error ? colors.error : focused ? colors.terra : colors.ctl;
  const width = focused || error ? 2 : 1;
  return (
    <View style={styles.wrap}>
      <View style={[styles.box, { borderColor: border, borderWidth: width, paddingHorizontal: spacing.md - width + 1 }]}>
        <TextInput
          ref={ref}
          {...props}
          placeholder={placeholder}
          placeholderTextColor={colors.inkLight}
          accessibilityLabel={accessibilityLabel ?? placeholder}
          maxFontSizeMultiplier={1.5}
          selectionColor={colors.terra}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          style={[styles.input, right ? styles.inputWithRight : null]}
        />
        {right}
      </View>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite" maxFontSizeMultiplier={2}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={[styles.hint, hintTone === 'ok' && styles.hintOk]} accessibilityLiveRegion="polite" maxFontSizeMultiplier={2}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

export default Field;

const makeStyles = ({ colors }: Theme) => StyleSheet.create({
  wrap: { marginBottom: spacing.ms },
  box: {
    minHeight: 52, flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: radii.md,
  },
  input: {
    flex: 1, minHeight: 48, fontFamily: fonts.text, fontSize: 16, lineHeight: 22, color: colors.inkMid,
    paddingVertical: 0,
  },
  inputWithRight: { paddingRight: spacing.xs },
  error: { fontFamily: fonts.text, fontSize: 14, lineHeight: 20, color: colors.errorInk, marginTop: 6, marginLeft: 4 },
  hint: { fontFamily: fonts.text, fontSize: 14, lineHeight: 20, color: colors.inkLight, marginTop: 6, marginLeft: 4 },
  hintOk: { color: colors.successInk },
});
