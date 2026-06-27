import Svg, {
  Ellipse, Circle, Path, G, Line, Text as SvgText,
} from 'react-native-svg';

interface OtterMascotProps {
  size?: number;
  variant?: 'sleeping' | 'small';
}

// Kawaii flat otter — geometric shapes, minimal detail, warm palette.
// 'sleeping': large, used on auth screens
// 'small': compact, used in empty states
export default function OtterMascot({ size = 180, variant = 'sleeping' }: OtterMascotProps) {
  if (variant === 'small') {
    return <OtterSmall size={size} />;
  }
  return <OtterSleeping size={size} />;
}

// ─── Sleeping otter (auth / hero) ────────────────────────────────────────────
function OtterSleeping({ size }: { size: number }) {
  const vw = 200;
  const vh = 160;
  const scale = size / vw;

  return (
    <Svg
      width={vw * scale}
      height={vh * scale}
      viewBox={`0 0 ${vw} ${vh}`}
    >
      {/* Tail — sweeping curve behind body */}
      <Path
        d="M 155 115 Q 185 130 178 110 Q 172 92 155 105"
        fill="#8B6040"
        opacity={0.9}
      />
      {/* Body — large warm-brown oval, slightly tilted */}
      <Ellipse cx={100} cy={112} rx={62} ry={36} fill="#C4956A" />
      {/* Belly patch — lighter oval */}
      <Ellipse cx={98} cy={116} rx={38} ry={22} fill="#E8C89A" />

      {/* Left hind paw */}
      <Ellipse cx={52} cy={138} rx={16} ry={10} fill="#A67550" />
      <Ellipse cx={52} cy={135} rx={14} ry={8} fill="#C4956A" />
      {/* Right hind paw */}
      <Ellipse cx={145} cy={138} rx={16} ry={10} fill="#A67550" />
      <Ellipse cx={145} cy={135} rx={14} ry={8} fill="#C4956A" />

      {/* Front paws folded under chin */}
      <Ellipse cx={80} cy={97} rx={13} ry={9} fill="#A67550" />
      <Ellipse cx={80} cy={95} rx={12} ry={8} fill="#C4956A" />
      <Ellipse cx={106} cy={95} rx={13} ry={9} fill="#A67550" />
      <Ellipse cx={106} cy={93} rx={12} ry={8} fill="#C4956A" />

      {/* Head */}
      <Ellipse cx={88} cy={72} rx={36} ry={34} fill="#C4956A" />
      {/* Face patch */}
      <Ellipse cx={88} cy={78} rx={22} ry={20} fill="#E8C89A" />

      {/* Ears */}
      <Circle cx={59} cy={46} r={13} fill="#C4956A" />
      <Circle cx={59} cy={46} r={8} fill="#DDB08A" />
      <Circle cx={117} cy={46} r={13} fill="#C4956A" />
      <Circle cx={117} cy={46} r={8} fill="#DDB08A" />

      {/* Closed crescent eyes */}
      <Path d="M 77 72 Q 81 68 85 72" stroke="#2C1A0E" strokeWidth={2.5} strokeLinecap="round" fill="none" />
      <Path d="M 92 71 Q 96 67 100 71" stroke="#2C1A0E" strokeWidth={2.5} strokeLinecap="round" fill="none" />

      {/* Nose */}
      <Ellipse cx={88} cy={81} rx={5} ry={3.5} fill="#A06040" />

      {/* Whisker dots */}
      <Circle cx={68} cy={80} r={1.5} fill="#8B6040" opacity={0.6} />
      <Circle cx={73} cy={83} r={1.5} fill="#8B6040" opacity={0.6} />
      <Circle cx={68} cy={86} r={1.5} fill="#8B6040" opacity={0.6} />
      <Circle cx={108} cy={80} r={1.5} fill="#8B6040" opacity={0.6} />
      <Circle cx={103} cy={83} r={1.5} fill="#8B6040" opacity={0.6} />
      <Circle cx={108} cy={86} r={1.5} fill="#8B6040" opacity={0.6} />

      {/* Zzz floats */}
      <SvgText x={125} y={50} fontSize={13} fontWeight="bold" fill="#C4956A" opacity={0.7} fontFamily="Georgia, serif">z</SvgText>
      <SvgText x={138} y={36} fontSize={10} fontWeight="bold" fill="#C4956A" opacity={0.5} fontFamily="Georgia, serif">z</SvgText>
      <SvgText x={148} y={24} fontSize={7} fontWeight="bold" fill="#C4956A" opacity={0.35} fontFamily="Georgia, serif">z</SvgText>
    </Svg>
  );
}

// ─── Small otter (empty state) ───────────────────────────────────────────────
function OtterSmall({ size }: { size: number }) {
  const vw = 80;
  const vh = 80;
  const scale = size / vw;

  return (
    <Svg
      width={vw * scale}
      height={vh * scale}
      viewBox={`0 0 ${vw} ${vh}`}
    >
      {/* Body */}
      <Ellipse cx={40} cy={52} rx={24} ry={18} fill="#C4956A" />
      <Ellipse cx={40} cy={55} rx={15} ry={11} fill="#E8C89A" />
      {/* Tail */}
      <Path d="M 60 52 Q 72 58 70 48 Q 68 40 60 47" fill="#8B6040" opacity={0.85} />
      {/* Head */}
      <Ellipse cx={40} cy={30} rx={18} ry={17} fill="#C4956A" />
      <Ellipse cx={40} cy={34} rx={11} ry={10} fill="#E8C89A" />
      {/* Ears */}
      <Circle cx={25} cy={17} r={7} fill="#C4956A" />
      <Circle cx={25} cy={17} r={4} fill="#DDB08A" />
      <Circle cx={55} cy={17} r={7} fill="#C4956A" />
      <Circle cx={55} cy={17} r={4} fill="#DDB08A" />
      {/* Eyes closed */}
      <Path d="M 33 30 Q 36 27 39 30" stroke="#2C1A0E" strokeWidth={1.8} strokeLinecap="round" fill="none" />
      <Path d="M 41 29 Q 44 26 47 29" stroke="#2C1A0E" strokeWidth={1.8} strokeLinecap="round" fill="none" />
      {/* Nose */}
      <Ellipse cx={40} cy={36} rx={3} ry={2} fill="#A06040" />
      {/* Paws */}
      <Ellipse cx={25} cy={62} rx={9} ry={6} fill="#A67550" />
      <Ellipse cx={55} cy={62} rx={9} ry={6} fill="#A67550" />
      {/* Zzz */}
      <SvgText x={60} y={24} fontSize={9} fontWeight="bold" fill="#C4956A" opacity={0.7} fontFamily="Georgia, serif">z</SvgText>
      <SvgText x={67} y={16} fontSize={6} fontWeight="bold" fill="#C4956A" opacity={0.45} fontFamily="Georgia, serif">z</SvgText>
    </Svg>
  );
}
