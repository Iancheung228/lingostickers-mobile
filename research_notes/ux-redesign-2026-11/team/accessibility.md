# Accessibility and colour science, round 1

Every number below comes from `scratchpad/contrast.py`, `fix.py`, `de.py` (WCAG 2.x relative luminance; CVD via Machado 2009 matrices, severity 1.0; ΔE76 in Lab). Scripts: /private/tmp/claude-502/-Users-school-lingostickers-mobile-lingostickers-mobile/e1224b8b-a07c-43b9-9011-aa91fd9cb6af/scratchpad/. Not yet verified on a device: Dynamic Type layout, VoiceOver traversal order.

## 1. Five biggest "vibe-coded" a11y tells
1. **Captions fail contrast on every surface.** `inkLight #A98A8C` = 2.86 on page, 3.13 on card (theme.ts:31, `typography.caption`/`tiny`); `inkFaint #C4A9AB` = 2.00 on page and is used as real text: profile.tsx:545 (9px stat labels), :554 (10px section labels), :590, :592, sign-in.tsx:171 (the eyebrow). See baseline/08a, 01a.
2. **Type is 9-11px in ~20 places** (profile.tsx:545/599, tabs/_layout.tsx:208, sign-in.tsx:171). Small, light and low-contrast together is the "unthoughtful" look.
3. **The grade ramp collapses for colour-blind users.** Again `#A8434A` vs Easy `#4C7A52` has ΔE 67 normally but **ΔE 6 under deuteranopia** (luminance 0.128 vs 0.161), i.e. near-identical (StudyCard.tsx:1594-1597, baseline/04b). Labels and intervals save it, but the colour that lessons.md #12 calls "the fastest signal" is lost for about 8% of men.
4. **Semantic colours can't carry text.** `error #C4565B` 3.97-4.35, `success #6E9E72` 2.8-3.1, `sageDark #A9803E` 3.1-3.6 on the surfaces they are used on. The Deep variants exist only for white-on-fill; any coloured text or caption uses the failing bases.
5. **Reduced motion is honoured in exactly one component** (StudyCard.tsx:452). The other ~42 reanimated/Animated sites (tab bar, sheets, scan) ignore it. Light-only is also hard-coded (`app.json` "userInterfaceStyle": "light"), and Dynamic Type is never capped or designed for (no `maxFontSizeMultiplier` anywhere; text scales by RN default, fixed-height chrome will clip).

## 2. Measured contrast (text 4.5, UI 3.0)
| Pair | Today | Rose (brief) | Powder (brief) |
|---|---|---|---|
| head on page / card | 6.94 / 7.60 | same | 10.01 / 10.39 |
| body on page / card | 8.85 / 9.69 | same | 11.05 / 11.47 |
| cap on page / card / sand / tint | 2.86 / 3.13 / 2.71 / 2.39 FAIL | 4.77 / 5.22 / 4.53 / **4.24 FAIL** | 5.21 / 5.40 / 4.91 / 4.62 |
| faint on page / card | 2.00 / 2.19 FAIL | 2.00 / 2.19 FAIL | 2.29 / 2.37 FAIL |
| link on tint | 4.44 FAIL | 4.72 | 8.88 |
| action label on action | white on #9D4D51 5.81 | 5.81 | **#24406B on #F2A27A 5.06** |
| action fill vs page (UI) | 5.31 | 5.31 | **1.98 FAIL** (vs card 2.05) |
| error text #C4565B on page/card | 3.97 / 4.35 FAIL | same FAIL | 4.19 / 4.35 FAIL |
| success text #6E9E72 on card | 3.09 FAIL | FAIL | FAIL |
| gold #A9803E on card/sand | 3.59 / 3.11 FAIL | FAIL | FAIL |
| card edge vs page | 1.09 | 1.09 | 1.04 |
| white on errorDeep / successDeep | 5.89 / 4.98 ok | | |
| white on peach | | | 2.05 (never use) |

Also today: header `#833F46` on rose band `#E4A0A1` 3.56 (large only; `maroon #662B31` 5.03 OK), white on band 2.13.

Rose needs 2 token edits for text (cap darkened, semantics). Powder needs the same semantic edits plus a non-colour solution for the peach button boundary (1.98). Card edges at 1.04-1.09 are decorative (cards are separated by shadow); fine under WCAG, but don't rely on them for inputs: **inputs and chips need a >=3:1 border** (Rose #8A6266-ish at 3:1, Powder #7B8BA8 ~3.3).

## 3. Corrected values (character kept)
Light (all text pairs verified >=4.5 on page, card, sand and tint):
| token | Rose | Powder |
|---|---|---|
| cap and faint (merge; no separate faint text) | #7E5559 | #52627C |
| err text | #A8434A | #A8434A |
| ok text | #3F6E46 | #3F6E46 |
| gold text | #7A5A1E | #7A5A1E |
| action / actionInk | #9D4D51 / #FFFFFF | #F2A27A / **#1B3359 (6.14)** |
| peach button boundary | n/a | 1.5px ring #C4602F (4.0 on page) or #B5532A (4.78); or drop the ring and rely on the label + shadow, which is a defensible WCAG 1.4.11 reading |
`faint` survives only for disabled states and decorative hairlines (exempt), never for text.

**Dark mode** (verified; every text pair >=4.5, action vs page >8):
| token | Rose dark | Powder dark |
|---|---|---|
| page / card / sand / tint | #1A1315 / #261B1E / #30232A / #3B262B | #0E1626 / #18233A / #202E4A / #3A2B2C |
| head / body / cap | #F3CDCF / #EFE6E3 / #C7A6A9 | #D3E3FF / #E6EBF5 / #9FAECA |
| link | #F0A9AC | #AECBFF |
| action / ink | #E8979B / #2A1115 | #F2A27A / #1B2336 |
| err / ok / gold text | #F08A8F / #8CC594 / #E0BB78 | same |
Elevation in dark mode = lighter surface, not shadow: card sits only 1.10-1.15:1 above page, so add a 1px inner top highlight (white 6-8%) and a border (white 8%), as the Midnight preset did. Shadows go to rgba(0,0,0,0.45). Switch `userInterfaceStyle` to "automatic" (this is a native config change: **needs a rebuild**; token work is JS-only/OTA).

## 4. Proposal
- **Grade ramp (colour-blind safe):** Again #8F2F3A or #A8434A (white 5.89-7.97) / Hard sand with ink / Good pale tint with ink (#CFE3F1) / **Easy a blue #2B6CB0 (white 5.42)**, not green. ΔE Again-Easy: normal 70, deuteranopia 66, protanopia 50 (green today: 6 and 17). Also add a glyph per button (arrow-counter, minus, check, double-check) so shape carries meaning. Keep the labels 'Again/Good/Easy — next review in...' (Maestro-safe). JS-only.
- **Dynamic Type:** RN scales text by default, so it already scales. Set `maxFontSizeMultiplier` 1.3 on chrome (tab bar, badges, chips) and 2.0 on reading text; replace fixed `height` on rows with `minHeight`; raise the minimum size to 12 (labels 11 only if semi-bold and 4.5:1). Test at AX3 on the Simulator. JS-only.
- **Tap targets:** icon buttons use `hitSlop` 6-10 (StudyCard.tsx:803-840, 1070, 1191-1217). Per lessons #9 slop is anisotropic and must not overlap, so make the visual control 44x44 on all top-bar icons and the speaker/record buttons instead of padding with slop. Grade buttons are fine (flex, paddingVertical 12 = ~56pt tall).
- **VoiceOver:** the study loop is already good (labels at StudyCard.tsx:805, 857, 924 speak the interval as a sentence). Gaps: tab-bar items, the Scan shutter, Collection search/sort, the sticker grid (label "word, meaning, due/new"), Calendar day cells ("14 November, 3 cards"), board sheets. Group the card front as one `accessible` element; announce grade results with `AccessibilityInfo.announceForAccessibility`. Set `accessibilityRole="header"` on screen titles. JS-only.
- **Reduced motion:** make one `useReducedMotion()` hook (reanimated's built-in is fine) and route all ~42 animation sites through it: swap slides/springs for 160ms fades, disable parallax and sticker wobble. JS-only.
- **CJK at small size:** Hiragino Sans / PingFang HK, and (per fixed decision) Klee One SemiBold / Iansui. Rules: headword >=28, sentence >=18, readings/furigana/jyutping >=13 (not 9-11); lineHeight >=1.5x; never apply letterSpacing or uppercase to CJK (the mono `label` role does); Klee One at 14 and below has fine strokes, so use SemiBold, body colour not cap, and keep Iansui >=16. Check the Klee One/Iansui cut at 12-13 on a device before signing off.
- **Meaning must not rely on colour alone:** due/new/learning badges, calendar dots and favourite state each get an icon or text.
- **Focus/contrast of inputs and chips:** border >=3:1 (above).

## 5. Rose or Powder
**Rose passes with fewer changes** (two text tokens plus semantic text colours; the white-on-rose action already passes at 5.81 with a 5.3-5.8 boundary). Powder's text system is stronger (head 10:1, cap 5.2 already passes), but its signature peach action is 1.98 against the page: it requires an ink-flip and a boundary treatment, and white labels are forbidden on it. From my seat I'd choose **Powder only if the team accepts the ring/ink rule**; otherwise Rose. Powder also takes dark mode more naturally (peach gains 8.8:1 on navy, and blue keeps luminance steps), while Rose's dark needs the rose desaturated to avoid a muddy brown cast.

## 6. Cut
Uppercase letter-spaced mono labels at 9-11px; the 'faint' text token; the separate Hard-as-white-ish tone with a gold border; per-screen shadow tints that fail to lift on dark.

## 7. Expected disagreements
- Visual/brand roles will want the peach filled with white or soft-lavender labels; I will block white on peach (2.05).
- Typography will want tiny tracked labels as the "quiet" voice; I want >=12 and 4.5:1.
- Motion/delight roles on 42 animation sites: reduced-motion must be a first-class path.
- Native rebuild cost of "automatic" appearance vs shipping light-only OTA first.
