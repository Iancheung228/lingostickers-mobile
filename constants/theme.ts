// Cozy pastel watercolor palette (AI Studio redesign)
export const colors = {
  // Backgrounds
  sky:        '#FDFDF4', // warm cream — primary screen bg
  skyDeep:    '#C0EAFD', // panel blue — rounded feature panels
  skyNight:   '#A6DDF6', // muted sky border

  // UI surfaces
  card:       '#FFFFFF', // white — cards, inputs
  cardAlt:    '#EAF7FE', // pale sky tint — alt cards
  overlay:    'rgba(253, 253, 244, 0.88)', // semi-transparent cream for list screens

  // Brand / interactive
  terra:      '#9BE0FC', // sky blue — primary CTA
  terraDark:  '#85D3F2', // pressed state
  terraLight: '#D6F1FD', // disabled / muted CTA
  sage:       '#F2B84B', // amber — active tabs, badges
  sageDark:   '#D99A2B',
  sageLight:  '#FDECC8',

  // Text
  inkDark:    '#1C4966', // navy — headings
  inkMid:     '#334155', // body text
  inkLight:   '#64748B', // captions, muted
  inkFaint:   '#94A3B8', // placeholder, disabled

  // Journal / minimal-calendar redesign — neutral warm-black text (the rest
  // of the app's "ink" family leans navy/slate, which reads too blue next
  // to this screen's reference image) + single warm terracotta accent.
  charcoal:   '#2B2A28',
  rust:       '#B5651D',
  rustLight:  '#E8C9A8',

  // Illustration accents
  moonGold:   '#FED330',
  starWhite:  '#FFFFFF',
  hillGreen:  '#7A9E7A',
  hillDark:   '#5A7A5A',
  treeTrunk:  '#8B6040',
  skyBlue:    '#9BE0FC', // cool accent (ref 2)

  // Semantic
  error:      '#F87171',
  errorLight: '#FEE2E2',
  success:    '#22C55E',
  successLight: '#DCFCE7',

  // Utility
  border:     '#E2E8F0',
  borderLight:'#F1F5F9',
  white:      '#FFFFFF',
  black:      '#000000',
  transparent:'transparent',
};

// Font families loaded via @expo-google-fonts/* in app/_layout.tsx — the
// string values match each package's exported constant name exactly, so
// no import is needed at usage sites.
export const fonts = {
  cozy:       'Quicksand_700Bold',    // headings, buttons — the design's rounded "cozy" voice
  cozyMedium: 'Quicksand_600SemiBold',
  jp:         'KosugiMaru_400Regular', // Japanese word display
  mono:       'JetBrainsMono_500Medium', // romaji, stats, technical labels
  monoBold:   'JetBrainsMono_700Bold', // minimal-calendar month heading
};

export const typography = {
  display:  { fontSize: 40, fontFamily: fonts.cozy, letterSpacing: -1, color: colors.inkDark },
  h1:       { fontSize: 28, fontFamily: fonts.cozy, letterSpacing: -0.5, color: colors.inkDark },
  h2:       { fontSize: 22, fontFamily: fonts.cozy, color: colors.inkDark },
  h3:       { fontSize: 18, fontFamily: fonts.cozy, color: colors.inkDark },
  body:     { fontSize: 15, fontWeight: '400' as const, color: colors.inkMid, lineHeight: 22 },
  bodyBold: { fontSize: 15, fontWeight: '600' as const, color: colors.inkMid },
  caption:  { fontSize: 12, fontWeight: '500' as const, color: colors.inkLight },
  tiny:     { fontSize: 10, fontWeight: '600' as const, color: colors.inkFaint },
  label:    { fontSize: 13, fontWeight: '700' as const, color: colors.inkMid, letterSpacing: 0.3 },
};

export const shadows = {
  card: {
    shadowColor: colors.inkDark,
    shadowOpacity: 0.10,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  cardWarm: {
    shadowColor: colors.terra,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  button: {
    shadowColor: colors.terraDark,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  tab: {
    shadowColor: colors.inkDark,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
};

export const radii = {
  xs:  6,
  sm:  10,
  md:  16,
  lg:  22,
  xl:  30,
  full: 999,
};

export const spacing = {
  xs:  4,
  sm:  8,
  ms:  12, // the "12px" rung — used constantly for section-header gaps, between sm and md
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};

// Chip/pill shared styles
export const chipBase = {
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm - 2,
  borderRadius: radii.full,
  borderWidth: 1.5,
};
