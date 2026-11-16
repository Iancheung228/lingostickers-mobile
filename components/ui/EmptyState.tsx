import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Camera } from 'lucide-react-native';
import { fonts, spacing } from '@/constants/theme';
import Button from './Button';
import { useTheme, useThemedStyles, type Theme } from '@/hooks/useTheme';

interface EmptyStateProps {
  title: string;
  body?: string;
  /** Replaces the default camera glyph (e.g. a real cutout once the user has one). */
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}

// C-look 4 "Empty states": a 56pt sand disc with one glyph, title h2 22, body 16
// inkLight at most ~36ch, one primary button. No illustrations.
export default function EmptyState({ title, body, icon, actionLabel, onAction, testID }: EmptyStateProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.disc} accessible={false}>
        {icon ?? <Camera size={28} strokeWidth={1.75} color={colors.inkLight} />}
      </View>
      <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.5}>{title}</Text>
      {body ? <Text style={styles.body} maxFontSizeMultiplier={2}>{body}</Text> : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} style={styles.action} /> : null}
    </View>
  );
}

const makeStyles = ({ colors }: Theme) => StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.xl, gap: spacing.sm },
  disc: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  title: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.inkDark, textAlign: 'center' },
  body: { fontFamily: fonts.text, fontSize: 16, lineHeight: 24, color: colors.inkLight, textAlign: 'center', maxWidth: 300 },
  action: { marginTop: spacing.ms, alignSelf: 'stretch' },
});
