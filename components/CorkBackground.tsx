import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect } from 'react-native-svg';
import { colors } from '@/constants/theme';

// Shared corkboard-ish backdrop used by both the auto chapter wall and
// custom board canvases, so they read as the same physical "board".
export default function CorkBackground() {
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="cork" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.sky} />
          <Stop offset="1" stopColor={colors.skyDeep} />
        </LinearGradient>
        <RadialGradient id="vignette" cx="50%" cy="50%" r="75%">
          <Stop offset="0.6" stopColor={colors.inkDark} stopOpacity="0" />
          <Stop offset="1" stopColor={colors.inkDark} stopOpacity="0.12" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#cork)" />
      {Array.from({ length: 10 }).map((_, i) => (
        <Rect
          key={i}
          x="0"
          y={`${(i + 0.5) * 10}%`}
          width="100%"
          height="1"
          fill={colors.skyNight}
          opacity={0.15 + (i % 3) * 0.03}
        />
      ))}
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#vignette)" />
    </Svg>
  );
}
