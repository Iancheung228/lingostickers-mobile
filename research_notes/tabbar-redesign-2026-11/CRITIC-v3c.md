# Critic final pass: Tabi Stickers tab bar (v3c)

Images only. I looked at v3-final, v3-final-states, v3-final-zoom, v3-scan-screen, v3-spacing, v3-badge, icons-v3/shots/final-3x and bar-3x-crop.

## Scores (v3b -> v3c)
| Criterion | Score |
|---|---|
| 1. Balance / symmetry | 8 -> 8 |
| 2. Brand fit | 7 -> 8 |
| 3. Craft / alignment | 7 -> 8 |
| 4. Active + centre clarity | 7 -> 8.5 |
| 5. Not template-generic | 6 -> 7 |
| 6. Overall | 7 -> 8 |

## N1-N6
- **N1 Collection glyph: fixed.** The bag/strap silhouette is gone. It is now two overlapping rounded cards with text lines, and the filled state is clean (v3-final-zoom.png, v3-badge.png). Caveat: it can read as "messages/copy" rather than "collection". That is a semantics quibble, not a craft fault.
- **N2 Label gaps: mostly fixed.** At the 1.15x cap the Collection/Calendar gap is comfortable (v3-spacing.png, pitch 66). At 1.3x, which is beyond the cap, the words are still about 3pt apart. Acceptable only because the cap is 1.15x, so make sure the cap is actually enforced.
- **N3 Inactive label contrast: fixed.** The labels are readable on the pill now.
- **N4 Calendar size: fixed.** It now matches the others in final-3x.png.
- **N5 Scan active vs shutter: fixed.** The inverted cream disc with a rose camera is unmistakable and clearly different from the rose shutter (v3-final.png phone 4, v3-final-zoom.png).
- **N6 Idle disc stroke: fixed.** There is a soft pale rim and the disc holds its edge over the busy photo grid and the dark camera frame.

## Active state without a bar
Clear. The filled glyph does the work and the darker label supports it. Collection is no longer the weak one, because its front card fills solid.

## New defects (all minor)
1. **Visible seam under the Scan-screen controls.** v3-scan-screen.png: a faint lighter rectangle ends about 12pt under "Gallery" and "Type a word", and it clips the shutter's shadow. This is likely the fade's top edge not matching the page cream. Fix: make the fade's top stop fully transparent over 28pt and match the page cream exactly.
2. **1.3x label crowding.** At 1.3x the Collection/Calendar labels nearly touch. Enforce the 1.15x cap on the bar's labels (or allowFontScaling cap).
3. **bar-3x-crop.png is stale.** It still shows the old underline bar on Calendar and the old disc. Make sure no one builds from it.
4. **Icon family is still stock outline-icon style** (Phosphor-like). Fine for shipping. A bespoke drawn touch (a sticker-peel corner on the Collection card) would add personality.

## Verdict
**Yes, shippable at a top-studio level.** It is cohesive, flat, legible and consistent in every state and on every surface, and the centre action is unambiguous. What remains is polish: the seam in item 1 and the Dynamic Type cap in item 2. Neither blocks release.
