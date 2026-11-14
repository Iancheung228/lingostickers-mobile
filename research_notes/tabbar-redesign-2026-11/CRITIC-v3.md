# Critic review: Tabi Stickers tab bar, "Crest, final" (v3)

Judged from images only. I did not open any HTML, MJS, MD, JSON or TSX file, and I read no design rationale. One exception: v3-geometry.png has its own caption text baked into the image, which I read.

## Scores (1-10)

| Criterion | Score |
|---|---|
| 1. Balance / symmetry | 7 |
| 2. Brand fit | 6 |
| 3. Craft / alignment | 6 |
| 4. Active state + centre action clarity | 6 |
| 5. Not AI-template generic | 5 |
| 6. Overall (would Apple / Airbnb / Things ship it?) | 6 |

It is competent and clearly better than the "before" bar. It is not yet shippable at studio level. The icon ambiguity, the badge collision, the triple-coded active state and the glossy disc stop it.

## Defects, most severe first

1. **Active Collection + badge merge into one dark blob.** Images: v3-final-zoom.png (bottom middle), v3-final-states.png (Collection active, badge 3).
   - The filled-dark Collection glyph and the dark-maroon badge are almost the same value, and the badge overlaps the glyph's top-right corner. The overlapping-card silhouette disappears.
   - Fix:
     - Make the badge a different value from the active glyph. Use cream #FBF3EA fill with maroon #3A1218 numeral, or a saturated red #C8352E with white numeral.
     - Add a 2pt ring in the pill colour (#E5A3A3) around the badge.
     - Offset the badge so it clears the glyph: centre it 10pt right and 10pt above the glyph's top-right corner, not overlapping it.

2. **Boards outline reads as the digits "08" at 1x.** Images: every state, plainly in v3-final-states.png and v3-final.png, the 5th phone.
   - It is a tall rounded rect plus two circles, which is the most ambiguous icon in the set. The filled version is a different composition (bar plus block plus two dots). The shape changes between states instead of just filling.
   - Fix: use a 2x2 grid of rounded squares (3pt radius, 7pt squares, 3pt gap) for outline and fill, or a pinboard or stack. Keep identical geometry in both states.

3. **Collection icon looks like a generic "copy" glyph.** Images: all states.
   - Two overlapping cards with a text lozenge reads as "duplicate". It is also the weakest-differentiated icon when filled, because the back card vanishes.
   - Fix: use a sticker-peel shape, a fanned stack of 3 rotated cards, or a single card with a folded corner. Keep the back card visible when filled by drawing it as a 1.5pt outline over the filled front.

4. **The active state is triple-coded and the bar is too close to the bottom edge.** Images: v3-indicator.png, v3-final-zoom.png (Collection / Boards indicator).
   - Filled glyph, darker bold label and an underline bar all say "active". The bar is about 4pt above the pill's bottom edge and visually crowds it.
   - Fix: keep filled glyph plus dark label and drop the bar, or keep a 4x4pt dot at 6pt below the label baseline. Of your options, "dot" is the least noisy. If the bar stays, raise it so there is 8pt from pill bottom to the bar.

5. **Scan-active state is nearly invisible.** Images: v3-final.png (Scan screen), v3-final-zoom.png.
   - The only change is a slightly brighter, wider cream rim. On the Scan screen the disc looks identical to the idle disc, and it duplicates the shutter button right above it (same colour, same position). That is two competing primary actions.
   - Fix:
     - Active disc: a 3pt cream ring plus a 12pt soft rose glow at 35% opacity.
     - Or swap the camera glyph for a filled version.
     - Or on the Scan screen dim the disc to a calmer state, since the shutter is already the action.

6. **The "Collection" label is too tight to the pill's left end.** Images: v3-final-states.png top-left (about 15px at 2000w, roughly 7pt). Worse at Dynamic Type 1.15x (top-right): about 10px from the edge, nearly clipping.
   - Fix: give the pill at least 14pt of horizontal padding to the widest label. Allow the pill to widen by 8pt, or cap label size at 11pt and use minimumScaleFactor 0.9. Test at 1.3x.

7. **The disc is nearly touching the "Scan" label.** Image: v3-final-zoom.png (centre, idle). The gap from disc bottom to label cap height is about 3pt, against 9-10pt between the other icons and their labels. The label looks wedged under the disc.
   - Fix: raise the disc by 2pt, or move the Scan label 2-3pt lower than the others and re-optically align.

8. **The gloss gradient on the disc is the most template-looking element.** Images: v3-disc.png (all of A/B/C), v3-final-zoom.png.
   - The top-left radial highlight plus the rim ring is the stock "elevated FAB" look. Nothing else in the app has gloss (flat cream cards, flat rose buttons such as "Review 1 now").
   - Fix: use a flat #9A4A52 fill (disc C is the closest) with a 1pt inner stroke of #7A3640 and one soft drop shadow (0 3 8, 25%). Drop the highlight.

9. **The pill's vertical gradient and top highlight line look muddy.** Images: v3-final-zoom.png (shoulders), v3-final-states.png.
   - The top 1px lighter edge on a cream background reads as a smudge, and the bottom darkens.
   - Fix: use a flat #E5A3A3 pill (same value as the app header #E3A0A0) with one 1pt #F2C4C4 top hairline at 60% opacity, or none. A flat pill would echo the header better and make the whole thing feel intentional.

10. **The pill's edge against cream has little definition and the shadow is weak.** Images: v3-final.png (screens 2-3), v3-final-states.png. Pill #E5A3A3 on cream is low contrast, and the shadow is faint.
    - Fix: shadow 0 6 16 at 18% in #8A3A44, plus a 1pt #D98F92 outer stroke.

11. **Content bleeds visibly below and around the pill.** Image: v3-final.png, 5th phone (Boards, "content behind"). Card thumbnails peek out below the pill, sliced awkwardly between the pill and the home indicator.
    - Fix: add a cream-to-transparent fade (a 28pt gradient, cream at 90% to 0) behind the whole bar zone, or extend a solid cream footer to the screen bottom.

12. **The crest shoulder transitions are a little bulbous.** Image: v3-geometry.png (G/H). The curvature combs are clean with no G2 break, but the crest reaches about 40pt each side, so it looks like a "tab" growing out of the pill rather than a gentle lift. Minor.
    - Fix: widen the reach to ±48 and keep the gap at 5.5. It needs to be a softer swell, not a dome.

13. **Icon stroke weights differ.** Images: all states.
    - Profile is the thinnest. Calendar and Boards are heavier. The camera in the disc is a filled bold glyph, a different style from the 1.5pt outline family. At 1x the Profile outline gets spidery.
    - Fix: standardise on a 1.75pt stroke on a 24pt grid for all four outline glyphs, and thicken Profile's head and shoulders to match.

14. **The badge's placement varies by state.** Images: v3-final-states.png (3 vs 9+ vs 1). The "9+" badge widens and its centre shifts. The badge sits on the glyph, not on a consistent anchor.
    - Fix: anchor the badge's left edge at glyph-right minus 4pt, with a 16pt minimum height and a 4pt horizontal inset. Let it grow right, not centred.

15. **Scan pressed vs idle differ by only about 5% in value.** Image: v3-disc.png. Make pressed scale to 0.94 with a 10% darker fill so that it is perceptible on-device.

## Icon family and ambiguity

- **Do the icons read as a family?** Mostly yes, as outline icons with rounded terminals. But the weights are inconsistent (see defect 13). The camera disc glyph is a different style (filled), and the active fills change composition for Boards and Collection. So it is "nearly" a family.
- **Ambiguous at 1x:** Boards, which reads as "08" (defect 2). Collection reads as "copy" (defect 3). Calendar and Profile are fine. Scan is unambiguous.

## Label / no-label

Keeping labels is correct here. Two of the five icons are ambiguous, and this is a language-learning app for new users. The labels carry real information. Of the label study variants, (d) "none under Scan" is cleaner, because the disc already says what it does and the label crowds it. But the owner has fixed the labels, so keep them and fix the spacing (defect 7). All five labels at the serif size (about 11pt) are legible, but the regular weight is thin at 1x.
- Suggestion: use a medium weight and set inactive labels to at least 75% maroon.

## Bottom line

Fix defects 1-5 and 8 first. They change the perceived quality the most. Then make the pill flat and the disc flat so that the bar matches the app's flat rose/cream look and no longer looks like a templated floating tab bar.
