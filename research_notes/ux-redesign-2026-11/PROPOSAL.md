# Tabi Stickers: "Finished" redesign, the final proposal (2026-11-13)

This is the moderator's synthesis of two rounds by seven roles: designer, interaction, learning, accessibility, engineer, serious-learner critic and casual-learner critic. Their files are in `team/`. Every point below was either agreed by all seven or decided by measured evidence. The decision log is at the end.

## The idea in one paragraph
Tabi currently looks like three different apps: a pink band, monospace labels and a floating pill. Underneath, two loops are fighting each other. The finished app is **one calm system** where two things matter. The **due card** is the serious learner's door. The **sticker** is the casual learner's reason to open the app. Everything else gets quieter. Warmth lives in the photos, empty states and customisation, not in chrome. The study loop is a fast, quiet, one-screen flashcard.

## 1. System (applies everywhere)

### Colour: Powder (unanimous after round 2)
Contrast is measured with the WCAG formula. Scripts are in the scratchpad (`contrast.py`, `r2.py`, `final_ramp.py`).

| token | light | dark | notes |
|---|---|---|---|
| page | #F8FBFF | #0E1626 | pageTop gradient #E4F0FB→page, first 240px only |
| card (E1) | #FFFFFF | #18233A | dark elevation = lighter surface, no shadow |
| raised (E2) | #FFFFFF + shadow | #213050 | |
| sand (wells, inputs) | #EEF5FC | #131D31 | |
| tint (warm accent wash) | #FFE9DD | #3A2B2C | |
| head | #24406B (10.0) | #EAF2FF | |
| body | #2E3A4E (11.5) | #C5D2E6 | |
| cap (lowest text tier) | #52627C | #9FB0CB | **no "faint" text tier**: today's #C4A9AB is 2.0:1 |
| hairline (decorative) | #C9D8EA | #2A3956 | |
| inputBorder (≥3:1) | #7A90B0 | #6C82A6 | |
| action fill | #F2A27A | #F2A27A | **one per screen**, never on the study screen |
| action ink | #1B3359 (6.14) | #14213A (7.8) | white on peach is forbidden (2.05) |
| action edge | 1px rgba(27,51,89,.24) | none | peach is only 1.98 on the page |
| actionText (peach as text) | #B4501F | #F2A27A | |
| selected (chips, tab) | navy #24406B fill / white | #EAF2FF / #0E1626 | blue is **never** used for selection or links |
| error | #B3363F | #FF8A8F | |
| success | #2F7A4F | #6FCB93 | |
| shadow tint | rgb(36,64,107) | none | |

**Grade row** (its own tokens; no brand colour; red→green, with a blue Easy):
| grade | weight | light | dark | glyph |
|---|---|---|---|---|
| Again | primary, solid | #B3363F / white 5.97 | #C8454E / white | rotate-ccw |
| Hard | secondary, outline | sand fill, 1.5px #8A5A00 border, ink #6B4600 | border #E0BB78 | minus |
| Good | primary, solid | #2F7A4F / white 5.23 | #6FCB93 / #0E1626 | check |
| Easy | secondary, outline | white fill, 1.5px #2B6CB0 border, ink #1F5596 | border #8DB4FF | chevrons-right |
CVD ΔE (deuteranopia/protanopia): Again–Easy 75/54, Hard–Easy 95/87, Again–Good 16/15. Again–Good is moderate, so the glyph and label carry it. Colour is never the only cue.

### Type
- **UI chrome: Figtree** for everything (400/500/600/700; JS-only via @expo-google-fonts). Newsreader and JetBrains Mono are removed.
- **Learning-language text: Teacher's hand.** Klee One SemiBold for fr and ja, Iansui for yue. This covers headwords, example sentences and endonyms.
- Scale (pt): display 34/700 · title 28/700 · h2 22/600 · h3 17/600 · body 16/400 (lh 24) · callout 15/500 · caption 13/500 · overline 12/600 uppercase +0.6 tracking (**at most 3 per screen**). Headword 40 (CJK ≥ 28), reading 15.
- **Never uppercase or letter-space CJK.** Romanisation (IPA, jyutping, furigana) uses Figtree 15, not monospace.

### Space, shape, depth
- 4pt grid. Screen gutter 20. Section gap 28. Card padding 16/20.
- Radii: **12** (controls, inputs, thumbs), **20** (cards, sheets), **999** (pills, buttons). Nothing else.
- Elevation: E0 page, E1 = hairline + 0 1 2 @6%, E2 = 0 4 16 @10% (tab bar, sheets, current study card). No shadows on buttons.

### Components (new `components/ui/`)
`Text` (variants from the scale), `Button` (primary peach 52h / secondary card + navy@16% border / tertiary text), `Chip` (36h, selected = navy), `Card`, `ListRow`, `ScreenHeader` (title 28 + 40pt avatar button → Profile; replaces 6 hand-made gear buttons, including the one under the status bar on Boards, `wall.tsx:155`), `EmptyState` (one illustration, one line, one button), `InlineError` (Retry), `Snackbar` (undo), `Sheet` (wraps today's BottomSheet; lesson 8).

### Motion and haptics (JS-only: reanimated 4.1, expo-haptics)
- Press: scale 0.97, spring {damping 18, stiffness 400}. Sheets keep spring {22, 260} with a 210ms exit. Tab content crossfades over 150ms. Card flip is 320ms ease-out cubic (today 420). The next card enters from the right in 260ms.
- `useReducedMotion` everywhere: every animation goes through one `motion` helper. Only StudyCard honours it today.
- Haptics: selection on chips, tabs and segmented controls; light on reveal; light on Good/Easy; warning on Again; success when a sticker is saved; medium on shutter and long-press.

### Copy
Sentence case. No emoji in chrome. No "cozy corner". Errors say what happened and how to fix it, inline with a Retry button, instead of `Alert.alert` (61 call sites, migrated progressively). The photo-scan error stops saying "Couldn't find the word".

## 2. Navigation
- A full-width tab bar replaces the floating pink pill: card colour, hairline top, E2, 56pt + safe area. It has **icon + label** for **Collection · Calendar · [Scan] · Boards**. Active = navy icon/label + 3px peach dot. Collection shows a due-count badge.
- **Scan** is the centre item: a 52pt peach circle (navy camera glyph), raised 8pt. It opens a **full-screen modal** and never shows a selected state.
- **Profile** opens from the avatar in every `ScreenHeader`, as a sheet (detents 0.6/1 if SDK 54 supports it; otherwise a pushed screen).

## 3. Screens

### Collection (home)
Top to bottom:
1. ScreenHeader "Collection" + search icon + avatar.
2. **Due card** (E1). It shows "12 due · about 4 min" plus a primary **Start reviewing** button. A one-line forecast follows: "18 tomorrow · 41 this week". When nothing is due it becomes "All caught up" with a secondary **Take today's photo** button, which opens Scan.
3. **On this day** strip, shown only when there's something to show: one big sticker from a past date and its word. It's the casual learner's warmth, at zero cost to the serious learner.
4. Filter chips (All, boards/categories, Due, Favourites) with sort as a trailing icon button. **No overlap.** The chip row scrolls with an edge fade.
5. **Grid**, 2 columns, gap 12. Each cell has the sticker on white, the word in Klee/Iansui 17, and the meaning in Figtree 13 cap.

**Removed:** the rose band, the "Latest finds" and "Latest stickers" duplicates, GOAL 5 and the mono "FOUND TODAY" header. The Arrange wall moves to Boards.

### Study session (the core loop)
- Top bar: X (accessibility label "Close this card"), a 4px progress bar (navy on sand), and the count "2 / 2" in caption. **No share, download or delete during review.** Those live only in card detail.
- **Front:** the sticker photo (max 55% height), centred, with the prompt "What did you call this?" and "Tap to reveal". Nothing else.
- **Back:** word (40, learning font) → reading + speaker inline → meaning (Figtree 20) → example sentence (learning font 19) with its translation in cap. Grammar breakdown is folded behind "Grammar". **One** muted memory line ("Found 12 Nov · Kitchen") appears only when the data exists (no "Not recorded") and opens card detail as a sheet.
- **Grades:** always four buttons, 56h, radius 14. Again and Good are solid and larger (flex 1.25); Hard and Easy are outlined (flex 1). Each shows its label, glyph and interval. The accessibility label keeps "Good — next review in…".
- Optional swipe on the back only: left = Again, right = Good (72pt or 600pt/s). The card follows the finger with ≤8° rotation. **Undo snackbar** for 5s (needs a `lib/review.ts` undo, client-side).
- Profile setting: **Simple grading** (Again / Good only) for casual learners. The scheduler itself is unchanged.
- **Session done:** cards reviewed, the grade mix as a small bar, "Next: 18 tomorrow", and one Done button. No confetti.

### Card detail / edit
The same card component as the study back, in "detail" mode. Fields show a 20px pencil icon, not dashed boxes. The memory section (photo, date, place, note) is shown in full here. Share, Download and Delete go in a "…" menu, with Delete in red, last and separated (lesson 9).

### Calendar: the photo diary
- ScreenHeader "Calendar". No segmented control, no gear.
- Month grid: 44pt cells. Days with finds show the sticker thumbnail (radius 12). Today has a navy 2px ring. Month swipe plus chevrons.
- Below it: a "This month" strip ("23 finds · 6 days").
- Tapping a day opens the Day screen: a big sticker per find with its word and note.
- **The review forecast moves out of Calendar** to the Due card (tomorrow/week line) and to **Profile → Stats** (14-day forecast bars, retention %, reviews/day). Calendar becomes memory, not homework.

### Scan
- A full-screen modal with the camera as the page: full-bleed viewfinder and an X at top-left. Shutter 72pt; Gallery and Type a word are secondary pills flanking it. The hint shows once in an overlay chip, with no overlap.
- **Consent** is a first-run bottom sheet over the live viewfinder, not a dead page.
- **Processing** shows staged progress ("Cutting out… Finding words…") over the frozen photo. **Errors** appear inline with Retry and correct copy.
- **Result:** the sticker lifts out with a 220ms spring, followed by the scene-word picker. Both critics named this the product's best moment, so keep it and give it room. One primary: **Add to collection**.

### Boards
- ScreenHeader "Boards" + "+" (new board) + avatar.
- A 2-column grid of board thumbnails. The **Arrange wall** (the home sticker wall) lives here as the first board, "My wall".
- Empty state: one illustration, one line, one **New board** button. The dashed duplicate tile is removed.
- Each board has **Study this board** in its menu.

### Profile
A sheet with these sections:
1. You: avatar, username, language.
2. **Stats**: forecast, retention, streak-free counts.
3. Study: daily new-card limit, Simple grading, swipe grading on/off.
4. Appearance: Light/Dark/System. This works once the native flip ships (see §4).
5. Account.

It uses ListRow everywhere. Captions are cap #52627C, never faint. The emoji greeting goes.

### Auth and onboarding
- Sign-in sits in the upper third with a small sticker-cluster mark, the overline "WELCOME BACK" (Maestro), and 52pt inputs on sand with inputBorder.
- Sign-up: 3 short fields, then a language picker with endonyms in the learning fonts.
- Check-email and Forgot follow the same layout.

## 4. What ships how
- **JS-only (OTA once a build with expo-updates is out):** everything above except the next line.
- **One native rebuild, batched, after the owner says yes:** `userInterfaceStyle: "automatic"` (dark mode). Dark tokens are built and testable in JS beforehand via a dev override. Skipped for v1: expo-blur, SF Symbols, native tabs, UIMenu.
- **Fonts:** Figtree (small), Klee One (6.5 MB) and Iansui (8.2 MB) are all bundled through expo-font.

## 5. Build order (each phase leaves the app shippable)
1. Tokens + `ThemeProvider` (light now, dark ready) + Figtree + learning fonts + `components/ui/` primitives.
2. Navigation: ScreenHeader, tab bar, Scan as modal, Profile from avatar.
3. Study loop: card, grade row, swipe, undo, summary.
4. Collection home.
5. Calendar diary + Profile/Stats.
6. Scan modal + inline errors.
7. Boards + wall move.
8. Auth/onboarding, Alert→InlineError sweep, reduced motion everywhere, cleanup (lint: no new hex/fontSize literals).

## 6. Approved Maestro strings
All are kept: 'WELCOME BACK', 'Email', 'Password', 'Sign In', 'Not Now', 'FOUND' (*see note*), 'Start reviewing — 1 card due.*', 'Tap to reveal.*', 'What did you call this\?', 'Good/Again/Easy — next review in.*' (accessibility labels), '2 / 2', 'Close this card', 'Session done', '1 card reviewed', 'Done'.
**Note:** 'FOUND' is matched on Home today ("FOUND TODAY"). The Due card's subline must still contain "found" in a visible text, e.g. "1 found today". 'Start reviewing — 1 card due' must stay the button's accessibility label.

## Decision log (contested → resolved)
| question | outcome | why |
|---|---|---|
| Rose vs Powder | Powder, 7–0 after round 2 | Rose's action #9D4D51 is ΔE 9/5/3 from Again (the same colour); Powder's peach is ΔE ≥31 from every grade; Powder works better in dark mode; warm photos stand out on cool white |
| Blue vs green Easy | Blue #2B6CB0 | green and teal collapse under CVD (ΔE 6–20); blue holds 54–95; blue's conflict with "selected" is removed by making selection navy |
| 2 vs 4 grades | 4, with Again/Good primary; Simple grading as an option | both critics converged; the scheduler is unchanged |
| Swipe up = Easy | dropped | accidental-grade risk; Easy stays a button |
| Home hero | Due card, then On this day, then grid; the wall moves to Boards | serious learners need the door; casual warmth is kept via On this day |
| Calendar's job | photo diary; forecast → Due card + Profile Stats | 5 of 7; one screen, one job |
| Memory on study card | one muted line on the back, only when present | learning withdrew the note-on-front idea; casual accepted |
| Share/delete in review | removed | destructive action mid-review (moderator, critics) |
