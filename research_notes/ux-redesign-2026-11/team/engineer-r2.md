# Engineer, round 2

**Figtree correction: confirmed JS-only.** `app/_layout.tsx:65` loads fonts at runtime with `useFonts({...})` from per-weight `@expo-google-fonts/*` imports; app.json's `expo-font` plugin has no font list, so nothing is embedded natively. Figtree is `npm i @expo-google-fonts/figtree` plus four weights in that call. The designer's "may need a native build" is wrong. Caveat: it adds ttf assets to the OTA bundle (about 100-200 KB), and the IPA/glyph check is still needed.

## Disputed options, costed
| Option | Type | Effort |
|---|---|---|
| Figtree, drop Newsreader/JetBrains Mono | JS-only | 0.5 day (provider + Text variants); screen sweep rides the primitives |
| Powder or Rose token swap | JS-only | 0.5 day; one file |
| Dark mode values/toggle | JS; system-follow needs plist flip = **rebuild** | 2-3 days incl. illustrations |
| Labelled full-width tab bar | JS-only | 1 day (rewrite `_layout.tsx`, 209 lines) |
| Scan as full-screen modal, raised button | JS-only (expo-router `fullScreenModal`) | 1-1.5 days; keeps camera permission flow, re-test |
| Profile as formSheet with detents | JS-only (screens 4.16), verify on device | 0.5 day |
| Shared `ScreenHeader` + avatar | JS-only | 1 day |
| Swipe grading (RNGH + Reanimated) | JS-only | 1.5 days |
| Undo last grade | JS-only, `lib/review.ts` + `test-review.mts` | 1 day |
| Forecast chart (react-native-svg installed) | JS-only | 1.5 days; data already local |
| Shared-element sticker zoom | JS, risky on reanimated 4.1 | 2+ days; drop first |
| expo-blur header/tab | **rebuild** | 0.5 day; skip, not needed |
| Context menus / native tabs / SF Symbols | **rebuild** | skip; BottomSheet/popover and lucide suffice |

## Positions
1. **Colour: Powder, and blue Easy is out.** Rose vs Powder costs the same in code, so decide on design. Against the learning role: Hard/Again need not look like peach, since the ramp lives on the grade row only (red, amber, pale green, deep green) and the action colour appears elsewhere; the clash is one screen and is managed. Against the accessibility role's blue Easy: in Powder, blue is the chrome (head, focus, selection), so a blue Easy reads as "selected", which breaks lesson 12's "no brand colour in the ramp". Fix colour-blindness with a second channel instead: icons or glyphs (x, dot, check, double check) plus the interval text, which is already there. Keep green Easy, and have the script check lightness separation.
2. **Grading: 4 buttons, Hard/Easy secondary, plus swipe (left Again, right Good), behind a Profile setting.** One design serves both: casual users lean on swipe and the big Again/Good, serious users get four intervals. A 2-button mode costs nothing extra (hide two buttons) but I would not ship it v1: three modes means three QA matrices.
3. **Home order:** header (title, avatar), Due card ("N due, Start", hidden when 0 and replaced by "Next due in..."), chips, sticker grid. A small stickers strip is cheap (existing `LatestStickers`), but the full wall hero should move to Boards. Cost is the same in code either way; the question is owner preference.
4. **Calendar: one screen can do both, only if the month cell is a sticker thumbnail and the forecast is a 14-day bar above it.** If the forecast slips, put it in Profile stats, not Home.
5. **Navigation:** no objection to a labelled bar, scan modal or avatar header. Objection: native tabs and blur stay out. The modal moves the `Scan a new sticker` label, so keep it as the button's accessibilityLabel (Maestro).
6. **Study card:** memory details (when/where) go behind one "Memory" row on the back, collapsed. Zero effect on review speed, and it is pure JS.

## Staging
Unchanged from round 1: `GEMINI_API_KEY` is missing on staging. Unfixed until the owner sets it.

**Single change that matters most:** ship the token and primitive layer first, so every screen shares one type scale, one header and one button.
