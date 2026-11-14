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
  terraLight: '#F2DCDC', // disabled / muted CTA, secondary-button fill (terraTint)
  terraTintPressed: '#EBCFCF', // pressed secondary
  sand2:      '#EFE3CC', // skeleton pulse peak, pressed sand
  sage:       '#D9B87C', // warm sand — badges, accents
  sageDark:   '#A9803E',
  sageLight:  '#F6EEDD',

  // Text — the whole ink family is warm now. Headings are the rose-brown
  // sampled off the mockup's section titles; body stays a warm near-black
  // so long paragraphs don't read as tinted.
  inkDark:    '#833F46', // rose-brown — headings
  inkMid:     '#4A4340', // warm charcoal — body text
  inkLight:   '#7E5559', // muted rose — captions, placeholders (5.76 on cream, 6.30 on white)
  inkFaint:   '#C4A9AB', // disabled and decoration ONLY — never text (2.0:1)

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

  // Semantic (contrast-fixed, C-look 1). The *Deep* pair are darkened from their base for the one job
  // the base can't do: carrying white text at body size. White on #C4565B is
  // ~3.9:1 and on #6E9E72 ~3.1:1, both short of WCAG AA's 4.5 for text under
  // 18.66pt bold — these clear it. Use the base for borders and icons, the
  // Deep one whenever white sits on top (the study card's grading row).
  error:      '#A8434A', // was #C4565B; text-safe (4.7 to 5.9)
  errorLight: '#F7E0E1',
  errorDeep:  '#A8434A',
  success:    '#3F6E46', // was #6E9E72; text-safe, and the Good fill (white on it 5.95)
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
  divider:    '#F0E6DC', // row dividers inside cards
  scrim:      'rgba(51, 41, 42, 0.42)', // sheet and modal backdrop
  grabber:    '#E3D3C8',
  errorOnDark: '#F2A5A8', // error icon on the charcoal toast (7.2)
  borderLight:'#F4EBE2',
  white:      '#FFFFFF',
  black:      '#000000',
  transparent:'transparent',
};

// Font families loaded via @expo-google-fonts/* in app/_layout.tsx — the
// string values match each package's exported constant name exactly, so
// no import is needed at usage sites.
//
// FIVE ROLES, and every piece of text in the app is exactly one of them.
// Before this there were 276 type declarations, 23 distinct font sizes, and
// nine different ways of setting the one thing the app exists to show — a
// vocabulary word. Worse, 198 of those 276 named no family at all, so the
// moment you left the study card the app was set in the iOS system sans and
// read like a settings screen rather than a keepsake.
//
//   word     the headword and the target-language sentence. Latin gets
//            `display`; Japanese and Cantonese get a system face. This one
//            is a function, not a constant — see wordFontFor below.
//   display  screen titles, card headings, buttons, big counts.
//   text     reading copy — meanings, translations, notes, hints, empty
//            states, inputs. THIS is the role that did not exist.
//   label    JetBrains Mono, uppercase and letterspaced. The index-card voice.
//   data     JetBrains Mono again — readings, dates, counts, intervals.
//
// Newsreader replaces Fraunces for both Latin roles. Fraunces is a *display*
// face whose quirks are drawn to work against continuous reading, and it was
// being asked to set a 19px sentence; Newsreader was drawn by Production Type
// for continuous on-screen reading, which is what this card actually asks
// for. Two static weights, 229 KB measured — against 3.57 MB for the Japanese
// face this replaces. Verified by parsing each .ttf's cmap: Newsreader covers
// 34/34 of the French accent set and 8/8 of the typographic punctuation.
export const fonts = {
  display:  'Newsreader_500Medium',    // titles, headings, buttons, headwords
  text:     'Newsreader_400Regular',   // reading copy — the role that was missing
  mono:     'JetBrainsMono_500Medium', // romanization, stats, technical labels
  monoBold: 'JetBrainsMono_700Bold',   // uppercase section labels, badges
};

// ---------------------------------------------------------------------------
// The face target-language text (headwords, example sentences) is set in.
//
// One matched handwritten family across all three languages, so the learner's
// language reads as "yours" against the Newsreader interface: Klee One
// SemiBold for French and Japanese, Iansui for Cantonese. Iansui is Klee One
// extended for Traditional Chinese, so the two sit together.
//
// Coverage was measured with fontTools, and it is why yue must never fall back
// to Klee One: Klee One has all 21 French and 26 Japanese test characters but
// only 4 of 27 Cantonese-only ones (嘅咗佢冇啲嚟...). Iansui has 27/27. Each
// language keeps its own glyph shapes (Japanese kanji from the Japanese font,
// Cantonese from the Chinese one). Bundled on every platform, so there is no
// Platform check and no system-face lookup. Cost: about 15 MB of fonts.
//
// Romanisation (jyutping, furigana, IPA) is not target-language prose and
// stays in the UI roles above.
export const learningFonts = {
  klee:    'KleeOne_600SemiBold', // fr, ja
  iansui:  'Iansui_400Regular',   // yue (single weight)
};

/** The headword: Iansui for Cantonese, Klee One for French and Japanese. */
export function wordFontFor(language: string): string {
  return language === 'yue' ? learningFonts.iansui : learningFonts.klee;
}

/** Target-language sentences: the same matched face as the headword. */
export function sentenceFontFor(language: string): string {
  return wordFontFor(language);
}

// The scale. Note there is no `fontWeight` anywhere below, and there should
// not be one at any call site either: these are *named faces*, and asking iOS
// for a weight a named face does not have gets you a synthesised faux-bold —
// a smeared outline rather than a drawn one. Weight is chosen by picking
// `display` or `text`, not by asking for a number.
export const typography = {
  display:  { fontSize: 40, fontFamily: fonts.display, letterSpacing: -1, color: colors.inkDark },
  h1:       { fontSize: 28, fontFamily: fonts.display, letterSpacing: -0.5, color: colors.inkDark },
  h2:       { fontSize: 22, fontFamily: fonts.display, color: colors.inkDark },
  h3:       { fontSize: 18, fontFamily: fonts.display, color: colors.inkDark },
  body:     { fontSize: 15, fontFamily: fonts.text, color: colors.inkMid, lineHeight: 22 },
  bodyBold: { fontSize: 15, fontFamily: fonts.display, color: colors.inkMid },
  caption:  { fontSize: 12, fontFamily: fonts.text, color: colors.inkLight },
  tiny:     { fontSize: 12, fontFamily: fonts.mono, color: colors.inkLight }, // min size 12; faint is not a text colour
  label:    { fontSize: 13, fontFamily: fonts.monoBold, color: colors.inkMid, letterSpacing: 0.3 },
};

// Two rose-tinted elevation steps (C-look 1). Cards have no border; they sit on
// cream with e1. e2 is for things that float: tab pill, due pill, sheets, toast.
export const e1 = {
  shadowColor: '#833F46',
  shadowOpacity: 0.09,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
};
export const e2 = {
  shadowColor: '#662B31',
  shadowOpacity: 0.20,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 10 },
  elevation: 8,
};
/** Soft contact shadow under a cutout, on a sand well or the cream page. */
export const stickerShadow = {
  shadowColor: '#662B31',
  shadowOpacity: 0.22,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 3 },
};

/** The Home sticker wall field (SPEC "Sticker wall"): radial cream, or a photo under these washes. */
export const wall = {
  fieldStops: ['#FCF8F0', '#F6EEDD', '#EEE1C9'] as const,
  creamWash: 'rgba(250, 244, 234, 0.38)',
  roseScrim: 'rgba(102, 43, 49, 0.22)',
  contact: 'rgba(102, 43, 49, 0.20)',
  chip: 'rgba(255, 251, 244, 0.82)',
  chipRing: 'rgba(149, 117, 121, 0.28)',
  shadowTop: 'rgba(255, 255, 255, 0.7)',
};

// Legacy names, now aliases of the two steps so every screen picks them up.
export const shadows = {
  card: e1,
  cardWarm: e1,
  button: e2,
  tab: e2,
};

export const radii = {
  xs:  6,
  sm:  10,
  md:  16,
  lg:  24, // study card, big cards, sheet tops
  xl:  30,
  full: 999,
};

// C-look scale: 4, 8, 12, 16, 20, 24, 32, 48.
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32, 8: 48 } as const;
/** Screen gutter. */
export const GUTTER = 20;

// Legacy names, kept so existing screens keep working.
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

// ---------------------------------------------------------------------------
// The role scale (C-look 2): eight sizes, 40 30 22 17 16 14 13 12. Spread a
// role into a style and pass `maxFontSizeMultiplier` to <Text>; use <T/> style
// helpers in later phases. `headword` is a function because its face depends on
// the language. Mono is for numerals, IPA and romanisation, plus at most one
// uppercase overline per screen.
export const type = {
  headword: { fontSize: 40, lineHeight: 46, letterSpacing: -0.4, color: colors.inkDark, maxFontSizeMultiplier: 1.3 },
  title:    { fontSize: 30, lineHeight: 34, letterSpacing: -0.6, fontFamily: fonts.display, color: colors.inkDark, maxFontSizeMultiplier: 1.3 },
  h2:       { fontSize: 22, lineHeight: 28, fontFamily: fonts.display, color: colors.inkDark, maxFontSizeMultiplier: 1.5 },
  button:   { fontSize: 17, lineHeight: 22, fontFamily: fonts.display, color: colors.inkDark, maxFontSizeMultiplier: 1.5 },
  body:     { fontSize: 16, lineHeight: 24, fontFamily: fonts.text, color: colors.inkMid, maxFontSizeMultiplier: 2.0 },
  small:    { fontSize: 14, lineHeight: 20, fontFamily: fonts.text, color: colors.inkLight, maxFontSizeMultiplier: 2.0 },
  data:     { fontSize: 13, lineHeight: 16, fontFamily: fonts.mono, color: colors.inkMid, maxFontSizeMultiplier: 1.3 },
  micro:    { fontSize: 12, lineHeight: 16, fontFamily: fonts.display, color: colors.inkLight, maxFontSizeMultiplier: 1.15 },
  overline: { fontSize: 12, lineHeight: 16, fontFamily: fonts.mono, color: colors.inkLight, letterSpacing: 0.96, textTransform: 'uppercase' as const, maxFontSizeMultiplier: 1.15 },
} as const;

/** Headword style for a language: learning face, +2 line-height for CJK (Iansui sits low and wide). */
export function headwordStyle(language: string, size = 40) {
  const cjk = language !== 'fr';
  return {
    fontFamily: wordFontFor(language),
    fontSize: size,
    lineHeight: Math.round(size * 1.15) + (cjk ? 2 : 0),
    letterSpacing: -0.4,
    color: colors.inkDark,
  };
}

// Motion constants live in lib/motion.ts; the press scale lives here so
// primitives and screens agree.
export const PRESS_SCALE = 0.98;
export const MIN_TAP = 44;
