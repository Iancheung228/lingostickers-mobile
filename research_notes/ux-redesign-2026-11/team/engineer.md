# Engineer: feasibility and build plan (Expo SDK 54)

## Measured baseline
- 69 .tsx files in app/ + components/; 64 use StyleSheet.create; 66 import constants/theme. Tokens are already the habit.
- Only 29 `#RRGGBB` literals outside theme.ts (theme.ts has 42): colour is mostly centralised. **316 `fontSize` literals** and 19 files hit `expo-haptics` are the real drift. Biggest offenders: StudyCard (27), profile (19), FieldEditor, DiscoveryReveal, ChallengeScreen, sign-up (11 each).
- Tokens are *flat and light-only* (`colors.sky`, `terra`, `inkMid`...): names describe the Rose palette, not roles. No ThemeProvider, 0 `useColorScheme` uses. `userInterfaceStyle: "light"` in app.json.
- Installed: reanimated 4.1 + worklets, gesture-handler 2.28, expo-haptics, lucide-react-native, expo-image, svg. **Not installed:** expo-blur, expo-symbols, zeego, @react-native-menu/menu. Tabs use JS `Tabs` with a custom floating pill (`app/(tabs)/_layout.tsx`, 209 lines) and a bespoke `BottomSheet.tsx` (179 lines).
- Fonts: Newsreader + JetBrains Mono from @expo-google-fonts (JS-bundled). Klee One / Iansui are not in the repo yet (no assets/fonts dir, no references).

## (a) Cheapest robust architecture
Do **not** rewrite screens. Layer it:
1. `constants/tokens.ts`: semantic roles (`bg.page, bg.raised, bg.sunken, text.primary/secondary/muted, accent.fill/ink, border, danger, success, scrim`) with `light` and `dark` objects, plus `elevation[0..2]` (shadow tint per theme; in dark use border + lighter surface, not shadows), `space` (4/8/12/16/24/32), `radii`, and a `type` scale (about 7 steps: caption 12, label 13, body 16, bodyL 18, title 22, hero 32, headword 40).
2. **Keep the old `colors` export as an alias** computed from the light theme so unconverted screens still compile. Rose-to-Powder is then a one-file edit.
3. `ThemeProvider` in `app/_layout.tsx` (lesson #1: Context, mounted once) with `useTheme()` returning `{ c, dark }`. Follow system via `useColorScheme`, with an optional Profile override stored in AsyncStorage.
4. Primitives in `components/ui/`: `Text` (variant prop maps to family/size/lineHeight/tracking), `Button` (primary/secondary/ghost/destructive, one pressed state, haptic built in, min 44pt), `Card`, `Chip`, `ListRow`, `EmptyState`, `Screen` (page bg + header), `Sheet` (wrapper around existing BottomSheet so lesson #8 guard logic is untouched).
5. Migrate by lint-enforced rule: a grep script in CI that fails on new `fontSize:` and `#hex` outside tokens. Convert screen by screen, highest traffic first. Cost: roughly 3 to 4 focused days for the layer plus primitives, then about half a day per screen.

## (b) Dark mode cost
- `userInterfaceStyle` is **native config** (Info.plist `UIUserInterfaceStyle`). Changing it to `"automatic"` needs a rebuild, and it also changes the fingerprint runtimeVersion, so OTA to the 1.0.0 build is impossible for it. Until a rebuild, RN `useColorScheme()` returns light.
- Everything else (tokens, provider, in-app manual override) is JS. A manual in-app toggle works without the flag, but the status bar, keyboard, alerts and system sheets stay light: half-dark looks worse than none. **Recommend: bundle the plist flip into the one rebuild that also adds native pieces.**
- Also native: splash `backgroundColor` and android adaptive icon are fixed `#FAF4EA` (splash plugin supports a `dark` block, rebuild only).
- Artwork risk: illustrations (moon/hills/Cozy/Cork backgrounds), cutout stickers with white borders, and `rgba(250,244,234,.88)` overlays need dark variants. That is the true cost, not tokens.

## (c) Native vs JS-only
| Idea | SDK 54 | Needs rebuild? |
|---|---|---|
| Tokens, theme, primitives, Reanimated motion, gestures, haptics (already in) | yes | **JS-only** |
| Swipe rows (RNGH Swipeable / Reanimated), review-card swipe-to-grade | yes, installed | JS-only |
| expo-blur | `expo-blur ~15` | **Native**: new module, not in current binary. Cheap, widely used, put it in the rebuild |
| expo-symbols (SF Symbols) | works, iOS only | **Native** module. Lucide already covers needs; skip unless the owner wants Apple-native look |
| `expo-router/unstable-native-tabs` | exists in SDK 54, flagged unstable | Uses UITabBarController: iOS 26 liquid glass for free, but **loses the custom raised Scan pill** and has limited styling. Rebuild needed to be sure of the look. High risk, not recommended for v1 |
| Context menus (long-press) | `@react-native-menu/menu` / zeego (wraps it, needs the `zeego` + `react-native-ios-context-menu`/menu native pieces) | **Native**. Alternative JS-only: the existing BottomSheet as an action sheet, or a Reanimated popover |
| Dark mode flag | | **Native** (see b) |
| New fonts (Klee One, Iansui) via expo-font + require() | | JS-only if bundled as assets via `useFonts` (OTA can ship assets; fingerprint changes only if config plugin used) |
Bottom line: one batched rebuild (plist `automatic` + expo-blur + optional menu) buys everything; everything else ships OTA. Ask the owner first (15/month cap; no `eas build` without yes).

## (d) Risks
- **Maestro strings** (all in `.maestro/sign-in.yaml`, `study-grade.yaml`): 'WELCOME BACK' is uppercase *text*, so if the redesign drops the `textTransform`/literal uppercase label this breaks; keep the source string literal. 'FOUND', 'Start reviewing — 1 card due.*', 'Tap to reveal.*', the em-dash grade labels ('Good — next review in.*') and 'Close this card' (an accessibilityLabel) are the fragile ones. Dark-mode labelling must not change them. Don't rename accessibility labels on tabs ('Collection', 'Scan a new sticker').
- **Performance:** 67 ScrollView/FlatList uses, and no FlashList. Collection grid with `CutoutSticker` + thumbnails (lesson #17: `listImagePath`, cacheKey) is the hot list. Shadows on every cell (layered depth 2+) cost on iOS: use a single `shadowOpacity` layer plus `shouldRasterizeIOS` or flat borders on grid cells. Blur on scrolling lists is expensive; limit it to the tab bar/header. Reanimated list entering animations on 100+ items: avoid.
- **Fonts:** Klee One + Iansui are ~15 MB. As OTA assets they inflate the update and the first launch if loaded eagerly. Load per language only (`useFonts` keyed to the active language, French/Japanese Klee, Cantonese Iansui), keep the splash until the *chrome* font is ready, and subset Iansui (Traditional Chinese common set) with pyftsubset, which should cut it roughly 70%. Verify glyph coverage again after subsetting.
- Lesson #8 (sheet guard), #9 (hitSlop `gap >= slop`) and #10 apply to any Button/Sheet primitive.

## (e) Phased order (shippable after each)
0. Fix staging backend (below), take baseline screenshots in dark and light.
1. **Foundation, JS-only:** tokens + alias, ThemeProvider (light only), `Text`/`Button` primitives; no visual change except type scale. Run `harness/qa.sh`.
2. **Chrome:** tab bar, headers, `Screen`, `Card`, `ListRow`, `EmptyState` on Collection and Boards. Haptics map (selection, success, warning) centralised in one `haptics.ts`.
3. **Study + card detail** (highest value, Maestro-guarded): grade buttons, card, summary; keep strings.
4. **Calendar, Scan flow, Profile, auth/onboarding.**
5. **Language fonts** via per-language lazy load; subset first.
6. **Rebuild batch (owner's yes):** `userInterfaceStyle: automatic`, splash dark, expo-blur; then enable dark values and the Profile toggle. Ship build + OTA.
7. Cleanup: delete aliases, enable the lint rule.

## Staging AI backend: "Something went wrong on our side"
That exact string is `LlmError.userMessage` for kind `auth` or `invalid` (`supabase/functions/_shared/llm/types.ts:125`). `gemini.ts:130` throws `auth` when `GEMINI_API_KEY` is empty. I ran `supabase secrets list` on the staging ref (names only): it holds **only** `DAILY_LIMIT_OVERRIDES` plus Supabase's own keys. There is **no `GEMINI_API_KEY`** (nor `GEMINI_MODEL`, etc.). RELEASING.md line 41 says each project needs its own key. So this is a missing secret, not a code bug: functions deploy fine (`.run/deployed-staging` is at e83cbc8) but cannot call the LLM. Fix, owner's call: `npx supabase secrets set --project-ref ecqmbmbieajufyvlvwbz GEMINI_API_KEY=<key>` (a separate or free key is fine; watch the 100 calls/day QA budget). I did not deploy or set anything. Production is unaffected (key is set there per memory).

## Disagreements expected
Designers will want blur, native tabs and context menus; I'd hold those to the one rebuild and keep the custom tab bar. Dark mode is wanted by the brief but is the most expensive item; I'd gate it on illustration variants.
