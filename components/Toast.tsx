import { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, AccessibilityInfo } from 'react-native';
import { colors, shadows, radii, spacing, fonts } from '@/constants/theme';

interface ToastProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
  duration?: number;
  bottom?: number;
}

// Transient confirmation pill. Announces itself to VoiceOver on show and
// dismisses itself after `duration`.
export default function Toast({ message, actionLabel, onAction, onDismiss, duration = 4000, bottom = spacing.lg }: ToastProps) {
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [message, duration, onDismiss]);

  return (
    <View style={[styles.wrap, { bottom }]} pointerEvents="box-none">
      <View style={styles.toast} accessibilityLiveRegion="polite" accessibilityRole="alert">
        <Text style={styles.message} testID="toast-message">{message}</Text>
        {actionLabel && onAction && (
          <TouchableOpacity
            onPress={onAction}
            testID="toast-action"
            accessibilityRole="button"
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          >
            <Text style={styles.action}>{actionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.charcoal,
    borderRadius: radii.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    ...shadows.card,
  },
  message: { fontFamily: fonts.text, fontSize: 16, color: colors.card },
  action: { fontFamily: fonts.display, fontSize: 16, color: colors.terraLight },
});
