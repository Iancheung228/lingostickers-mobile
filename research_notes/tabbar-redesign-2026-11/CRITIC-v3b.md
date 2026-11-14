# Critic re-review: Tabi Stickers tab bar, "Crest, final" (v3b)

Images only. I read no html, js, md, json or tsx and no rationale. The captions baked into the PNGs (for example "pitch 64 (chosen)") were visible and I read them. Images reviewed: v3-final, v3-final-states, v3-final-zoom, v3-badge, v3-active, v3-scan-screen, v3-spacing, v3-fade, v3-surface-photos, icons-v3/final-3x and icons-v3/grid-8x. I did not open v3-disc, v3-surface, v3-geometry, v3-proportions or the v3-labels shots on this pass.

## 1. Scores (was -> now)

| Criterion | v3 | v3b |
|---|---|---|
| 1. Balance / symmetry | 7 | 8 |
| 2. Brand fit | 6 | 7 |
| 3. Craft / alignment | 6 | 7 |
| 4. Active + centre clarity | 6 | 7 |
| 5. Not AI-template generic | 5 | 6 |
| 6. Overall | 6 | 7 |

The flat pill, flat disc, cream badge and the fade are real improvements. The bar now looks like it belongs to the app. Icon design and Dynamic Type are the remaining weak spots.

## 2. Status of the 15 defects

| # | Defect | Status | Note |
|---|---|---|---|
| 1 | Badge merged with active Collection glyph | **Fixed** | v3-badge.png: cream disc, maroon numeral, clear of the glyph, grows right. Reads at 1x. |
| 2 | Boards read as "08" | **Fixed** | 2x2 mixed-size tile grid (grid-8x.png). Outline and filled have the same geometry. It now reads as "widgets/grid", fine for Boards. Slight "app launcher" feel. |
| 3 | Collection looked like a generic copy icon | **Partly fixed** | It is no longer generic, but see new defect N1. |
| 4 | Active triple-coded, bar too close to the bottom | **Fixed** | The bar is gone. Filled glyph plus darker label only. Verdict on clarity in section 3. |
| 5 | Scan-active invisible and duplicating the shutter | **Partly fixed** | A 3pt cream ring plus a darker fill is now visible (v3-final-states.png, Scan active; v3-scan-screen.png). Still two rose circles stacked on the Scan screen, 170px apart. |
| 6 | "Collection" label tight to the pill end | **Fixed at the ends, regressed inside** | End padding is now generous, about 38px at 2000w. But see N2. |
| 7 | Disc nearly touching the Scan label | **Fixed** | v3-final-zoom.png: about 6pt, matching the other icon/label gaps. |
| 8 | Glossy disc gradient | **Fixed** | Flat rose with a thin darker stroke. |
| 9 | Muddy pill gradient / highlight | **Fixed** | Flat fill, 1pt darker outline. |
| 10 | Weak pill edge and shadow | **Fixed** | The outline plus shadow define it on cream, photos and the dark camera frame (v3-surface-photos.png). |
| 11 | Content bleeding below the pill | **Fixed** | v3-fade.png: 28pt cream fade. The text just above the pill ghosts slightly, which is acceptable. |
| 12 | Crest dome-like | **Mostly fixed** | Smoother, wider shoulders. Fine. |
| 13 | Stroke weights inconsistent | **Mostly fixed** | Uniform stroke. Calendar still looks bigger than Boards and Collection (see N4). The camera is a filled glyph, which is acceptable for the hero. |
| 14 | Badge anchor shifting | **Fixed** | Left-anchored; 1, 3 and 9+ are consistent (v3-badge.png). |
| 15 | Pressed vs idle too subtle | **Fixed** | The pressed disc is smaller and darker (v3-final-zoom.png). |

## 3. Is the active state clear enough now (filled glyph plus darker label, no bar)?

Mostly yes, at screen scale.
- Calendar, Boards and Profile read instantly. The filled glyph is the strongest cue and does the work.
- Collection is the weakest. The back card is outline in both states, so the filled/outline difference is small, and the badge sits next to it. In v3-final.png phone 2 and in v3-badge.png it is readable but the least obvious of the four.
- The label's darker weight is a modest cue. Without the glyph change it would not be enough, and inactive labels are quite light. A user with colour-vision deficiency or in sunlight leans entirely on glyph fill.
- Scan active relies on the ring alone, which is adequate.

So: clear enough for three of four tabs, and borderline for Collection. Keeping "no bar" is right, since the bar was redundant.

## 4. New defects introduced

**N1 (high). The Collection glyph reads as a backpack or padlock.** Images: grid-8x.png, final-3x.png, v3-final-zoom.png (bottom middle).
- The back card is now an open arc behind a rounded rectangle with two lines. The arc looks like a strap or handle, and the front rounded square looks like a bag body. At 1x, filled, it is a dark bag with a strap.
- Fix: draw the back card as a complete offset rounded rect (a visible second card, 2pt offset up-left, full corner radius), not an open arc. Or use a fanned 2-card stack, or a sticker with a peeled corner. Keep the 1.65 stroke.

**N2 (high). Labels collide at larger Dynamic Type.** Image: v3-spacing.png (pitch 64 chosen).
- At 1.15x the gap between "Collection" and "Calendar" is about 10px at 2000w, roughly 4pt. At 1.3x it is about 5px, roughly 2pt, so the words nearly touch and read as "Collection Calendar".
- The old 70.6 pitch fixed the inner collisions but crowded the pill ends. The fix swapped one problem for the other.
- Fix: a pitch of about 68, shave the end padding (the ends now have about 38px of slack), and put a 10pt floor on inter-label gaps. Alternatively, cap label size at 12pt and use minimumScaleFactor 0.85 beyond 1.15x. Also check that the 9+ badge clears the Calendar glyph at 1.15x (v3-final-states.png, top-right).

**N3 (medium). Inactive labels and glyphs may be low contrast.** Images: v3-final.png phones 3 and 5, v3-active.png.
- Inactive labels are a semi-transparent maroon on #E3A0A0. By eye the contrast looks about 3.5:1 at roughly 11pt. That is below 4.5:1 for small text, and it is the cue that distinguishes inactive from active.
- Fix: inactive label at #7A2E3A or darker (at least 4.5:1) and inactive glyph at #6B2A35. Keep the active colour at #3A1218.

**N4 (low-medium). Optical size mismatch.** Image: icons-v3/final-3x.png.
- The calendar body is a 20x20 square and fills its box, while Collection and Boards sit smaller. Profile's shoulder bowl is wide. At 1x Calendar looks about 8% larger.
- Fix: shrink the calendar by about 1.5pt on the grid, or enlarge Boards by 1pt.

**N5 (low). The Scan screen still has two near-identical rose circles stacked** (shutter plus disc). Fix: on the Scan route, drop the disc's cream ring to 2pt and desaturate the disc to the pill-dark #8A5058, or fill the camera glyph differently, so that the shutter is clearly the page's primary action.

**N6 (low). Flat disc against flat pill:** value separation is now modest (#9A4A52 vs #E3A0A0). It holds on cream but gets muddy over the photo grid. The 1pt darker stroke helps. Consider a 1.5pt stroke.

## 5. Shippable at top-studio level?

Not quite, but close. Roughly one more iteration. Top 3 blockers:
1. **Collection glyph (N1).** A bag/padlock silhouette on the first tab, which is the app's home. Redraw it with a full second card.
2. **Dynamic Type collisions (N2).** The labels nearly touch at 1.15x-1.3x, and a studio would test this. Re-balance the pitch and padding, and cap label size.
3. **Inactive contrast and active clarity (N3 + the Collection state).** Darken the inactive label to at least 4.5:1, and make the Collection active state differ more (fill the back card or use a heavier front card).

Not blocking but worth a pass: N5 (the Scan screen duplicate) and N4 (the optical size match).
