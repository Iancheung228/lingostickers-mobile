import { useWindowDimensions } from 'react-native';
import Svg, {
  Defs, RadialGradient, LinearGradient, Stop,
  Rect, Ellipse, Circle, Path, G, Polygon,
} from 'react-native-svg';

interface BackgroundSceneProps {
  // 'full'  → entire screen (auth screens)
  // 'strip' → only top ~40% sky + bottom hill edge (tab screens — content overlays the middle)
  variant?: 'full' | 'strip';
  height?: number;
}

export default function BackgroundScene({ variant = 'full', height }: BackgroundSceneProps) {
  const { width, height: winH } = useWindowDimensions();
  const h = height ?? winH;

  // We draw in a 390×844 logical space then scale to fill the screen
  const VW = 390;
  const VH = 844;

  return (
    <Svg
      width={width}
      height={h}
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio="xMidYMid slice"
    >
      <Defs>
        {/* Sky gradient — warm amber at horizon, deeper parchment above */}
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0"   stopColor="#ECD5A8" stopOpacity="1" />
          <Stop offset="0.5" stopColor="#F5E6C8" stopOpacity="1" />
          <Stop offset="1"   stopColor="#E8C882" stopOpacity="1" />
        </LinearGradient>

        {/* Ground gradient */}
        <LinearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#7A9E7A" stopOpacity="1" />
          <Stop offset="1" stopColor="#5A7A5A" stopOpacity="1" />
        </LinearGradient>

        {/* Far hill */}
        <LinearGradient id="hillFar" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#9AB89A" stopOpacity="1" />
          <Stop offset="1" stopColor="#7A9E7A" stopOpacity="1" />
        </LinearGradient>

        {/* Moon glow */}
        <RadialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0"   stopColor="#FFF0A0" stopOpacity="0.6" />
          <Stop offset="1"   stopColor="#F5E6C8" stopOpacity="0"   />
        </RadialGradient>
      </Defs>

      {/* ── Sky ── */}
      <Rect x={0} y={0} width={VW} height={VH} fill="url(#sky)" />

      {/* ── Moon glow halo ── */}
      <Ellipse cx={310} cy={90} rx={55} ry={55} fill="url(#moonGlow)" />

      {/* ── Crescent moon ── */}
      <Circle cx={310} cy={88} r={22} fill="#F0C060" />
      <Circle cx={322} cy={82} r={18} fill="#ECD5A8" />

      {/* ── Stars ── */}
      {STARS.map((s, i) => (
        <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#FFF8E8" opacity={s.op} />
      ))}

      {/* ── Star sparkles (4-pointed) ── */}
      {SPARKLES.map((s, i) => (
        <G key={i} transform={`translate(${s.x},${s.y})`}>
          <Polygon
            points={sparklePoints(s.size)}
            fill="#FFF8E8"
            opacity={s.op}
          />
        </G>
      ))}

      {/* ── Far rolling hill ── */}
      <Path
        d={`M -10 ${VH * 0.62}
            Q 80 ${VH * 0.50} 160 ${VH * 0.54}
            Q 240 ${VH * 0.58} 310 ${VH * 0.52}
            Q 360 ${VH * 0.48} ${VW + 10} ${VH * 0.55}
            L ${VW + 10} ${VH} L -10 ${VH} Z`}
        fill="url(#hillFar)"
      />

      {/* ── Near ground ── */}
      <Path
        d={`M -10 ${VH * 0.72}
            Q 60 ${VH * 0.67} 130 ${VH * 0.70}
            Q 200 ${VH * 0.73} 270 ${VH * 0.68}
            Q 330 ${VH * 0.64} ${VW + 10} ${VH * 0.70}
            L ${VW + 10} ${VH} L -10 ${VH} Z`}
        fill="url(#ground)"
      />

      {/* ── Trees (flat geometric, Ref-2 style) ── */}
      <FlatTree x={50}  groundY={VH * 0.68} trunkH={50} canopyR={28} color="#5A8060" trunkColor="#8B6040" />
      <FlatTree x={128} groundY={VH * 0.66} trunkH={38} canopyR={22} color="#6A9070" trunkColor="#8B6040" />
      <FlatTree x={290} groundY={VH * 0.67} trunkH={44} canopyR={25} color="#5A8060" trunkColor="#8B6040" />
      <FlatTree x={355} groundY={VH * 0.69} trunkH={35} canopyR={20} color="#6A9070" trunkColor="#8B6040" />

      {/* ── Small bushes ── */}
      <Ellipse cx={200} cy={VH * 0.71} rx={20} ry={12} fill="#6A9070" />
      <Ellipse cx={220} cy={VH * 0.715} rx={15} ry={9} fill="#5A8060" />
      <Ellipse cx={170} cy={VH * 0.715} rx={14} ry={8} fill="#78A078" />

      {/* ── Tent (right side, Ref-2 style) ── */}
      <Tent x={310} y={VH * 0.69} size={44} />

      {/* ── Small flower ── */}
      <Circle cx={230} cy={VH * 0.702} r={4} fill="#E8956A" />
      <Circle cx={230} cy={VH * 0.702} r={2} fill="#F0C060" />

      {/* ── Soft cloud shapes ── */}
      <Cloud x={40}  y={130} scale={1.0} />
      <Cloud x={240} y={100} scale={0.75} />
      <Cloud x={160} y={185} scale={0.55} />
    </Svg>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FlatTree({
  x, groundY, trunkH, canopyR, color, trunkColor,
}: {
  x: number; groundY: number; trunkH: number; canopyR: number; color: string; trunkColor: string;
}) {
  const trunkW = 8;
  const canopyCy = groundY - trunkH - canopyR * 0.6;
  return (
    <G>
      {/* Trunk */}
      <Rect
        x={x - trunkW / 2}
        y={groundY - trunkH}
        width={trunkW}
        height={trunkH}
        rx={4}
        fill={trunkColor}
      />
      {/* Canopy — stacked ellipses for layered look */}
      <Ellipse cx={x} cy={canopyCy + 8}  rx={canopyR}       ry={canopyR * 0.75} fill={color} opacity={0.7} />
      <Ellipse cx={x} cy={canopyCy}      rx={canopyR * 0.9} ry={canopyR * 0.8}  fill={color} />
      <Ellipse cx={x} cy={canopyCy - 6}  rx={canopyR * 0.65} ry={canopyR * 0.6} fill={color} opacity={0.9} />
    </G>
  );
}

function Tent({ x, y, size }: { x: number; y: number; size: number }) {
  // Simple A-frame tent
  const h = size;
  const w = size * 1.4;
  return (
    <G>
      {/* Main tent body */}
      <Path
        d={`M ${x} ${y - h} L ${x - w / 2} ${y} L ${x + w / 2} ${y} Z`}
        fill="#E8C882"
        stroke="#C4956A"
        strokeWidth={1.5}
      />
      {/* Door */}
      <Path
        d={`M ${x - 8} ${y} Q ${x} ${y - h * 0.38} ${x + 8} ${y}`}
        fill="#DDB08A"
        stroke="#C4956A"
        strokeWidth={1}
      />
      {/* Left panel line */}
      <Path
        d={`M ${x} ${y - h} L ${x - w / 2} ${y}`}
        stroke="#C4956A"
        strokeWidth={1}
        fill="none"
        opacity={0.5}
      />
    </G>
  );
}

function Cloud({ x, y, scale }: { x: number; y: number; scale: number }) {
  const s = scale;
  return (
    <G opacity={0.55}>
      <Ellipse cx={x}       cy={y}      rx={38 * s} ry={20 * s} fill="#FFF8E8" />
      <Ellipse cx={x - 22 * s} cy={y + 6 * s} rx={22 * s} ry={16 * s} fill="#FFF8E8" />
      <Ellipse cx={x + 22 * s} cy={y + 6 * s} rx={22 * s} ry={16 * s} fill="#FFF8E8" />
      <Ellipse cx={x - 10 * s} cy={y - 8 * s} rx={20 * s} ry={14 * s} fill="#FFF8E8" />
      <Ellipse cx={x + 10 * s} cy={y - 8 * s} rx={20 * s} ry={14 * s} fill="#FFF8E8" />
    </G>
  );
}

// ─── Data ────────────────────────────────────────────────────────────────────

const STARS = [
  { x: 30,  y: 55,  r: 2.2, op: 0.9  },
  { x: 80,  y: 38,  r: 1.5, op: 0.75 },
  { x: 140, y: 62,  r: 1.8, op: 0.85 },
  { x: 185, y: 30,  r: 1.2, op: 0.6  },
  { x: 230, y: 55,  r: 1.5, op: 0.7  },
  { x: 260, y: 40,  r: 2.0, op: 0.8  },
  { x: 340, y: 55,  r: 1.4, op: 0.65 },
  { x: 370, y: 32,  r: 1.8, op: 0.75 },
  { x: 55,  y: 120, r: 1.2, op: 0.55 },
  { x: 165, y: 105, r: 1.0, op: 0.5  },
  { x: 280, y: 125, r: 1.3, op: 0.6  },
  { x: 360, y: 115, r: 1.1, op: 0.5  },
];

const SPARKLES = [
  { x: 110, y: 48,  size: 5, op: 0.8  },
  { x: 360, y: 145, size: 4, op: 0.65 },
  { x: 25,  y: 160, size: 3, op: 0.55 },
];

function sparklePoints(size: number): string {
  const s = size;
  return `0,${-s} ${s * 0.25},${-s * 0.25} ${s},0 ${s * 0.25},${s * 0.25} 0,${s} ${-s * 0.25},${s * 0.25} ${-s},0 ${-s * 0.25},${-s * 0.25}`;
}
