import { StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '@/hooks/useTheme';

// The default board surface when the user hasn't chosen a photo: the same
// cream radial field as the Home wall (SPEC "Sticker wall"), no grain and no
// physical-board texture. (The file keeps its old name so importers needn't
// change; it no longer draws cork.)
export default function CorkBackground() {
  const { wall } = useTheme();
  const [a, b, c] = wall.fieldStops;
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id="field" cx="50%" cy="30%" rx="130%" ry="100%" fx="50%" fy="30%" gradientUnits="objectBoundingBox">
          <Stop offset="0" stopColor={a} />
          <Stop offset="0.55" stopColor={b} />
          <Stop offset="1" stopColor={c} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#field)" />
    </Svg>
  );
}
