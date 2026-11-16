import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { TAB, tabColors } from '@/constants/tabBar';
import { useTheme } from '@/hooks/useTheme';

/**
 * Page-colour fade behind the bar so scrolled content dissolves before it
 * reaches the pill: transparent at the crest's top, tc.fade.opacity 28 pt
 * lower, then deepening to solid at the screen bottom. Not touchable.
 */
export default function TabBarFade({ height }: { height: number }) {
  const { colors, isDark } = useTheme();
  const tc = tabColors(colors, isDark);
  const mid = Math.min(0.95, TAB.fade.height / height);
  return (
    <View pointerEvents="none" style={[styles.fade, { height }]}>
      <Svg width="100%" height={height} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="tabFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={tc.fade.color} stopOpacity="0" />
            <Stop offset={mid} stopColor={tc.fade.color} stopOpacity={tc.fade.opacity} />
            <Stop offset="1" stopColor={tc.fade.color} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height={height} fill="url(#tabFade)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
