import { useEffect, useRef } from 'react';
import { AccessibilityInfo, findNodeHandle, StyleSheet, Text, View } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { colors, e2, radii, spacing, type } from '@/constants/theme';
import { haptic } from '@/lib/haptics';
import { SCAN_ERRORS, type ScanAction, type ScanErrorKind } from '@/lib/scanError';
import Button from '@/components/ui/Button';

// A failed scan, inline over the photo that was taken (B-core 2). The input is
// kept, the first button is the recovery that most likely works, and nothing
// here is an Alert. One Error haptic on arrival; VoiceOver hears the title and
// focus moves to the first button.
export default function ScanErrorCard({
  kind, onAction,
}: {
  kind: ScanErrorKind;
  onAction: (action: ScanAction) => void;
}) {
  const copy = SCAN_ERRORS[kind];
  const first = useRef<View>(null);

  useEffect(() => {
    haptic.error();
    AccessibilityInfo.announceForAccessibility(copy.title);
    const t = setTimeout(() => {
      const node = first.current ? findNodeHandle(first.current) : null;
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    }, 400);
    return () => clearTimeout(t);
  }, [copy.title]);

  return (
    <View style={styles.card} accessibilityRole="alert" testID={`scan-error-${kind}`}>
      <View style={styles.head}>
        <AlertCircle size={20} strokeWidth={1.75} color={colors.error} style={styles.icon} />
        <Text style={styles.title} maxFontSizeMultiplier={1.5} testID="scan-error-title">{copy.title}</Text>
      </View>
      <View style={styles.actions}>
        {copy.actions.map((a, i) => (
          <View key={a.action} ref={i === 0 ? first : undefined} collapsable={false}>
            <Button
              kind={i === 0 ? 'primary' : i === 1 ? 'secondary' : 'tertiary'}
              label={a.label}
              testID={`scan-error-${a.action}`}
              onPress={() => onAction(a.action)}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.md, gap: spacing.md, alignSelf: 'stretch', ...e2 },
  head: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  icon: { marginTop: 2 },
  title: { ...type.h2, fontSize: 18, lineHeight: 24, flex: 1 },
  actions: { gap: spacing.sm },
});
