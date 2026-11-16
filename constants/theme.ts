// The palettes live in constants/palettes.ts (light + dark). There is NO static
// `colors` export on purpose: a module-level StyleSheet bakes one theme in for
// good. Read the live theme with `useTheme()` and build styles with
// `useThemedStyles(({ colors }) => StyleSheet.create({...}))`
// (contexts/ThemeContext.tsx). Everything colour-bearing below is a function of
// the palette; `makeTheme` bundles them for the provider.
import { lightColors, darkColors, type Palette } from './palettes';
export type Scheme = 'light' | 'dark';
export { lightColors, darkColors, type Palette };

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
export const makeTypography = (colors: Palette) => ({
  display:  { fontSize: 40, fontFamily: fonts.display, letterSpacing: -1, color: colors.inkDark },
  h1:       { fontSize: 28, fontFamily: fonts.display, letterSpacing: -0.5, color: colors.inkDark },
  h2:       { fontSize: 22, fontFamily: fonts.display, color: colors.inkDark },
  h3:       { fontSize: 18, fontFamily: fonts.display, color: colors.inkDark },
  body:     { fontSize: 15, fontFamily: fonts.text, color: colors.inkMid, lineHeight: 22 },
  bodyBold: { fontSize: 15, fontFamily: fonts.display, color: colors.inkMid },
  caption:  { fontSize: 12, fontFamily: fonts.text, color: colors.inkLight },
  tiny:     { fontSize: 12, fontFamily: fonts.mono, color: colors.inkLight }, // min size 12; faint is not a text colour
  label:    { fontSize: 13, fontFamily: fonts.monoBold, color: colors.inkMid, letterSpacing: 0.3 },
});

// Two rose-tinted elevation steps (C-look 1). Cards have no border; they sit on
// cream with e1. e2 is for things that float: tab pill, due pill, sheets, toast.
export const makeElevation = (colors: Palette, scheme: Scheme) => {
  const e1 = {
    shadowColor: colors.shadow,
    shadowOpacity: 0.09,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  };
  const e2 = {
    shadowColor: colors.shadowDeep,
    shadowOpacity: 0.20,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  };
  /** Soft contact shadow under a cutout, on a sand well or the page. */
  const stickerShadow = {
    shadowColor: colors.shadowDeep,
    shadowOpacity: scheme === 'dark' ? 0.55 : 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  };
  return { e1, e2, stickerShadow, shadows: { card: e1, cardWarm: e1, button: e2, tab: e2 } };
};

/** The Home sticker wall field (SPEC "Sticker wall"): radial cream, or a photo under these washes. */
export const makeWall = (scheme: Scheme) => scheme === 'dark'
  ? {
      fieldStops: ['#36292D', '#2D2326', '#251C1F'] as const,
      creamWash: 'rgba(29, 22, 23, 0.45)',
      roseScrim: 'rgba(0, 0, 0, 0.30)',
      contact: 'rgba(0, 0, 0, 0.35)',
      chip: 'rgba(42, 33, 35, 0.86)',
      chipRing: 'rgba(201, 179, 180, 0.28)',
      shadowTop: 'rgba(255, 255, 255, 0.06)',
    }
  : {
      fieldStops: ['#FCF8F0', '#F6EEDD', '#EEE1C9'] as const,
      creamWash: 'rgba(250, 244, 234, 0.38)',
      roseScrim: 'rgba(102, 43, 49, 0.22)',
      contact: 'rgba(102, 43, 49, 0.20)',
      chip: 'rgba(255, 251, 244, 0.82)',
      chipRing: 'rgba(149, 117, 121, 0.28)',
      shadowTop: 'rgba(255, 255, 255, 0.7)',
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
export const makeType = (colors: Palette) => ({
  headword: { fontSize: 40, lineHeight: 46, letterSpacing: -0.4, color: colors.inkDark, maxFontSizeMultiplier: 1.3 },
  title:    { fontSize: 30, lineHeight: 34, letterSpacing: -0.6, fontFamily: fonts.display, color: colors.inkDark, maxFontSizeMultiplier: 1.3 },
  h2:       { fontSize: 22, lineHeight: 28, fontFamily: fonts.display, color: colors.inkDark, maxFontSizeMultiplier: 1.5 },
  button:   { fontSize: 17, lineHeight: 22, fontFamily: fonts.display, color: colors.inkDark, maxFontSizeMultiplier: 1.5 },
  body:     { fontSize: 16, lineHeight: 24, fontFamily: fonts.text, color: colors.inkMid, maxFontSizeMultiplier: 2.0 },
  small:    { fontSize: 14, lineHeight: 20, fontFamily: fonts.text, color: colors.inkLight, maxFontSizeMultiplier: 2.0 },
  data:     { fontSize: 13, lineHeight: 16, fontFamily: fonts.mono, color: colors.inkMid, maxFontSizeMultiplier: 1.3 },
  micro:    { fontSize: 12, lineHeight: 16, fontFamily: fonts.display, color: colors.inkLight, maxFontSizeMultiplier: 1.15 },
  overline: { fontSize: 12, lineHeight: 16, fontFamily: fonts.mono, color: colors.inkLight, letterSpacing: 0.96, textTransform: 'uppercase' as const, maxFontSizeMultiplier: 1.15 },
}) as const;

/** Headword style for a language: learning face, +2 line-height for CJK (Iansui sits low and wide). */
export const makeHeadwordStyle = (colors: Palette) => (language: string, size = 40) => {
  const cjk = language !== 'fr';
  return {
    fontFamily: wordFontFor(language),
    fontSize: size,
    lineHeight: Math.round(size * 1.15) + (cjk ? 2 : 0),
    letterSpacing: -0.4,
    color: colors.inkDark,
  };
};

// Motion constants live in lib/motion.ts; the press scale lives here so
// primitives and screens agree.
export const PRESS_SCALE = 0.98;
export const MIN_TAP = 44;

// ---------------------------------------------------------------------------
// The bundle the ThemeProvider hands out. One object per scheme, built once, so
// identity is stable and `useThemedStyles` can memoise on it.
export type Theme = {
  scheme: Scheme;
  isDark: boolean;
  colors: Palette;
  typography: ReturnType<typeof makeTypography>;
  type: ReturnType<typeof makeType>;
  e1: ReturnType<typeof makeElevation>['e1'];
  e2: ReturnType<typeof makeElevation>['e2'];
  stickerShadow: ReturnType<typeof makeElevation>['stickerShadow'];
  shadows: ReturnType<typeof makeElevation>['shadows'];
  wall: ReturnType<typeof makeWall>;
  headwordStyle: ReturnType<typeof makeHeadwordStyle>;
};

export function makeTheme(scheme: Scheme): Theme {
  const colors = scheme === 'dark' ? darkColors : lightColors;
  return {
    scheme,
    isDark: scheme === 'dark',
    colors,
    typography: makeTypography(colors),
    type: makeType(colors),
    ...makeElevation(colors, scheme),
    wall: makeWall(scheme),
    headwordStyle: makeHeadwordStyle(colors),
  };
}

export const lightTheme = makeTheme('light');
export const darkTheme = makeTheme('dark');
