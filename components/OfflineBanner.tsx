import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { colors, fonts, radii, spacing } from '@/constants/theme';
import { dur, useMotion } from '@/lib/motion';
import { useOnline } from '@/lib/connectivity';

export const OFFLINE_BANNER_HEIGHT = 32;

/**
 * Slim strip under the title row of a band (B-app 9; a pill so it reads inside the rose): maroon on errTint, a live
 * region, 200 ms slide (fade only under Reduce Motion). Renders nothing online.
 * No promise to sync later: nothing is queued.
 */
export default function OfflineBanner({ top, inline }: { top?: number; inline?: boolean }) {
  const online = useOnline();
  const { reduced, ms, fade } = useMotion();
  const progress = useRef(new Animated.Value(online ? 0 : 1)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: online ? 0 : 1,
      duration: online ? fade(dur.fast) : ms(dur.base) || fade(dur.base),
      useNativeDriver: true,
    }).start();
  }, [online, progress, ms, fade]);

  if (online) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.strip,
        inline ? styles.inline : { position: 'absolute', left: 20, right: 20, top, zIndex: 40 },
        { opacity: progress },
        !inline && !reduced && { transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-OFFLINE_BANNER_HEIGHT, 0] }) }] },
      ]}
    >
      <WifiOff size={14} strokeWidth={2} color={colors.maroon} />
      <Text style={styles.text} maxFontSizeMultiplier={1.5} numberOfLines={1}>
        You&apos;re offline. Showing what&apos;s saved on this phone.
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  strip: {
    minHeight: OFFLINE_BANNER_HEIGHT, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.errorLight, borderRadius: radii.full,
  },
  inline: { marginTop: spacing.sm },
  text: { fontFamily: fonts.text, fontSize: 14, lineHeight: 20, color: colors.maroon },
});
