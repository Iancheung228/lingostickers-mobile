// The two colour palettes. Pure data, no React Native imports, so
// scripts/check-contrast.mts can load it under plain Node.
//
// Token NAMES are the ones the whole app already used; light values are
// exactly what `colors` held before dark mode existed. Components never import
// these directly — they read the active one through `useTheme()` /
// `useThemedStyles()` (contexts/ThemeContext.tsx), which is what lets the
// Profile → Appearance switch repaint every mounted screen without a restart.
//
// Dark is the same brand at night, not an inversion: deep warm plum-brown
// grounds (never pure black, never blue-grey), the rose accent lifted for text
// and held at a fill that still carries white type, and the sticker wells kept
// lighter than the page so cut-outs sit on a surface rather than in a hole.
//
// Some tokens do two jobs that only coincide on a light page, so they are
// split. A rose that reads as a *button fill under white type* must be dark; a
// rose that reads as *text on a dark card* must be light. Hence the `*Ink`
// tokens: use `terra` for fills and borders, `terraInk` whenever the colour is
// a glyph or a word on a surface. In light mode each Ink equals its base.
export const lightColors = {
  // Backgrounds
  sky:        '#FAF4EA', // warm cream — primary screen bg
  skyDeep:    '#E4A0A1', // dusty rose — the header band and other feature panels
  skyNight:   '#D08E90', // deeper rose border

  // UI surfaces
  card:       '#FFFFFF', // white — cards, inputs
  cardAlt:    '#F6EEDD', // warm sand tint — thumbnails, alt cards
  raised:     '#FFFFFF', // the selected thumb of a segmented control (lighter than its track in both themes)
  overlay:    'rgba(250, 244, 234, 0.88)', // semi-transparent cream for list screens

  // Brand / interactive
  terra:      '#9D4D51', // deep rose — primary CTA (white text sits on this)
  terraInk:   '#9D4D51', // terra as text / icon on a surface (fills use terra)
  terraDark:  '#833F46', // pressed state
  terraLight: '#F2DCDC', // disabled / muted CTA, secondary-button fill (terraTint)
  terraTintPressed: '#EBCFCF', // pressed secondary
  sand2:      '#EFE3CC', // skeleton pulse peak, pressed sand
  sage:       '#D9B87C', // warm sand — badges, accents
  sageDark:   '#A9803E',
  sageInk:    '#A9803E', // sageDark as text / icon
  sageLight:  '#F6EEDD',

  // Text — the whole ink family is warm now. Headings are the rose-brown
  // sampled off the mockup's section titles; body stays a warm near-black
  // so long paragraphs don't read as tinted.
  inkDark:    '#833F46', // rose-brown — headings
  inkMid:     '#4A4340', // warm charcoal — body text
  inkLight:   '#7E5559', // muted rose — captions, placeholders (5.76 on cream, 6.30 on white)
  inkFaint:   '#C4A9AB', // disabled and decoration ONLY — never text (2.0:1)
  rule:       '#E6DBD0', // hairlines between calendar weeks (decoration only)
  bandTrack:  'rgba(102, 43, 49, 0.12)', // segmented-control track on the rose band (maroon at 12%)
  inkQuiet:   '#756E69', // neutral warm grey for secondary text where rose would add colour (4.6 on cream, 5.0 on white)

  // Journal / minimal-calendar redesign — neutral warm-black text + the
  // single accent, which is now the same deep rose as the rest of the app.
  charcoal:   '#33292A',
  rust:       '#9D4D51',
  rustLight:  '#E4B9B9',

  // Blush-redesign specifics — named for what they are in the mockup, for
  // the home screen's header band and its cards.
  blush:      '#E4A0A1', // the rose band / tab bar pill
  blushDeep:  '#9D4D51', // raised camera button, arrow circle
  blushDeepInk: '#9D4D51', // blushDeep as an icon on a surface
  maroon:     '#662B31', // text on the rose band, where inkDark is too light
  sand:       '#F6EEDD', // sticker-thumb wells, speaker buttons
  wellWhite:  '#F7F6F4', // Collection grid-cell well: off-white, just off the white card body
  cream:      '#FAF4EA', // page background
  creamDeep:  '#EFE4DA', // page background where it deepens toward the bottom

  // Illustration accents
  moonGold:   '#E8C48A',
  starWhite:  '#FFFFFF',
  hillGreen:  '#9DAE8C',
  hillDark:   '#7C8C6D',
  treeTrunk:  '#8B6040',
  skyBlue:    '#DCE6EC', // cool accent — the one non-rose sticker tint

  // Semantic (contrast-fixed, C-look 1). The *Deep* pair are darkened from their base for the one job
  // the base can't do: carrying white text at body size. White on #C4565B is
  // ~3.9:1 and on #6E9E72 ~3.1:1, both short of WCAG AA's 4.5 for text under
  // 18.66pt bold — these clear it. Use the base for borders and icons, the
  // Deep one whenever white sits on top (the study card's grading row).
  error:      '#A8434A', // was #C4565B; text-safe (4.7 to 5.9)
  errorInk:   '#A8434A', // error as text / icon on a surface
  errorLight: '#F7E0E1',
  errorDeep:  '#A8434A',
  success:    '#3F6E46', // was #6E9E72; text-safe, and the Good fill (white on it 5.95)
  successInk: '#3F6E46', // success as text / icon on a surface
  successLight: '#E2EFE3',
  successDeep:  '#3F6E46',
  gold:       '#7A5A1E', // Hard text, warnings (5.18)
  goldTint:   '#F5E7C6',
  againTint:  '#F6E3E1', // Again fill, 'Due' tag
  errorPressed: '#EFCFD0', // pressed destructive
  goldTintPressed: '#EFDDAF', // pressed Hard
  successPressed: '#325A38', // pressed Good (solid)
  successTintPressed: '#D2E5D4', // pressed Easy

  // Utility
  border:     '#EADFD6', // decorative edges only (1.2:1); controls use ctl
  ctl:        '#957579', // input, chip, secondary-outline borders (3.76 on cream, 4.12 on white)
  trackOff:   '#C9B8B4', // switch off-track fill: light and warm; the ring carries the contrast
  trackOffRing: '#8A5A60', // 1.5px ring around an OFF switch (>= 3:1 on card and cream)
  divider:    '#F0E6DC', // row dividers inside cards
  scrim:      'rgba(51, 41, 42, 0.42)', // sheet and modal backdrop
  photoBadge: 'rgba(51, 41, 42, 0.62)', // small badge over a photo thumbnail (white glyph)
  glass:      'rgba(255, 253, 244, 0.92)', // translucent panel over photos / the wall
  glassSolid: 'rgba(255, 255, 255, 0.92)',
  shadow:     '#833F46', // drop-shadow tints (plain black in dark, where a tint reads as a glow)
  shadowWarm: '#9D4D51',
  shadowBtn:  '#833F46',
  shadowDeep: '#662B31',
  grabber:    '#E3D3C8',
  errorOnDark: '#F2A5A8', // error icon on the charcoal toast (7.2)
  borderLight:'#F4EBE2',
  white:      '#FFFFFF',
  black:      '#000000',
  transparent:'transparent',
};

export type Palette = { [K in keyof typeof lightColors]: string };

export const darkColors: Palette = {
  sky:        '#1D1617',
  skyDeep:    '#5B2D34',
  skyNight:   '#7A3E46',

  card:       '#2A2123',
  cardAlt:    '#382C2F',
  raised:     '#54434A',
  overlay:    'rgba(29, 22, 23, 0.88)',

  terra:      '#A8545A',
  terraInk:   '#EBA6A8',
  terraDark:  '#8E4147',
  terraLight: '#4A2E32',
  terraTintPressed: '#5A383D',
  sand2:      '#443539',
  sage:       '#D9B87C',
  sageDark:   '#8F6A2F',
  sageInk:    '#E0C48F',
  sageLight:  '#382C2F',

  inkDark:    '#F3D6D6',
  inkMid:     '#E8DDD7',
  inkLight:   '#C9B3B4',
  inkFaint:   '#8A7578',
  rule:       '#3A2E31',
  bandTrack:  'rgba(0, 0, 0, 0.25)',
  inkQuiet:   '#B5AAA4',

  charcoal:   '#F1E6E0',
  rust:       '#EBA6A8',
  rustLight:  '#5A3A3E',

  blush:      '#7A3A42',
  blushDeep:  '#A8545A',
  blushDeepInk: '#EBA6A8',
  maroon:     '#F6DDDD',
  sand:       '#382C2F',
  wellWhite:  '#33292C',
  cream:      '#241C1E',
  creamDeep:  '#150F10',

  moonGold:   '#E8C48A',
  starWhite:  '#FFFFFF',
  hillGreen:  '#9DAE8C',
  hillDark:   '#7C8C6D',
  treeTrunk:  '#8B6040',
  skyBlue:    '#DCE6EC',

  error:      '#B04850',
  errorInk:   '#F29A9E',
  errorLight: '#412628',
  errorDeep:  '#B04850',
  success:    '#4C7A52',
  successInk: '#8FCB94',
  successLight: '#25352B',
  successDeep:  '#4C7A52',
  gold:       '#E3C27A',
  goldTint:   '#3E3320',
  againTint:  '#432629',
  errorPressed: '#5A3033',
  goldTintPressed: '#4F4128',
  successPressed: '#3E6644',
  successTintPressed: '#2F4535',

  border:     '#43363A',
  ctl:        '#9A8386',
  trackOff:   '#4A3C3F',
  trackOffRing: '#A89293',
  divider:    '#352A2D',
  scrim:      'rgba(0, 0, 0, 0.5)',
  photoBadge: 'rgba(0, 0, 0, 0.62)',
  glass:      'rgba(42, 33, 35, 0.92)',
  glassSolid: 'rgba(42, 33, 35, 0.92)',
  shadow:     '#000000',
  shadowWarm: '#000000',
  shadowBtn:  '#000000',
  shadowDeep: '#000000',
  grabber:    '#5A4A4E',
  errorOnDark: '#A8434A',
  borderLight:'#352A2D',
  white:      '#FFFFFF',
  black:      '#000000',
  transparent:'transparent',
};
