# Pass C: the look, within Rose

Visual spec for a builder. Mockups: `v2/C-mockups.html` (same tokens, 8 screens). Contrast figures are WCAG 2.x from `scratchpad/contrast.py`. Nothing is device-verified. Takes A-card, A-app, B-core and B-app as given, including B-app's section-15 contrast fixes.

**Direction in one sentence:** the same rose band, cream page and floating pill, but with fewer type sizes, one rule for mono, rose-tinted two-step shadows, and a drawn (not boxed) card, so the sticker and the word are the only loud things on any screen. Warmth comes from colour temperature (every neutral is rose- or sand-leaning), soft rose-brown shadows, round forms and Newsreader's soft serifs. It does not come from a paper, stamp or notebook motif. The sticker gets a soft contact shadow and nothing that imitates an object.

## 1. Tokens

### Colour (new or changed values in bold)

| Token | Value | Role | Contrast |
|---|---|---|---|
| `cream` / `sky` | #FAF4EA | page | body #4A4340 8.85, head 6.94 |
| `card` | #FFFFFF | cards, inputs, due pill | head 7.60 |
| `sand` | #F6EEDD | wells, chips-off, memory line, skeleton base | |
| `sand2` (**new**) | #EFE3CC | skeleton pulse peak, pressed sand | |
| `blush` / `skyDeep` | #E4A0A1 | band, tab pill | maroon text 5.03 |
| `blushEdge` | #D08E90 | rare: band hairline on dark photo only | |
| `terra` (action) | #9D4D51 | primary fill, links, selected | white 5.81, on page 5.31 |
| `terraPressed` | #833F46 | pressed primary (white 7.60) | |
| `terraTint` | #F2DCDC | secondary-button fill, disabled primary, tint chips | head on tint 5.80 |
| `terraTintPressed` (**new**) | #EBCFCF | pressed secondary | |
| `inkDark` | #833F46 | headings, headword | |
| `inkMid` | #4A4340 | body | |
| `inkLight` | **#7E5559** | captions, placeholders | page 5.76, white 6.30 |
| `inkFaint` | #C4A9AB | disabled and decoration only, never text | |
| `maroon` | #662B31 | any text or icon on the band | 5.03 |
| `ctl` (**new**, border for controls) | **#957579** | input, chip, secondary-outline borders | page 3.76, white 4.12 |
| `hairline` | #EADFD6 | decorative edges only | 1.2 (decorative) |
| `divider` (**new**) | #F0E6DC | row dividers inside cards | |
| `charcoal` | #33292A | toast | white 14.08, action link #E4A0A1 6.60 |
| `scrim` (**new**) | rgba(51,41,42,.42) | sheet and modal backdrop (replaces the cream `overlay` for modals) | |
| `err` / `errTint` | **#A8434A** / #F7E0E1 | error text, badge fill, Again text | on tint 4.68, white-on 5.89 |
| `ok` / `okTint` | **#3F6E46** / #E2EFE3 | success text, Good fill | on page 5.44, tint 5.01, white-on 5.95 |
| `gold` / `goldTint` | **#7A5A1E** / **#F5E7C6** | Hard text, warnings | 5.18 |
| `againTint` (**new**) | #F6E3E1 | Again fill, "Due" tag | Again text 4.76 |

Retire as text: `error` #C4565B, `success` #6E9E72, `sageDark`. Keep them as non-text icon or border colours only.

### Grade row against the action rose
- Again is a **tint with text and icon**, never a solid. Action vs Again tint is dE 57, so they cannot be confused. The earlier problem (action vs solid Again, dE 9) is gone because Again is never solid.
- Again (#A8434A text) and Good (#3F6E46 fill) have the same luminance (0.128 vs 0.127) and are dE 7 apart for a deuteranope. They stay distinguishable by **form** (tint vs solid), **icon** (rotate-ccw vs none), **position** and **label**, never by hue alone. That is why Good is the only solid fill in the row.
- Ramp: Again `againTint`/`err`; Hard `goldTint`/`gold`; Good `ok` fill with white text; Easy `okTint`/`ok` with a chevrons-up icon.
- Widths: flex 1.4 / 1 / 1.4 / 1, gap 8, height 60, radius 16. Label Newsreader 17 Medium, interval mono 13.
- Rose solid fill appears only on Start, Done, Add, Test me and the camera.

### Elevation (two steps, rose-tinted)
| Step | Use | RN (single shadow) | Web in mockup |
|---|---|---|---|
| `e1` | cards, grid cells, tiles, chips-on-photo | `#833F46`, opacity .09, radius 12, offset (0,4), elevation 3 | 0 1px 2px rgba(102,43,49,.06), 0 4px 14px rgba(131,63,70,.09) |
| `e2` | tab pill, due pill, sheets, toast, camera disc | `#662B31`, opacity .20, radius 24, offset (0,10), elevation 8 | 0 2px 4px .10, 0 12px 28px rgba(131,63,70,.20) |
| `sticker` | cutout on a sand well or page | `#662B31`, opacity .22, radius 6, offset (0,3) | drop-shadow(0 3px 5px rgba(102,43,49,.22)) |

Cards have no border. They sit on the cream with `e1` only. Controls (inputs, chips) use the `ctl` border and no shadow. Replace `shadows.card/cardWarm/button/tab` with `e1`, `e2`. The tab shadow no longer points upward.

### Press and disabled states
- **Press (all):** scale .98 over 80 ms, plus the colour step above. Tertiary and icon buttons get a `terraTint` disc (44pt) flash instead of an opacity drop.
- **Disabled:** primary becomes `terraTint` fill with `inkLight` text (4.44, disabled is exempt). Never lower opacity on text.
- **Focus (keyboard or Switch Control):** 2pt `inkDark` ring, 2pt offset.

## 2. Type system

Faces unchanged. **Newsreader** (400/500) is the UI voice. **JetBrains Mono** (500, 700 only for badges) is for **numerals, IPA, romanisation and jyutping, and at most one overline per screen**. The **learning font** (Klee One SemiBold for fr and ja headwords, Klee One Regular for sentences; Iansui for yue) is for target-language text only, so the eye can tell language from interface.

| Role | Face / size / line | Tracking | `maxFontSizeMultiplier` | Used for |
|---|---|---|---|---|
| `headword` | learning 40/46 (grid cell 18/24) | -0.4 | 1.3, `adjustsFontSizeToFit` | the word, front of detail, back |
| `title` | Newsreader 500, 30/34 | -0.6 | 1.3 | band title, stat numerals |
| `h2` | Newsreader 500, 22/28 | 0 | 1.5 | meaning, month title, prompt, section hero |
| `button` | Newsreader 500, 17/22 | 0 | 1.5 | buttons, row titles, board names, tab bar CTA |
| `body` | Newsreader 400, 16/24 (sentence in learning 400 at 20/30) | 0 | 2.0 | reading copy, inputs, rows |
| `small` | Newsreader 400, 14/20 | 0 | 2.0 | captions, translations, status line, section headers (Medium) |
| `data` | JetBrains Mono 500, 13/16 (reading at 16/22) | 0 | 1.3 | intervals, counts, dates, calendar numbers, IPA |
| `micro` | Newsreader 500, 12/16 (mono 12 uppercase, +0.08em for the single overline) | | 1.15 | tab labels, chips' badges, POS pill, overline |

**Eight sizes: 40, 30, 22, 17, 16, 14, 13, 12.** (Today: 23 sizes.) Minimum is 12.

Rules:
1. **Mono is for things you read as symbols:** numerals, pronunciation, "1 / 2". Not labels, buttons or captions. Today's five uppercase mono labels per card, gloss lines, and "SHOT AT" go.
2. **One overline per screen at most**, and only where it classifies the content (the scan result "FOUND", which keeps the Maestro string). The Home status line and band subtitles are plain Newsreader 14.
3. Big numerals (stats) are Newsreader 30, not mono.
4. Never `fontWeight`. Emphasis in a target sentence is `inkDark` plus Klee 600. Iansui has one weight, so use `inkDark` plus a 1.5pt underline offset 3 for the target word.
5. Iansui sits slightly low and wide against Newsreader. Give CJK headwords +2 line-height and align baselines via `lineHeight`, not margin.
6. French headwords are Klee One (A-card, brief), articles included.

## 3. Layout rhythm

- **Spacing scale:** 4, 8, 12, 16, 20, 24, 32, 48. Drop `ms`/`xxl` names, rename `space.1…8`.
- **Gutter 20** on every screen. Grid gap 12. Card padding 16 (lists, tiles), 20 to 24 (study card, detail).
- **Section spacing:** 24 between groups, 8 between a section header and its card, 12 between rows of controls, 48 above the first element after a hero.
- **Radii (four):** `sm` 10 (thumbs, wells inside cards), `md` 16 (cards in lists, inputs, grade buttons, filter button), `lg` 24 (study card, big cards, sheets top, month card), `full` (buttons, chips, pills, tab bar). Today's xs/xl go.
- **The band:** keep. Bottom corners radius 28 (not the current large asymmetric sweep); height is `safeTop + content`, no more. Home 172 (title 30, status line, then the due pill straddles the bottom edge by 32pt), Calendar/Boards 132 (title and one subtitle), Profile 160 (avatar 64, name). The band never holds more than a title, one subtitle line and one 44pt control (avatar, top right). It ends with a card or the due pill overlapping it by 16 to 32pt, so the transition reads as depth, not a seam. No gear, no search icon, no goal, no big numeral.
- **Safe areas:** content bottom inset on tab screens is `tabBarHeight (68) + 30 + 24`, with a page-coloured fade (transparent to cream, 150pt) behind the pill so rows don't collide with it.

## 4. Components, pixel-level

**Tab bar.** Width 296, height 68, radius full, `blush` fill, `e2`, 30 above the bottom inset. Four 74pt columns: Collection, Calendar, Scan, Boards. **Labels yes** (B-app): Newsreader 500 12, icon 24, stroke 1.75, gap 2, colour `maroon`. Active item: white 22-radius capsule inset 7/5, icon `terra`, label `inkDark` (7.60). **Camera: kept raised**, a 60pt `terra` disc with 4pt `cream` ring, lifted 30pt so it overhangs the pill by 14, glyph 26 white, "Scan" label inside the pill in `maroon`. Needs an overflow-visible wrapper and a 60pt hit area (B-app flag). Due badge on Collection: 18pt `err` pill, mono 11 bold white, "9+" cap.

**Header band.** See section 3. Avatar 44pt white disc, initial in Newsreader 17 `inkDark`.

**Due pill / status line.** 64 tall, white, radius full, `e2`, margins 20, left padding 24. "7 due" Newsreader 22 `inkDark` (Maestro string via accessibility label "Start reviewing — 7 cards due"), second line "About 7 min" small `inkLight`, right arrow disc 44 `terra`. Pressed: scale .97, disc to `terraPressed`. Nothing due: "All caught up" and a tertiary "Study ahead" in the pill.

**Search and filter.** 48 tall, white, `ctl` 1px border, radius 16, magnifier 20 `inkLight`, placeholder `inkLight` 16. Filter button 48 square, same border, a 6pt `terra` dot when non-default.

**Chips.** 36 tall, 16 side padding, 1px `ctl`, white, Newsreader 15. Selected: `terra` fill, white 500. Gap 8.

**Sticker grid cell.** Two columns, width (390 - 40 - 12) / 2. White card, radius 16, `e1`. Well 128 tall `sand`, cutout at 62% centred with the `sticker` shadow, never an added outline (the cutout carries its own edge). Heart: 20pt icon in a 44pt corner hit area, filled `terra` when on. Text block: headword 18/24, meaning small `inkLight`, "Due" tag (`againTint`/`err`, micro) at right, shown only when due (text, not colour alone).

**Buttons.** Height 52, radius full, Newsreader 17.
| Kind | Fill | Text | Pressed | Disabled |
|---|---|---|---|---|
| Primary | `terra` | white | `terraPressed`, scale .98 | `terraTint`, `inkLight` |
| Secondary | `terraTint` | `inkDark` | `terraTintPressed` | 50% fill, `inkLight` |
| Tertiary | none (44 tall) | `inkDark` | tint disc | `inkFaint` is not allowed, use `inkLight` |
| Destructive | `errTint` | `err` | `#EFCFD0` | as secondary |
Destructive confirm alert button: `err` fill, white (5.89). Icon-in-button 20, gap 8.

**Sheets.** Page-coloured, radius 24 top, `e2`, grabber 36x5 `#E3D3C8`, 12 top padding, 20 gutters, bottom `safeBottom + 16`. Backdrop `scrim`. Grabber and scrim both work (lesson 8).

**Toast.** `charcoal` pill, white 16/22, action `blush` 500 with 44pt hit area, icon 20, `e2`. One at a time, position per B-app.

**Inline error.** `errTint` block, radius 16, 12 padding, icon 16 `err`, text 14 `err` (4.68), "Try again" tertiary inside. Field errors: 14 `err` under the field, no shake.

**Empty states.** A single 56pt sticker emoji-sized glyph in `sand` disc (use a real cutout once the user has one, else a lucide camera 28 stroke 1.75 in `inkLight`), title h2 22, body 16 `inkLight` max 36ch, one primary button. No illustrations.

**Study card.** `card` white, radius 24, `e1`, margins 20, padding 12 (front) or 24 (back).
- *Front:* photo well fills the card top (radius 16, `sand`, cutout at 58% with `sticker` shadow, never cropped), then the prompt (h2 22 `inkDark`, centred, "What did you call this?"), a secondary "Hint" pill (44 tall, bulb 16), "Tap to reveal" small `inkLight` at the card bottom. Nothing else.
- *Back:* headword 40 learning font, reading mono 16 `inkLight` with the 44pt speaker disc (`terraTint`) inline, meaning 22 with a POS pill (`sand`, micro), 1px `divider`, sentence 20/30 with the target in `inkDark` 600, "Show translation" small underlined, Memory line (`sand` block, radius 14, pin 16, small `inkLight`, mono date), "More" row (44 tall, chevron 16). 56pt thumbnail top-right, radius 10.
- *Top bar:* close 44, a 3pt progress bar (`terraTint` track, `terra` fill, unique cards) and `1 / 2` mono 13, "..." 44. No share/save/delete.
- *Flip:* 220 ms, instant under Reduce Motion.

**Card detail.** Photo hero 300 tall, `sand`, bottom radius 28, back/heart/more as 44pt white discs with `e1`, then the same back body on the page (no outer card), a "Progress" block (white card, 3x2 grid, mono 16 value, 12 label), and a sticky primary "Test me".

**Calendar cell.** 52 tall x width/7. Number mono 13 `inkMid` (22 line); a find shows a 20pt thumb below; a review shows a 6pt `terra` dot; today = number in a `terra` pill (white); selected = `terraTint` rounded 12 plus 2pt `terra` inner ring. Faded days of other months `inkFaint` (decorative), blank cells inaccessible.

**Board tile.** White, radius 20, `e1`. Preview 140 `sand` with stickers at slight rotation (to ±8°, since it's a user layout); title 17, caption 14. "New board": dashed 1.5 `ctl`, no fill, tint plus disc.

**Inputs.** As the search field; label above in small `inkLight` 500, error under in `err`. Focus: border `terra` 2px. Password uses `PasswordField` (eye 20).

**Profile row.** 56 tall, 16 padding, 36pt `sand` icon disc (icon 20), title 16, value small `inkLight` right, chevron 16. Rows grouped in a white radius-16 card, `divider` hairlines inset to the icon column. Destructive row uses `errTint` disc and `err` text. Segmented control: `sand` track, 44 tall, white `e1` thumb.

## 5. Micro-detail

- **Sticker:** soft contact shadow only (`sticker`), always on a `sand` well or the cream page. The cutout's own light edge shows through. Never add a border, tape, peel or rotation to cards. Thumbs in lists are drawn at 85% of the well so edges breathe.
- **Placeholders:** image areas are `sand` with a 1.2 s pulse to `sand2` (static under Reduce Motion), same radius as the real image so nothing jumps. Skeletons for Home: six two-column cells; text bars are `sand`, radius 6, heights 14 and 18.
- **Icons:** lucide, stroke 1.75 at 20 to 26pt, stroke 2 at 16pt to keep the same visual weight; round caps and joins; never filled except the favourite heart and the check in selected rows. Icon colour is the text colour of its context.
- **Pressed and focus:** section 1. Haptics per B-app. Never colour as the only signal.
- **Dividers:** `divider` (#F0E6DC) 1px, inset 16, only inside cards. Between cards use space, not lines.
- **How warmth shows:** (1) rose-brown ink and rose-tinted shadows instead of grey; (2) a consistent 16 to 28 radius family; (3) the band's rose and cream's yellow-red cast are the only large fills; (4) learning words in a hand-drawn face stand out as "yours"; (5) the Memory line puts the user's own place and date next to the answer; (6) copy is plain and kind, no exclamation marks.

## 6. Per-screen reading order

| Screen | First | Second | Third |
|---|---|---|---|
| Home | the due pill (white on rose, e2) | the first row of stickers | the camera disc |
| Study front | the photo | the prompt | "Tap to reveal" (Hint is quiet) |
| Study back | the headword | reading and speaker, then meaning | the sentence; grade row anchors the bottom, Good is the only solid |
| Card detail | the photo hero then headword | meaning and sentence | Test me, then Progress |
| Scan camera | the frame and shutter | the Type-a-word button | the hint (coach mark, once) |
| Scan processing | the photo you took | the checklist step in progress | Cancel |
| Scan result | the cutout and FOUND word | "Also in this photo" picks | Add N cards |
| Calendar | the month with today pill | stickers on days | Review N now |
| Day | the date title and thumbs | reviewed count | the list |
| Boards | the first tile | New board | tab bar |
| Profile | avatar and name on the band | the stats | Language segment, then rows |
| Auth / onboarding | the wordmark in the band | the form fields | the primary button; links are tertiary |

## 7. Notes on mockups and implementation

- `C-mockups.html` is the visual reference; emoji replace photos, fonts load from Google Fonts. In the mockup the grid shows the new Home with the old wall, rail and nested list removed (A-app).
- Mechanical order for the builder: tokens (`colors`, `elevation`, `type`, `radii`, `space`) in `constants/theme.ts`; then the tab bar and band; then `CardView`; then screens.
- Native or rebuild items: none. Raised camera overhang needs `overflow: 'visible'` on the bar wrapper and a separate pressable for the disc.
- Open questions for the owner: tab labels at 12pt fit "Collection" in 74pt up to Dynamic Type 1.15 only; whether to give the raised camera its "Scan" label inside the pill (shown) or drop it for the disc alone.
