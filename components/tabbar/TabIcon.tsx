// Tab bar glyphs (icon artist, Nov 2026). Geometry lives in icons.json, the
// source copy is research_notes/tabbar-redesign-2026-11/icons-v3/icons.json.
import Svg, { Path } from 'react-native-svg';
import icons from './icons.json';
import { TAB, tabColors } from '@/constants/tabBar';
import { useTheme } from '@/hooks/useTheme';

export type TabGlyph = 'collection' | 'calendar' | 'boards' | 'profile';
type Token = 'ink' | 'ko' | 'none';
type Part = { d: string; fill: Token; stroke: Token };

/** One state of a glyph: the outline (inactive) or the filled (active) drawing. */
export function TabIcon({ name, active, size = TAB.iconSize }: { name: TabGlyph; active: boolean; size?: number }) {
  const { colors, isDark } = useTheme();
  const tc = tabColors(colors, isDark);
  const ink = active ? tc.inkOn : tc.inkOff;
  const col = (t: Token) => (t === 'ink' ? ink : t === 'ko' ? tc.pill : 'none');
  const parts = icons.glyphs[name][active ? 'active' : 'inactive'] as Part[];
  return (
    <Svg width={size} height={size} viewBox={icons.meta.viewBox}>
      {parts.map((p, i) => (
        <Path
          key={i}
          d={p.d}
          fill={col(p.fill)}
          stroke={col(p.stroke)}
          strokeWidth={icons.meta.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}

/** The Scan camera: one evenodd path, so the lens is a real hole. */
export function CameraGlyph({ size = TAB.camera, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox={icons.meta.viewBox}>
      <Path d={icons.camera.d} fill={color} fillRule="evenodd" />
    </Svg>
  );
}
