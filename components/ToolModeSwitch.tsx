import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutChangeEvent } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, radii, spacing, fonts } from '@/constants/theme';

export type ToolMode = 'box' | 'lasso';

interface ToolModeSwitchProps {
  mode: ToolMode;
  onChange: (mode: ToolMode) => void;
}

const OPTIONS: { key: ToolMode; label: string }[] = [
  { key: 'box', label: 'Box' },
  { key: 'lasso', label: 'Lasso' },
];

const TRACK_PADDING = 4;

export default function ToolModeSwitch({ mode, onChange }: ToolModeSwitchProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const segmentWidth = trackWidth > 0 ? (trackWidth - TRACK_PADDING * 2) / OPTIONS.length : 0;
  const activeIndex = OPTIONS.findIndex((option) => option.key === mode);

  const pillX = useSharedValue(0);
  useEffect(() => {
    pillX.value = withSpring(activeIndex * segmentWidth, { damping: 18, stiffness: 220 });
  }, [activeIndex, segmentWidth]);

  const pillStyle = useAnimatedStyle(() => ({
    width: segmentWidth,
    transform: [{ translateX: pillX.value }],
  }));

  return (
    <View style={styles.track} onLayout={(e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width)}>
      {trackWidth > 0 && <Animated.View style={[styles.pill, pillStyle]} />}
      {OPTIONS.map((option) => {
        const active = option.key === mode;
        return (
          <TouchableOpacity
            key={option.key}
            style={styles.segment}
            onPress={() => {
              if (option.key !== mode) Haptics.selectionAsync();
              onChange(option.key);
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: TRACK_PADDING,
  },
  pill: {
    position: 'absolute',
    top: TRACK_PADDING,
    left: TRACK_PADDING,
    bottom: TRACK_PADDING,
    backgroundColor: colors.terra,
    borderRadius: 16,
    shadowColor: colors.terra,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 14, fontWeight: '600', color: colors.inkMid },
  labelActive: { color: colors.inkDark, fontWeight: '700' },
});
