import { StyleSheet, Text, View } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { colors, fonts, radii, spacing } from '@/constants/theme';
import Button from './Button';

interface InlineErrorProps {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  testID?: string;
}

// C-look 4 "Inline error": errTint block, radius 16, 12 padding, 16pt icon, 14pt
// err text, "Try again" as a tertiary button inside. Pass the output of
// friendlyError(), never error.message.
export default function InlineError({ message, onRetry, retryLabel = 'Try again', testID }: InlineErrorProps) {
  return (
    <View style={styles.box} accessibilityRole="alert" accessibilityLiveRegion="polite" testID={testID}>
      <View style={styles.row}>
        <AlertCircle size={16} strokeWidth={2} color={colors.error} style={styles.icon} />
        <Text style={styles.text} maxFontSizeMultiplier={2}>{message}</Text>
      </View>
      {onRetry && <Button kind="tertiary" label={retryLabel} onPress={onRetry} style={styles.retry} />}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.errorLight, borderRadius: radii.md, padding: spacing.ms },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  icon: { marginTop: 2 },
  text: { flex: 1, fontFamily: fonts.text, fontSize: 14, lineHeight: 20, color: colors.error },
  retry: { alignSelf: 'flex-start', marginTop: spacing.xs },
});
