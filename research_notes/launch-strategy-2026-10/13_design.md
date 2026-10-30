# 13: Design audit and system proposal: Tabi Stickers

Audited 2026-10-29 at HEAD `59f753c`. This was read-only and nothing was run on a device.

**Evidence base.** I read the code in `constants/theme.ts`, `constants/tabBar.ts`, StudyCard, DiscoveryReveal, ReviewSummary, CutoutSticker, StickerCard, CorkBackground, GhostCutoutReveal, ScanProgress, AuthIntro and SentenceGloss. I also grepped user-facing copy across every tab, the auth flow and the challenge flow.

I viewed **the only three real screenshots that exist**: `.maestro/output/sign-in/takeScreenshot/01-sign-in.png`, `02-home.png`, and `screenshots/step-006-…png`. The QA sticker in them is the Expo logo fixture, so the home screenshot shows layout, not real content.

Contrast ratios were **computed** (WCAG relative luminance), not eyeballed. Anything I judged from code alone, without seeing it render, is marked *(code-read)*.

---

## 0. The one-paragraph verdict

The typography is already better than most shipping apps. Newsreader plus JetBrains Mono, five named roles, and per-language CJK faces is a genuinely considered system (`theme.ts:73-160`).

Everything around the type is generic. White rounded rectangles with a soft shadow sit on cream, and rose pills sit on rose. The app *names* the travel-notebook metaphor (a "perforation" on the study card, a "cork" board, "FOUND TODAY") but never *draws* it:
- the cork is pink ruled paper;
- the perforation is a dashed hairline;
- the card is a form with four labelled rows;
- the scene photo, which is the most personal asset the app owns, **never appears on the study card at all**. In `StudyCard.tsx`, `memory_photo_path` is referenced only on the delete path, line 611.

The app icon is still the default Expo "A" on a blueprint grid (`assets/icon.png`), and the same image is the QA sticker on the home screenshot. Dark mode is hard-off (`app.json: userInterfaceStyle: "light"`). There are 64 system `Alert.alert` calls across 18 files, and spinners in 33 files.

The fix is not a redesign. It is **committing to the metaphor the code already gestures at**, starting with the card.

---

## 1. Visual critique per screen

### 1.1 Auth (`app/(auth)/*`, `AuthIntro.tsx`): seen in screenshot
- **Beautiful:** the wordmark "Tabi Stickers" in Newsreader 500 rose-brown with a letterspaced mono eyebrow ("WELCOME BACK"). This is the best typographic moment in the app and should become the logotype.
- **Broken:** the **top ~52% of the screen is empty cream** (`sign-in.tsx:161 justifyContent: 'flex-end'`). The illustrated scene was removed for "a sleeker first impression" (`AuthIntro.tsx:9`), but nothing replaced it, so it reads as a layout bug, not as restraint.
- The `CozyBackground` night scene survives only on forgot/reset password. The user sees the app's one illustration on the screen they're least happy to be on.
- **Default:** the form is a white card inside a cream page, with cream inputs inside the white card. That is three nested fills for two fields.
- The disabled "Sign In" is white text on `terraLight` at **1.31:1**. Disabled controls are exempt from WCAG, but this is the *resting* state when the screen opens, so a first-time user sees a broken-looking pink slab.
- **Metaphor:** none. This is the notebook's cover and should look like one (section 4).

### 1.2 Scan (`scan.tsx`, `ScanProgress.tsx`, `GhostCutoutReveal.tsx`, `PhotoExtractor.tsx`) *(code-read)*
- **Beautiful:** the ghost-cutout crossfade (photo dissolves at 1.08×, cutout fades in underneath, `GhostCutoutReveal.tsx:19-21`). Its concept is the app's signature, but the execution is an opacity crossfade, and nothing physical happens. The lasso with scissors at the tip is charming and on-metaphor.
- **Default:**
  - `ScanProgress` is a three-row checklist with an `ActivityIndicator` in the active marker. The copy is honest and well written ("this happens on your phone"), but it looks like an installer. The wait is the riskiest 2 to 10 seconds in the app, and it is dressed as a progress dialog.
  - The rule-of-thirds grid and % zoom pill are camera-app conventions. They are fine, but there is no viewfinder personality: no frame, no "specimen tray".
- **Breaks the metaphor:** errors ("Scan failed", "Daily limit reached", "Extraction failed") are system Alerts (5 in `scan.tsx`). An Alert over a live camera is the most jarring possible context switch.

### 1.3 Discovery reveal (`DiscoveryReveal.tsx`) *(code-read)*
- **Beautiful:** a centred 40pt headword, a mono reading, the translation in letterspaced mono caps in terra (`:383`). It is a strong, quiet hierarchy, and the edit-by-tick/cross model is correct (skills #10).
- **Default:**
  - The header says "New Discovery" in 18pt with an X. That is a settings-sheet header on the app's climax moment.
  - The sticker is a plain RN `Image` (`:137`), not `expo-image` and not `CutoutSticker`, with no border, no shadow, and no sense that it is a *sticker*.
  - The three stacked actions (a filled "Add to Collection" with a Bookmark icon, then "Retry Extraction", then "Discard") are form buttons.
  - "Retry Extraction" is engineering language.
- **Metaphor gap:** this is where the sticker should be *peeled off the photo and handed to you*. "Add to Collection" should be **"Stick it in"**, an action you could do with your thumb (drag the sticker down into the notebook) as well as a button.
- The gloss and insight appear here and on the back of the card in the same style, so the reveal spends its novelty early (section 3 moves depth to the back).

### 1.4 Study card (`StudyCard.tsx`, 1485 lines): the hero, and the weakest link
- **Beautiful:**
  - the 3D flip, with a Reduce Motion check (`:385`, the only one in the app);
  - the grade ramp, which is correctly painted per skills #12;
  - the press-and-hold mic;
  - "DAY 0" age counter;
  - a WHERE/WHEN footer under a "perforation".
  - The engineering of touch targets is excellent (`Field`'s pencil-vs-flip split, `:1180`).
- **What it looks like:** a white `borderRadius: 28` card with `shadows.card` (`:1240`).
  - **Front:** a date block (34pt day number), an author block with an avatar, a note, the cutout at 82% width **left-aligned** (`wellWrap: alignItems: 'flex-start'`, `:1290`) floating on bare white, then "What did you call this?" and a Hint pill.
  - **Back:** four ruled rows labelled WORD / SAY IT / MEANS · NOUN / IN USE in 10pt mono `inkLight`. It is a **form**, the visual grammar of a settings page or a CRM record.
- **Specific problems:**
  1. **The sticker is not the hero of its own card.** On the front, the date block and the author's avatar compete with it at the top. It sits off-centre with no surface beneath it, so the white outline that makes it a sticker disappears against white card stock. A white-bordered die-cut on a white card is invisible as a die-cut.
  2. **The scene photo is absent.** The app stores a ≤1280px memory photo of the moment, and the study card never renders it. The back footer shows a 42px circular thumbnail of the *cutout* again (`footerThumb`, `:1442`).
  3. **The back has no focal point.** The 38pt word is in row 1 of 4, and the meaning is a 20pt row with the same visual weight as the sentence. Anki's own default card centres the answer, so Tabi's back is *less* scannable than Anki's.
  4. **Ten type sizes on one card:** 9.5, 10, 11, 12, 13, 14, 15, 17, 19, 20, 22, 34, 38, all ad hoc in the stylesheet rather than from `typography`.
  5. **The "perforation"** is `borderStyle: 'dashed'` on a 1.5px top border (`:1428`). RN dashed borders render as short grey dashes, which reads as a divider, not as a tear line.
  6. **No material state.** A card reviewed 40 times looks identical to one found today. The badge text "7TH REVIEW" is the only difference, and that is the founder's literal ask ("prettier Anki cards") left on the table.
  7. **Copy drift:** WHERE (front) vs SHOT AT (back) for the same field.
  8. **Contrast failures:** field labels in `inkLight` on white are **3.13:1** at 10pt (needs 4.5). The mic hint in `inkFaint` is **2.19:1** at 11pt.

### 1.5 Review summary (`ReviewSummary.tsx`)
- **Default, full stop:** a fade-in modal, a white card, a 56px rose disc with a ✓, "Session done", two stats ("recalled" / "to revisit") and a Done button. It is the modal from every to-do app.
- It celebrates nothing and remembers nothing: no stamp, no card fan, no "you've now got 12 mature cards". `solid === 1 ? 'recalled' : 'recalled'` (`:39`) is dead pluralisation, a tell that nobody has looked at this screen closely.
- **This is the cheapest high-delight win in the app** (backlog #3).

### 1.6 Collection / home (`collection.tsx`, `HomeHeader.tsx`, `MiniStickerWall.tsx`, `FeedRail.tsx`, `LatestStickers.tsx`): seen in screenshot
- **Beautiful:**
  - The rose masthead band with "THU, 29 OCT" and a huge "1" beside "FOUND / TODAY" in mono is confident, almost editorial.
  - The "1 due · 1 min" capsule with a terra arrow is a lovely, specific CTA.
  - The wall card "lifting into" the band is a good layering idea.
  - The tape strip on the wall sticker (visible in the screenshot) is the **only washi tape in the whole app**, and it works.
- **Problems (from the screenshot):**
  1. **The same sticker appears four times above the fold-and-a-half:** wall, "Latest finds" rail, "Latest stickers" list, and the grid. There are three overlapping "recent" modules. With 1 sticker it looks broken; with 200 it is a scroll tax.
  2. **Six different card treatments on one screen:** a masthead capsule, a wall frame with a thick white rim, a feed card, a list card, chips and grid cards. They share radius and white, nothing else.
  3. **Chips overflow under the sort button** ("Study" is clipped by the ↑↓ circle). It needs a fade mask or the sort folded into the chip row.
  4. **The floating tab bar covers the first grid card's sticker**, and its white-on-blush icons are **2.13:1** (the non-text minimum is 3:1).
  5. The wall background is the "cork" (`CorkBackground.tsx`), a cream→rose gradient with 10 horizontal stripes. It reads as **pink ruled paper**, not cork. As ruled paper it is actually nice, so rename it and lean in.
- **Metaphor:** the closest to right in the app. A notebook "today" page is one step away.

### 1.7 Boards (`wall.tsx`, `BoardCanvas.tsx`, `BoardRail.tsx`) *(code-read)*
- **Beautiful:** rotation per sticker (`BoardCanvas.tsx:213`), seeded scatter (`lib/boardLayout.ts`), drag-to-trash that grows, and user photo backgrounds with a dim slider. This is the most "toy" part of the app.
- **Default:**
  - placing has no slap (no squash, no shadow collapse, no sound);
  - the "framed" display style puts stickers in white photo cards, which mixes the Polaroid and die-cut metaphors (04_aesthetics §2 warns against exactly this);
  - the empty state "No boards yet" is plain text.
- 8 Alerts live in `BoardCarouselPage.tsx` (rename/delete/cover).

### 1.8 Calendar (`calendar.tsx`, `day/[date].tsx`, `WeekActivityTracker.tsx`) *(code-read)*
- **Beautiful:** "The long view" title, the Finds/Reviews segmented control, cutouts as day icons, due-count rings with the heaviest day marked. The code says it was measured from a 430pt mock, and it shows in the care of the comments.
- **Default:** a month grid is a month grid. Nothing says *Hobonichi*:
  - no stamp on days you studied;
  - no tear-off page turn;
  - the error state is "COULDN'T LOAD · TAP TO RETRY" in mono caps, which is the right voice.
- **Missing:** "days you visited" stamps. These are the gentle-streak mechanism from 04 §4.8, and the calendar is their natural home.

### 1.9 Friends / challenge (`friends.tsx`, `ChallengeScreen.tsx`, `ChallengeSuccess.tsx`, `FriendsEmpty.tsx`) *(code-read)*
- **Beautiful:** ChallengeSuccess flips to reveal **the friend's memory photo** ("Tap to see the moment"). That is the only place the scene photo is used as emotion, and it is the right instinct. "Learn alongside someone" is good empty-state copy.
- **Default:**
  - The challenge itself is a form: photo, English meaning, blanked sentence, text field, "Check Answer". The metaphor that fits, a **postcard** with a stamp corner, postmark, city and date, is entirely absent.
  - "You got it!" plus Done is the same modal pattern as ReviewSummary.
  - 3 + 6 + 2 Alerts across friends, FriendProfile and FriendSearch, including Remove/Block confirms.

### 1.10 Profile (`app/profile.tsx`) *(code-read)*
- A settings screen, which is fine for most of it. But it is where identity lives and it has none: an avatar plus "Captured" and "Favorites" stat tiles.
- **10 Alerts**, the most of any file (logout, delete ×2, avatar choose/remove, report).
- This is the place for a **passport page**: the avatar as a passport photo, languages as visa stamps, places collected as eki stamps. Keep settings below a fold.

---

## 2. Design system proposal

### 2.1 Token cleanup: name by role, then by material
The drift is real:
- `sky` is cream;
- `skyDeep` and `blush` are the same `#E4A0A1`;
- `terra`, `rust` and `blushDeep` are all `#9D4D51`;
- `sage` is sand, and `sageLight` and `sand` are both `#F6EEDD`;
- `inkDark` and `terraDark` are both `#833F46`;
- `sky` and `cream` are both `#FAF4EA`.

The comment at `theme.ts:3` explains why (the names were kept so a repaint was a palette edit). That was smart once, and now it is a trap: nobody can reason about `skyDeep` meaning "rose".

Proposed shape. Do it in one codemod, and keep the old names as deprecated aliases for one release.

```ts
export const palette = {           // raw paint — never imported by screens
  paper50:'#FDF9F2', paper100:'#FAF4EA', paper200:'#F6EEDD', paper300:'#EFE4DA',
  kraft:'#D9B87C', kraftDeep:'#A9803E',
  rose200:'#F2DCDC', rose400:'#E4A0A1', rose500:'#D08E90', rose700:'#9D4D51', rose800:'#833F46', rose900:'#662B31',
  ink900:'#33292A', ink700:'#4A4340', ink500:'#8A6B6D' /* NEW: 4.77:1 on white */, ink300:'#C4A9AB',
  indigo:'#3E4C74' /* NEW: stamp ink #2 (eki stamps are often blue) */, foil:'#C9A24A',
  moss:'#6E9E72', mossDeep:'#4C7A52', vermilion:'#C4565B', vermilionDeep:'#A8434A',
};
export const color = {             // roles — what screens import
  bg:            { page, sunken, band },        // paper100, paper300, rose400
  surface:       { card, cardAlt, sheet, well },// paper50 (not #FFF — see 2.5), paper200, …
  text:          { title, body, muted, faint, onAccent, onBand }, // rose800, ink700, ink500, ink300(decorative only), white, rose900
  accent:        { primary, primaryPressed, primarySoft }, // rose700, rose800, rose200
  ink:           { stamp, stampAlt },           // rose700, indigo
  state:         { again, hard, good, easy, danger, success },
  line:          { hair, rule, perforation },
};
```

**The contrast fix:**
- `inkLight #A98A8C` is used for *text* (field labels, captions, footer labels) at **3.13:1 on white and 2.86:1 on cream**. It fails AA.
- Replace it for text with `ink500 #8A6B6D`, measured at **4.77:1 on white and 4.36:1 on cream**. Cream is still marginal for small text, so labels sit on card stock, not on the page.
- `inkFaint` (2.0 to 2.2:1) becomes decoration and placeholder only, and is never used for hints (`micHint`, `notePromptText`).
- Tab icons on blush are 2.13:1, so use `rose900` icons, or a deeper bar.

### 2.2 Type scale
The roles are right. The *sizes* at call sites ignore them. Lock a scale and make the study card use it.

| Token | Face | Size/Line | Use |
|---|---|---|---|
| `hero` | word face (Newsreader 500 / Hiragino / PingFang HK) | 44/52 | the headword on the card back, the reveal |
| `display` | Newsreader 500 | 34/40, −0.8 | big counts ("1 FOUND"), session totals |
| `title` | Newsreader 500 | 24/30, −0.3 | screen titles |
| `heading` | Newsreader 500 | 19/25 | card headings, sheet titles |
| `reading` | Newsreader 400 | 17/26 | sentences, notes, meaning |
| `body` | Newsreader 400 | 15/22 | general copy |
| `caption` | Newsreader 400 italic* | 13/18 | glosses, translations under sentences |
| `label` | JetBrains Mono 700, caps, +1.2 | 11/14 | specimen labels (never below 11) |
| `data` | JetBrains Mono 500 | 13/18 (reading: 18/24) | romanization, dates, intervals |

\*Italic would need a third Newsreader file (`400Italic`, about 115KB). It is worth it: an italic translation under a roman sentence is the classic dictionary convention, and it frees colour from carrying the distinction. This is JS-only (an expo-font asset), so no EAS build.

**Dynamic Type:**
- There are zero `allowFontScaling` and `maxFontSizeMultiplier` settings in the app, so everything scales unbounded, and fixed-height chrome (the 62pt tab bar, the 40pt circular buttons, the mono labels) will clip at AX sizes.
- Policy:
  - `label` and `data` get `maxFontSizeMultiplier: 1.4`;
  - `hero` gets 1.6 plus `adjustsFontSizeToFit`;
  - body roles are unbounded;
  - the card back must scroll at AX3, which it already does.

### 2.3 Spacing and radius
- **Spacing.** Keep 4/8/12/16/24/32/48. Add `cardInset = 20`: the card currently uses 24, which with 16pt screen padding leaves a 287pt text column on a 375pt phone, so 20 buys 8pt.
- **Radii.** Collapse to three meanings:
  - `paper: 6` for cards, stamps, labels and tickets (real paper has small corners; 28pt corners are what make the card read as a "UI card" rather than an index card);
  - `control: 14` for buttons and inputs;
  - `pill: 999` for chips.
  - The single most cheap-and-effective change in this whole document is **28→8 on the study card**.

### 2.4 Card anatomy (applies to study card, challenge postcard and summary)
```
┌ paper (surface.card, radius 8, 1px line.hair inner edge, paper grain overlay 4%) ┐
│ HEAD  specimen label row (mono 11)                                               │
│ BODY  hero object (sticker on its backing / word)                               │
│ ─ ─ ─ perforation (SVG: 6px holes on 10px pitch, punched through to bg) ─ ─ ─ ─│
│ STUB  provenance: place · date · collector  (mono data, tinted stub paper)     │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 2.5 Elevation and paper
- **Pure white `#FFF` cards on cream look like UI.** Use `paper50 #FDF9F2` for the card and keep white only for the sticker's die-cut border. That way the sticker outline *reads* again (1.4.1).
- **Grain:** one 256×256 tiled PNG (paper fibre noise, 3 to 5% opacity, multiply-looking via a dark-on-transparent PNG), layered over cards and the page. It is JS-only (`expo-image` with `contentFit="none"`, or a repeat via an `ImageBackground` tile).
- **Three elevation levels:**
  - `rest`: a 1px hairline plus a 2px y-offset shadow at 0.06;
  - `lifted`: 8px at 0.12 (a card in hand, a sticker being dragged);
  - `float`: sheets.
- Shadows are tinted `rose900`, never black (the current `shadows.card` already does this, which is good).
- Stickers get their **own** contact shadow (a pre-blurred PNG ellipse) rather than a view shadow, which is cheaper on boards.

### 2.6 Motion principles
1. **Everything is paper, so everything has mass.** Springs, not linear timings: card flip damping 14 / mass 1.2 with about 4° overshoot. The current flip uses legacy `Animated` interpolation (`StudyCard.tsx:672`); port it to Reanimated.
2. **One signature per moment, and never two at once:** peel (reveal), slap (place), stamp (complete), flip (study), file (grade).
3. **Durations:**
   - 120ms for micro (press);
   - 240ms for transitions;
   - 400 to 650ms for signatures only;
   - nothing over 700ms that blocks input. GhostCutoutReveal's 350 + 650ms hold is the ceiling.
4. **Seeded imperfection:** ±3° and ±2px from `lib/seededRandom.ts` on every sticker, stamp and tape strip, stable per id.
5. **Reduce Motion:**
   - a single `useReducedMotion()` (from Reanimated) in a shared hook;
   - flips become a 180ms crossfade;
   - tilt and parallax are off;
   - stamps become opacity-only;
   - peel becomes a fade.
   - Today only StudyCard checks it.

### 2.7 Sound and haptic map (`lib/feel.ts`, the single owner)
| Event | Haptic | Sound (foley, 3 variants, ±3% rate) | Where |
|---|---|---|---|
| shutter | (dropped while the camera is active) | soft mechanical click | scan |
| peel (cutout lifts off the photo) | `impact Soft` | paper "tchk" | reveal |
| stick it in (save) | `impact Rigid` | "thup" | reveal → collection |
| card flip | `selection` at 90° | card riffle | study |
| grade Again | `impact Rigid` | low tap | study |
| grade Hard/Good | `impact Light` | card slide "fff" | study |
| grade Easy | `notification Success` | slide + tiny ting | study |
| stamp (session done, new place) | `impact Heavy` at impact frame | rubber "kachunk" | summary, calendar |
| foil earned (first mature) | `notification Success` | soft chime (the only tonal sound) | study |
| place on board | `impact Rigid` | "thup", pitch varies by size | boards |
| error / limit | `notification Warning` | none | toasts |

Rules:
- **Never the only signal.**
- Respect the silent switch.
- Duck sfx under TTS and voice notes.
- An in-app "Sounds" toggle in Profile.
- Preload a pool.
- About 8 files, under 150ms each, at −20 LUFS.

### 2.8 Iconography
- Lucide at default 2px stroke is right for chrome. **Stop using it for objects that are physical in the metaphor.** The tab bar (BookOpen, Calendar, Camera, Sticker, Users) is the most visible case.
- Keep Lucide in toolbars and settings. Draw five custom tab glyphs in the same 2px stroke but with a hand-inked wobble: notebook, a page-a-day calendar, camera, a sticker with a peeled corner, and two stamps overlapping.
- Selected state = filled with `rose900` and a slight ink-bleed edge.
- Do it as SVG in `react-native-svg` (JS-only).

### 2.9 Illustration needs
Only `BackgroundScene.tsx` exists. Commission one consistent hand-inked style (a single line weight, flat fills from the palette, risograph-like misregistration as an optional texture). The minimum set:
1. **Cover / auth scene:** the notebook closed on a café table, a sticker poking out. It fills the empty top half of sign-in.
2. **Empty states (×6):**
   - Collection: an open notebook with dotted die-cut outlines;
   - Boards: a bare cork board with a pin;
   - Friends: two postcards;
   - Calendar: a blank day page;
   - Search no-results: a magnifier over a blank label;
   - Day with no finds.
3. **Stamp set:**
   - session-done stamps (×3 variants);
   - "first sticker";
   - 10/50/100 words;
   - "mature" foil seal;
   - a per-language stamp (fr: a little café chair; ja: a torii; yue: a Star Ferry or tram).
   - Ink as transparent PNGs at 3×.
4. **Washi tape strips** (×6 patterns: seigaiha, asanoha, gingham, plain kraft, rose dot, indigo stripe) as tileable PNGs.
5. **App icon:** the decision memory says it is pending. My recommendation: **a die-cut sticker of a tiny notebook (or a 旅 eki stamp), peeling at one corner, on rose**, recognisable at 29pt. Whatever is chosen, the Expo "A" must not ship.
6. Onboarding demo assets (section 4).

Budget reality: a freelance illustrator for about 25 small spot pieces plus stamps plus tape is a few weeks and low-thousands USD. Stamps and tape could be self-made: real rubber stamps scanned, then vectorised. That is authentic and cheap.

---

## 3. The flashcard redesign: "the Specimen Card"

### 3.1 Concept
Each card is a **specimen card from your own travel notebook**: an index card with the sticker stuck on it, a museum-style label typed beneath, and a tear-off stub carrying provenance. Over time it collects **ink stamps** for each successful review, earns a **foil edge** when mature, and gets a strip of **washi repair tape** if it lapses. The *photo of the moment* lives on the back, as a taped-in snapshot.

### 3.2 Front (prompt)
```
 ┌──────────────────────────────────────────────┐  ← paper50, radius 8, grain 4%
 │ № 0142                       旅 · JA   ◎◎◎○○ │  ← label row: catalogue no. (cardNumber),
 │                                              │     language, stamp-card progress
 │                                              │     (inked circles = successful reviews,
 │              ╭───────────────╮               │      max 5; replaces "7TH REVIEW")
 │             ╱   [ STICKER ]   ╲  ~3° tilt    │
 │            │   die-cut, white  │             │  ← CENTRED, 72% card width, on a
 │            │   border visible  │             │     sunken "backing" well (paper200,
 │             ╲  on cream paper ╱              │     radius 6) so the white rim reads;
 │              ╰───────────────╯               │     contact-shadow PNG under it
 │                                              │
 │        What did you call this?               │  ← heading 19, centred, rose800
 │             ( ? first letter )               │  ← hint as a small stamp-outline pill
 │                                              │
 │ "the café by the station, raining" ✎         │  ← user note, reading 15 italic, max 2
 │                                              │     lines, only if present (the empty
 │                                              │     invitation moves to browse mode only)
 ├ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ┤  ← real perforation: SVG circles
 │ SHIMOKITAZAWA            14 OCT · 18:42      │  ← stub: kraft-tinted paper200, mono data
 │ collected by you         DAY 15              │     (or "from mika ✉" with postmark, 3.5)
 └──────────────────────────────────────────────┘
```
Changes from today:
- The sticker is centred and dominant.
- The date and avatar block moves to the stub, because the stub *is* provenance.
- One location word (WHERE/SHOT AT unified as the place itself, no label needed).
- The progress-as-stamps row moves to the label line.

### 3.3 Back (answer)
```
 ┌──────────────────────────────────────────────┐
 │ № 0142    NOUN · 名詞                 ◎◎◎●○ │  ← today's review inks in on flip-back
 │                                              │
 │                  傘                          │  ← HERO 44, centred, word face
 │                kasa  🔊  ▶ you   ●hold       │  ← data 18 + speak (filled rose700),
 │                                              │     own take, hold-to-record; controls
 │                umbrella                      │     in one row, gap ≥ slop sum (skills #9)
 │                                              │  ← reading 19, ink700
 │  ┌──────────────────────────────┐            │
 │  │ [scene photo, 4:3]           │ ▱ washi    │  ← the MEMORY PHOTO, taped at one
 │  │                              │   tape     │     corner with seeded tilt (−2°..2°),
 │  └──────────────────────────────┘            │     max 40% card height; tap → full-screen
 │                                              │
 │  雨の日に 傘 を 駅に 忘れた。                  │  ← sentence, reading 17, headword in
 │  ame-no-hi-ni  kasa-o  eki-ni  wasureta      │     rose700 + 2px underline (not colour
 │  rainy day     umbrella station  forgot      │     alone); gloss as an interlinear
 │  I left my umbrella at the station on a…    │     block: target / romanization / gloss
 │                                              │     aligned per chunk, caption italic
 │ ┌ GRAMMAR · た-form (past) ────────────────┐ │  ← insight as a SPECIMEN NOTE: a small
 │ │ Plain past of 忘れる; dictionary verbs   │ │     kraft label with a mono head naming
 │ │ drop る and add た.                       │ │     grammar_key, body 14. Collapsed to
 │ └───────────────────────────────────────────┘ │     its head line during review sessions
 ├ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ┤     (tap to open), expanded in browse
 │ SHIMOKITAZAWA · 14 OCT       next: ~10 days  │
 └──────────────────────────────────────────────┘
   [ Again 1m ] [ Hard 6m ] [ Good 10m ] [ Easy 4d ]   ← existing ramp, keys 8px shorter
```
Editing in browse mode: keep the per-field pencil discs exactly as they are now (`Field` in `StudyCard.tsx`). The touch model is already correct, and only the visual grouping changes.

Information hierarchy in one line: **word → sound → meaning → the moment → the sentence → the grammar.** That is recall-then-context, the order a learner checks themselves in.

### 3.4 Maturity states (from `lib/review.ts` phases)
| State | Rule | Visual | VoiceOver |
|---|---|---|---|
| **Fresh** | learning phase, `review_count` 0 to 1 | plain paper, pencil-grey hairline border; the sticker sits 2px raised (shadow `lifted`), as if just stuck on | "New card" |
| **Stamped** | review phase, interval < 21d | each successful review adds an ink stamp to the label row (◎). At ≥3 a small dated eki-style stamp is pressed in the stub corner, seeded rotation, rose700 or indigo ink at 85% opacity, 3 baked "missing ink" variants | "Reviewed 4 times" |
| **Foil** | interval ≥ 21d (Anki's mature threshold) | 2px gold-foil edge on the card (`foil #C9A24A` with a static diagonal highlight gradient via `react-native-svg` LinearGradient). The label number becomes foil-stamped. **Phase 2 (Skia):** tilt-driven holo on the sticker silhouette for the *focused* card only | "Mature card" |
| **Repaired** | `lapses` > 0 and currently relearning | foil (if earned) stays. A washi tape strip crosses one corner (seeded pattern and angle). Copy in the stub: "patched · 3 Nov". Lapses are care, not failure | "Relearning, patched once" |

The foil must never sit under text. It goes on the edge and the number, and the contrast of the text is unaffected.

### 3.5 Provenance variants
- **From a friend** (`source='challenge'`): the stub becomes a **postmark**, a circular stamp reading "MIKA · 3 OCT · OSAKA" overlapping the stub edge, plus a ✉ glyph. This is permanent and costs nothing (`origin_author_id` already exists).
- **On This Day** (≥1 year old): a small "1 YEAR" date stamp in the stub.

### 3.6 Session chrome
- **Top:** a ticket-style header, `TODAY · 12 STOPS` in mono, with a progress row of 12 small circles that ink in, replacing the plain counter.
- **Exit animations:** Good/Easy "file" the card right, with a slight drop into an implied drawer edge. Again slides it back under the deck (left and down, 0.96 scale).
- **Optional gesture:** swipe right for Good, always with visible buttons.

### 3.7 Dark mode: "the notebook by lamplight"
Not inverted. A warm, low-light set, so paper stays paper:
- page `#1F1A19` (lamp-dark walnut);
- card `#2B2422`;
- stub `#342B28`;
- text title `#F2E6DC`, body `#E8DCCB` (**12.7:1**), muted `#B8A8A0` (**7.5:1**);
- accent `#E4A0A1` (rose400 inverts to the light rose, **8.1:1**);
- stamp ink `#E4A0A1` / `#9DB0E0`;
- foil `#D9B87C` (**9.1:1**);
- grain overlay switches to a light-on-transparent PNG at 3%;
- sticker white borders stay white (they are physical);
- contact shadows become a darker halo, never white glows;
- the grade ramp keeps the Deep fills, which already carry white text.

`userInterfaceStyle` in app.json must change to `automatic`. **That is a native config change, so EAS.** The token work can land beforehand behind a dev-only toggle.

### 3.8 Accessibility checklist for the card
- **Contrast.** All text ≥ 4.5:1 on its own surface (ink500 for labels). Stamps that encode meaning (dates, the review count) are duplicated in text in the accessibility label. The headword in the sentence is underlined, not colour-only.
- **Dynamic Type.**
  - `hero` and `reading` scale.
  - `label` is capped at 1.4×.
  - At AX1+ the front's sticker shrinks to 55% width, and the back's photo collapses to a "Show the moment" row so the text column keeps 100%.
  - The grade row becomes a 2×2 grid at AX2+.
- **Reduce Motion.** Crossfade flip, no tilt or foil shimmer (static sheen), stamps fade in, no exit throws.
- **VoiceOver.**
  - The whole front is one element with the prompt plus the material state; the back reads answerLabel.
  - Decorative tape, grain, perforation and stamps are `accessibilityElementsHidden`.
  - Grade buttons announce the interval ("Good, next in 10 minutes").
- **Touch.** Keep skills #9 (gap ≥ slop sum). The new sound/take/record row keeps today's anisotropic slops.

---

## 4. First-run experience: the first sticker in under 60 seconds

**Today:** sign-up (username, email, password, language, optional avatar) → check-email confirmation → sign-in → an empty Collection saying "Tap the Scan tab…" → the AI consent gate → camera permission → scan. That is roughly 3 to 5 minutes, including a trip to the mail app, before any magic.

**Principle:** *show the magic, then ask for the account.* CapWords puts a live demo first. Tabi should go further: the user's **own** first sticker before sign-up, if the backend allows anonymous scans. Supabase anonymous sign-in exists and can be upgraded to email later. Check the RLS and rate-limit implications; that is an engineering decision, flagged rather than assumed.

| t | Screen | What happens |
|---|---|---|
| 0s | **Cover** | The notebook cover illustration, with the "Tabi Stickers" wordmark embossed. One line: "A sticker diary of the words around you." [Start] · small "I have an account". |
| 5s | **Pick a language** | Three big postcard tiles: Français (café chair), 日本語 (torii), 廣東話 (tram), each with a one-word sample stuck on ("café", "傘", "雪糕") and TTS on tap. Choosing *is* the first delight: the postcard flips and stamps. |
| 15s | **Demo peel (no camera yet)** | A pre-baked scene photo (a coffee cup on a table) animates the real reveal: the lasso draws itself, the cup peels off with sound, and it lands as a card showing "le café · luh ka-fay". It takes 6 seconds, is non-interactive, and is skippable. It teaches what will happen *and* hides nothing. |
| 25s | **AI consent, on-brand** | The same text as `AiConsentGate` (which names Google, Replicate and remove.bg; add Groq if it stays) as a paper sheet: "Your photo visits these helpers once, to cut it out and name it." [Sounds good]. Required before the camera per 5.1.2(i). |
| 30s | **Camera permission** | The system prompt, primed by the line "Find something near you, a mug, a plant, your shoe." |
| 35s | **Scan** | A coach overlay on the viewfinder: a dotted die-cut outline pulsing in the centre ("Fill this with one thing"). Shutter. |
| 35–45s | **The wait, dressed** | ScanProgress reskinned: the photo pinned to the notebook, a scissor glyph tracing the subject's bounding box while stages tick as ink checkmarks. |
| ~45s | **Peel + reveal** | The real cutout peels, and the word, reading and sound autoplay once. [Stick it in] drags or taps into the notebook. Stamp: "FIRST FIND · 29 OCT". |
| ~55s | **Save your notebook** | *Now* ask for the account: "Keep this sticker. Make your notebook." Email + password, or Sign in with Apple (recommended: one tap, no confirmation email, so the "<60s" survives). Username is generated (editable later) and the avatar is deferred. |
| after | **Land on home with the sticker on the wall** | A two-step coach only: (1) "Tomorrow it'll ask you what this is" pointing at the due capsule; (2) "Send it to a friend" pointing at Friends. Both are dismissible and never repeat. |

Notes:
- Email confirmation should not block the first session. Let the user in, and nudge to confirm later.
- If anonymous scans are not acceptable, the fallback is: Cover → Language → Demo peel → Sign in with Apple → Consent → Scan. That is still under 90 seconds and has no mail-app detour.
- **Learning on day 0:** the first card is not due until tomorrow (`NEW_CARD_REST_DAYS`). Offer an optional "Try it now" flip immediately after save, ungraded. That ties the capture loop to the study loop on day one.

---

## 5. Replacing system Alerts

There are 64 `Alert.alert` calls in 18 files. Three on-brand primitives cover them all. Build them once in `components/feedback/`, with one imperative API (`feedback.toast()`, `feedback.confirm()`), owned by a `FeedbackProvider` at root per skills #1.

| Primitive | Look | Use for | Examples |
|---|---|---|---|
| **Note** (toast) | A small paper slip that slides down from under the top inset with a seeded −1.5° tilt and a tape tab. Auto-dismiss 3s, swipe up to dismiss, an optional single action. `accessibilityLiveRegion="polite"` plus `AccessibilityInfo.announceForAccessibility` | Non-blocking outcomes: saved, copied, "Saved to Photos", a network retry failed, "Sticker removed · Undo" | `exportSticker.ts` ×3, save success, board removals (with **Undo** instead of a confirm) |
| **Slip** (confirm sheet) | A `BottomSheet.tsx` (already gestural, already routes all exits through `onRequestClose`, skills #8) with a title in heading 19, one body line, and buttons: primary rose700, destructive vermilionDeep fill, cancel text | Real decisions | Discard discovery, delete card, delete board, remove friend, block, logout, avatar choose/remove (an action-list variant) |
| **Stub** (inline state) | An in-place paper card inside the screen with an illustration, a one-line explanation and a button | Blocking states tied to a screen | "Daily limit reached" (show the stamp card of today's 10 finds plus "Back tomorrow at 00:00"), camera/photos permission (it already has an inline "Camera Access Needed" view, so extend that pattern), scan failed (on the viewfinder: "Couldn't cut that one out. Try more light or [Choose from photos]") |

Rules:
1. **Prefer undo to confirm** for reversible actions (remove from board, unfavourite, remove a voice take). Confirm only what is truly destructive.
2. **Delete account keeps a double confirm**, but the second step is a type-to-confirm field in the Slip, not a second Alert.
3. **Haptic:** a `Warning` for errors and nothing for toasts.
4. **Never stack:** a new Note replaces the old one.
5. **Migrate by file in order of user exposure:** scan → DiscoveryReveal → StudyCard → BoardCarouselPage → FriendProfile → profile → the rest.

Keep the system Alert only for OS-level permission rationale if needed, and for the crash ErrorBoundary.

---

## 6. Prioritised design backlog

Effort: **S** < 1 day, **M** 2–5 days, **L** > 1 week. Delight is 1 to 5. "EAS" means it needs a native build; per memory, ask first and batch them.

| # | Item | Effort | Delight | Build |
|---|---|---|---|---|
| 1 | **Ship a real app icon** (replace the Expo "A"; decide from the existing "Eight Marks" study) | S (design) | 4 | EAS (icon is native) |
| 2 | **Contrast and token pass:** introduce `ink500`, role tokens with aliases, labels to ≥4.5:1, tab icons to ≥3:1, caps on label scaling | S–M | 2 | JS |
| 3 | **ReviewSummary → stamp moment:** the day's cards fan out, then a rubber stamp hits today's page; stats in mono; "3 cards moved up a rung" | S | 5 | JS |
| 4 | **Specimen Card v1:** centred sticker on a backing well, radius 8, paper50 plus grain, label row, real SVG perforation, provenance stub, the back's hierarchy (hero word, meaning, sentence), WHERE/SHOT AT unified | M | 5 | JS |
| 5 | **Memory photo on the card back** (taped snapshot, tap to full-screen) | S | 5 | JS |
| 6 | **`lib/feel.ts` plus 8 foley sounds plus a Sounds toggle**; route all 51 haptic calls through it | S–M | 5 | JS (expo-audio installed) |
| 7 | **Maturity states:** stamps → foil edge → washi repair (static, no Skia) | M | 5 | JS |
| 8 | **Feedback primitives (Note/Slip/Stub)** and migration of the 64 Alerts, scan and reveal first | M | 3 | JS |
| 9 | **Discovery reveal as peel plus "Stick it in"** (two-layer lift, drag to save, CutoutSticker border, copy rewrite) | M | 5 | JS |
| 10 | **First-run flow** (cover, language postcards, demo peel, consent sheet, scan coach, deferred account) | L | 5 | JS; plus EAS if adding Sign in with Apple (`expo-apple-authentication` is native) |
| 11 | **Home de-duplication:** merge "Latest finds" plus "Latest stickers" into one rail, fix chip overflow, add tab-bar clearance on the grid | S | 2 | JS |
| 12 | **Illustration and stamp pack** (cover, 6 empty states, stamp set, tape set) and wiring into empty states and auth | M (art) / S (code) | 4 | JS |
| 13 | **Calendar visit stamps** (gentle streak) plus On This Day with "hide this memory" | M | 4 | JS |
| 14 | **Challenge as postcard** (stamp corner, postmark, city/date) plus the permanent "from a friend" postmark on won cards | M | 5 | JS |
| 15 | **Dark mode "by lamplight"** plus the Skia holo foil and tilt for the focused mature card, bundled into one dev-client build | L | 4 | **EAS** (`userInterfaceStyle: automatic`, `@shopify/react-native-skia`) |

**Suggested sequencing:**
- **Week 1:** 2, 11, 3, 5, 6, all small and JS. The app *feels* different by Friday.
- **Weeks 2–3:** 4, 7, 9, 8.
- **Weeks 3–4:** 12 (art in parallel from week 1), 14, 13.
- **Then:** 10 with the first EAS batch, together with 1 and 15. That gives one native build carrying the icon, Sign in with Apple, dark mode and Skia.

---

## Appendix: verified vs inferred
- **Verified by viewing:** the sign-in empty top half; the home masthead and wall; the duplicate recent modules; chip overflow; the tab bar overlapping the grid; the tab-icon contrast; the Expo default icon.
- **Verified by computation:** every contrast ratio quoted.
- **Verified by grep:**
  - 64 Alerts in 18 files;
  - 33 files with ActivityIndicator;
  - Reduce Motion only in StudyCard;
  - zero font-scaling caps;
  - light mode pinned;
  - memory photo unused by StudyCard;
  - StudyCard flip on legacy Animated;
  - DiscoveryReveal on RN Image.
- **Code-read only (not seen rendered):** scan, reveal, study card, summary, boards, calendar, friends, profile. Only 2 Maestro flows exist, so there are no screenshots of these. **Recommendation:** add `takeScreenshot` steps to `.maestro` for each main screen, so design reviews can work from pixels.
