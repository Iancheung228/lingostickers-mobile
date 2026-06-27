// Warm risograph / retro Japanese travel poster palette
export const colors = {
  // Backgrounds
  sky:        '#F5E6C8', // warm parchment — primary screen bg
  skyDeep:    '#E8C882', // amber gold — gradient bottom
  skyNight:   '#D4B896', // muted warm sand

  // UI surfaces
  card:       '#FFFBF0', // warm white — cards, inputs
  cardAlt:    '#FFF5DC', // slightly more amber — alt cards
  overlay:    'rgba(245, 230, 200, 0.88)', // semi-transparent sky for list screens

  // Brand / interactive
  terra:      '#C4956A', // terracotta — primary CTA
  terraDark:  '#A67550', // pressed state
  terraLight: '#DDB98A', // disabled / muted CTA
  sage:       '#8BAF8B', // sage green — active tabs, badges
  sageDark:   '#6A8F6A',
  sageLight:  '#B8D4B8',

  // Text
  inkDark:    '#2C1A0E', // deep warm brown — headings
  inkMid:     '#5C3D1E', // body text
  inkLight:   '#8B6914', // captions, muted
  inkFaint:   '#B8956A', // placeholder, disabled

  // Illustration accents
  moonGold:   '#F0C060',
  starWhite:  '#FFF8E8',
  hillGreen:  '#7A9E7A',
  hillDark:   '#5A7A5A',
  treeTrunk:  '#8B6040',
  skyBlue:    '#C8D8E8', // cool accent (ref 2)

  // Semantic
  error:      '#C4614A',
  errorLight: '#F5D5CC',
  success:    '#6A9A6A',
  successLight: '#D0E8D0',

  // Utility
  border:     '#DDD0B8',
  borderLight:'#EDE4D0',
  white:      '#FFFFFF',
  black:      '#000000',
  transparent:'transparent',
};

export const typography = {
  display:  { fontSize: 40, fontWeight: '800' as const, letterSpacing: -1, color: colors.inkDark },
  h1:       { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5, color: colors.inkDark },
  h2:       { fontSize: 22, fontWeight: '700' as const, color: colors.inkDark },
  h3:       { fontSize: 18, fontWeight: '700' as const, color: colors.inkDark },
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
