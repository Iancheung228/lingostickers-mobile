// Dusty-rose / warm-cream palette (blush redesign, Aug 2026). Every hex
// below is sampled from the reference mockup, so the token *names* are the
// ones the whole app already imports — only their values moved. That's
// deliberate: repainting the app is a palette edit, not 30 screen edits.
export const colors = {
  // Backgrounds
  sky:        '#FAF4EA', // warm cream — primary screen bg
  skyDeep:    '#E4A0A1', // dusty rose — the header band and other feature panels
  skyNight:   '#D08E90', // deeper rose border

  // UI surfaces
  card:       '#FFFFFF', // white — cards, inputs
  cardAlt:    '#F6EEDD', // warm sand tint — thumbnails, alt cards
  overlay:    'rgba(250, 244, 234, 0.88)', // semi-transparent cream for list screens

  // Brand / interactive
  terra:      '#9D4D51', // deep rose — primary CTA (white text sits on this)
  terraDark:  '#833F46', // pressed state
  terraLight: '#F2DCDC', // disabled / muted CTA
  sage:       '#D9B87C', // warm sand — badges, accents
  sageDark:   '#A9803E',
  sageLight:  '#F6EEDD',

  // Text — the whole ink family is warm now. Headings are the rose-brown
  // sampled off the mockup's section titles; body stays a warm near-black
  // so long paragraphs don't read as tinted.
  inkDark:    '#833F46', // rose-brown — headings
  inkMid:     '#4A4340', // warm charcoal — body text
  inkLight:   '#A98A8C', // muted rose — captions
  inkFaint:   '#C4A9AB', // placeholder, disabled

  // Journal / minimal-calendar redesign — neutral warm-black text + the
  // single accent, which is now the same deep rose as the rest of the app.
  charcoal:   '#33292A',
  rust:       '#9D4D51',
  rustLight:  '#E4B9B9',

  // Blush-redesign specifics — named for what they are in the mockup, for
  // the home screen's header band and its cards.
  blush:      '#E4A0A1', // the rose band / tab bar pill
  blushDeep:  '#9D4D51', // raised camera button, arrow circle
  maroon:     '#662B31', // text on the rose band, where inkDark is too light
  sand:       '#F6EEDD', // sticker-thumb wells, speaker buttons
  cream:      '#FAF4EA', // page background
  creamDeep:  '#EFE4DA', // page background where it deepens toward the bottom

  // Illustration accents
  moonGold:   '#E8C48A',
  starWhite:  '#FFFFFF',
  hillGreen:  '#9DAE8C',
  hillDark:   '#7C8C6D',
  treeTrunk:  '#8B6040',
  skyBlue:    '#DCE6EC', // cool accent — the one non-rose sticker tint

  // Semantic
  error:      '#C4565B',
  errorLight: '#F7E0E1',
  success:    '#6E9E72',
  successLight: '#E2EFE3',

  // Utility
  border:     '#EADFD6',
  borderLight:'#F4EBE2',
  white:      '#FFFFFF',
  black:      '#000000',
  transparent:'transparent',
};

// Font families loaded via @expo-google-fonts/* in app/_layout.tsx — the
// string values match each package's exported constant name exactly, so
// no import is needed at usage sites.
export const fonts = {
  cozy:       'Fraunces_700Bold',    // headings, buttons — warm serif display voice
  cozyMedium: 'Fraunces_600SemiBold',
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
