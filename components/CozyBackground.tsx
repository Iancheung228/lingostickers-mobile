import { StyleSheet, View, useWindowDimensions } from 'react-native';
import BackgroundScene from './illustrations/BackgroundScene';
import { colors } from '@/constants/theme';

interface CozyBackgroundProps {
  children: React.ReactNode;
  // 'full'  — entire screen illustrated (auth screens)
  // 'strip' — sky at top + hills peeking at bottom, warm flat fill in middle
  variant?: 'full' | 'strip';
}

export default function CozyBackground({ children, variant = 'full' }: CozyBackgroundProps) {
  const { height } = useWindowDimensions();

  if (variant === 'full') {
    return (
      <View style={styles.root}>
        <View style={StyleSheet.absoluteFill}>
          <BackgroundScene variant="full" />
        </View>
        {/* Grain overlay — subtle noise for risograph feel */}
        <View style={styles.grain} pointerEvents="none" />
        {children}
      </View>
    );
  }

  // 'strip' — flat sky fill with scene at top, flat ground strip at bottom
  return (
    <View style={[styles.root, { backgroundColor: colors.sky }]}>
      {/* Sky scene — top 220px */}
      <View style={styles.stripTop} pointerEvents="none">
        <BackgroundScene variant="strip" height={220} />
      </View>
      {/* Content sits above the scene via zIndex */}
      <View style={styles.stripContent}>
        {children}
      </View>
      <View style={styles.grain} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  // Very subtle dot-grid grain for risograph aesthetic
  grain: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.018,
    backgroundColor: 'transparent',
    // React Native can't do SVG feTurbulence in a View — the visual effect
    // is carried mostly by the warm palette. A future iteration could use
    // a transparent PNG grain overlay image here.
  },
  stripTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 220,
    overflow: 'hidden',
  },
  stripContent: {
    flex: 1,
  },
});
