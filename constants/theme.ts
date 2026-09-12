import { Platform } from 'react-native';

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

  // Semantic. The *Deep* pair are darkened from their base for the one job
  // the base can't do: carrying white text at body size. White on #C4565B is
  // ~3.9:1 and on #6E9E72 ~3.1:1, both short of WCAG AA's 4.5 for text under
  // 18.66pt bold — these clear it. Use the base for borders and icons, the
  // Deep one whenever white sits on top (the study card's grading row).
  error:      '#C4565B',
  errorLight: '#F7E0E1',
  errorDeep:  '#A8434A',
  success:    '#6E9E72',
  successLight: '#E2EFE3',
  successDeep:  '#4C7A52',

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
// The face a headword is set in, which depends on the language it is in.
//
// There used to be one `fonts.jp` — Kosugi Maru — applied to every headword in
// every language. Kosugi Maru is a *Japanese* font: 7,525 codepoints, and
// parsing its cmap directly says it covers 0 of 19 common French accented
// characters and is missing 哋嘅咗嚟啲喺冇 (the particles that make written
// Cantonese Cantonese) along with 咖啡 and 貓. Japanese was 15/15, which is why
// this went unnoticed — and French is the DEFAULT language for a new account,
// so the default experience was a headword rendered half in the Latin serif
// and half
// in whatever the OS substituted per missing glyph.
//
// Bundling real CJK instead is not the answer: a single Noto Sans HK weight is
// ~8 MB against ~116 KB for a Latin one. The system already ships both faces,
// correctly hinted, so name them and delete the 3.57 MB download.
//
//   fr  → Newsreader, verified 34/34 on the French accent set by parsing
//         its cmap directly
//   ja  → Hiragino Sans, the iOS system Japanese face
//   yue → PingFang HK, which matters beyond coverage: it carries Hong Kong
//         glyph forms rather than the mainland or Japanese variants of the
//         same codepoints, so 骨 and 直 look the way a Hong Kong reader
//         expects them to.
//
// Android returns undefined on purpose. There is no PingFang there, and naming
// a font the platform does not have gets you the default face with no CJK
// fallback at all — whereas letting it choose gets Noto CJK, which ships with
// the OS. Undefined is the better answer, not the absent one.
function cjkFaceFor(language: string): string | undefined {
  if (Platform.OS !== 'ios') return undefined;
  return language === 'yue' ? 'PingFang HK' : 'Hiragino Sans';
}

/** The headword: the display cut for Latin, the system face for CJK. */
export function wordFontFor(language: string): string | undefined {
  return language === 'fr' ? fonts.display : cjkFaceFor(language);
}

/**
 * Target-language *sentences*, which want the text cut rather than the
 * display one — a 19px sentence is reading, not a headline. Same system face
 * as the headword for CJK, which have no separate text cut to switch to.
 */
export function sentenceFontFor(language: string): string | undefined {
  return language === 'fr' ? fonts.text : cjkFaceFor(language);
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
  tiny:     { fontSize: 10, fontFamily: fonts.mono, color: colors.inkFaint },
  label:    { fontSize: 13, fontFamily: fonts.monoBold, color: colors.inkMid, letterSpacing: 0.3 },
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
