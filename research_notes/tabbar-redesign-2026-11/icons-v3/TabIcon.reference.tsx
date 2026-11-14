// REFERENCE ONLY, not wired into the app. react-native-svg 15.12.x.
// Shows exactly how icons.json renders. Colours are caller-supplied tokens.
import React from 'react';
import Svg, { Path } from 'react-native-svg';
import icons from './icons.json';

export const INK_INACTIVE = '#5A2429';
export const INK_ACTIVE = '#3A1519';
export const KNOCKOUT = '#E4A0A1'; // the flat pill colour under the icon (theme colors.blush); pass the pill colour if it ever changes
// Profile glyph: bar designer's optical-weight adjustment (2026-11-14), see icons.json meta.changes. The paths themselves live only in icons.json.

type TabName = 'collection' | 'calendar' | 'boards' | 'profile';
type Part = { d: string; fill: 'ink' | 'ko' | 'none'; stroke: 'ink' | 'ko' | 'none' };

type Props = {
  name: TabName;
  active: boolean;
  /** 24 puts 1 grid unit on exactly 1 pt (whole device pixels at @2x/@3x for half-unit coords); 25 is also fine. */
  size?: number;
  ink?: string; // override; defaults by `active`
  knockout?: string;
};

export function TabIcon({ name, active, size = 24, ink, knockout = KNOCKOUT }: Props) {
  const inkColor = ink ?? (active ? INK_ACTIVE : INK_INACTIVE);
  const col = (t: Part['fill']) => (t === 'ink' ? inkColor : t === 'ko' ? knockout : 'none');
  const parts = icons.glyphs[name][active ? 'active' : 'inactive'] as Part[];
  return (
    <Svg width={size} height={size} viewBox={icons.meta.viewBox}>
      {parts.map((p, i) => (
        <Path
          key={i}
          d={p.d}
          fill={col(p.fill)}
          stroke={col(p.stroke)}
          // strokeWidth must be set on every Path (Svg-level props only inherit when the Path sets none)
          strokeWidth={icons.meta.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}

/** White camera for the Scan disc. One evenodd path: the lens is a true hole, so the disc colour shows through. */
export function CameraIcon({ size = 24, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox={icons.meta.viewBox}>
      <Path d={icons.camera.d} fill={color} fillRule="evenodd" />
    </Svg>
  );
}
