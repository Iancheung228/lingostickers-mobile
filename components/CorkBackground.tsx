import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect } from 'react-native-svg';
import { colors } from '@/constants/theme';

// The grain lines are a *texture*, so their thickness has to scale with the
// surface the way their spacing (a percentage) already does. Left at an
// absolute `height="1"` they stayed 1pt thick on a 62pt rail thumbnail as
// well as on a ~467pt board canvas — 10 lines 7.6pt apart instead of 46.7pt
// apart, i.e. ~6x the ink density, which is why the same component read as a
// smooth gradient on the canvas and as visible hatching in BoardRail's
// miniature of that same board. As a percentage it lands at ~0.9pt on the
// canvas (so the canvas is unchanged) and fades out on the thumbnail —
// which is exactly what a real texture does when you shrink it.
const GRAIN_HEIGHT_PCT = 0.2;

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
          height={`${GRAIN_HEIGHT_PCT}%`}
          fill={colors.skyNight}
          opacity={0.15 + (i % 3) * 0.03}
        />
      ))}
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#vignette)" />
    </Svg>
  );
}
