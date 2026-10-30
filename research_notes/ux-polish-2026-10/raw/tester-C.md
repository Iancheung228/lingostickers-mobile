# Tester C findings (habit loop) — Kenji persona
Shots in this dir: 01 home, 03 revealed card, 04/05 re-shown card, 06 session done, 07 home after, 08/09 calendar, 12 day screen, 13 empty month; o12/l/takeScreenshot/C/{boards,friends,scan}.png

### [BUG] Graded card re-appears immediately, counter inflates, summary says "2 cards reviewed" for 1 card
- where: Review session (home "1 due" -> card)
- did: graded only due card "pomme" Good (button said "next review in 10 minutes") -> counter went "1 / 1" to "2 / 2" and the same card showed again at once ("2ND REVIEW"); graded Good again (1d) -> "Session done · 2 cards reviewed · 2 recalled".
- expected: label promised 10 min; one card = 1 reviewed. Reads as a bug and as padded progress.
- evidence: 04.png, 05.png, 06.png

### [UX] Nothing replaces the "1 due" pill when the queue is empty; no sense of progress on home
- where: home header after Done (07.png)
- the pill just vanishes; no "All caught up / 1 reviewed today / next due tomorrow". Header only says "0 FOUND TODAY, GOAL 5" (goal is about scanning; Kenji reviews, so he sees 0). No streak anywhere (home, calendar).
- idea: show "Caught up · next due tomorrow" + reviews-today count; add streak chip; make goal count reviews too or explain GOAL 5.

### [UX] Calendar "Reviews" mode: day cells not tappable, markers unexplained, today shows nothing
- where: Calendar > Reviews (09.png)
- 29 shows a faint hollow dot, 31 a ringed "1", today (30, with 1 reviewed per week bar) shows no marker. No legend for dot vs ring. Tapping 29/30 does nothing (code: calendar.tsx:313 Finds-only drill-down). Past reviews cannot be inspected.
- idea: legend line; tapping a day lists what was reviewed / due; mark today's reviews.

### [UX] Calendar header "1 DUE IN 7 DAYS" ambiguous; week bars have no numbers
- 08.png. Reads as "due in a week"; 31 Oct has 1 due (tomorrow). Week bars unlabelled values; empty month (13.png) is a big blank card with no message.

### [UX] Tiny, top-of-screen tap targets (one-handed)
- Home search and settings icons are 15x15pt hit boxes at top-right (hier: [336,66][351,81]). Close/Share/Save/Delete in review at top (36pt), delete sits beside save — a mis-tap risk, no confirm seen (not tested). Day screen back arrow top-left. Calendar month arrows ~20pt.
- idea: bigger hit areas (hitSlop >= 44), move rarely-used delete into a menu.

### [VISUAL] Boards: settings gear collides with status bar; duplicate "New" affordances
- boards.png: gear is clipped into the top edge beside the battery icon (no safe-area inset), unlike Friends where it sits lower. Gear position differs on every tab (home, calendar, friends, boards, day). Empty state shows both "+ New board" button and a dashed "+ New" tile; no title.

### [VISUAL] Scan consent screen: "Agree & Start Scanning" button touches the floating tab bar (scan.png). Also a11y/hier dumps from home sometimes list the scan consent screen elements (hidden tab rendered, maybe VoiceOver-visible) — code not checked.

### [UX] Accessibility copy: home pill label "about 1 minutes" (hier); grade labels fine. Card shows internal "CARD 9668 · FR" id (03.png) — jargon for users. "Shot at: Not recorded" row wastes space for non-photo/no-location cards.

### [VISUAL] Day screen shows gear + no tab bar; "Apple" capitalised vs "apple" in review (12.png vs 03.png).

### [IDEA] Review session end: add next-due time, streak, "study ahead" option; show a mini progress bar instead of "1 / 1" (counter grows with relearns).

## Positive
- Grade buttons at bottom, thumb-reachable, colour ramp red->green, with concrete intervals (1m/6m/10m/4d) and intervals change per step — great.
- Review card layout (word, IPA with speaker/mic, means, in use) is clean; "Tap to reveal · pull down to close" hint helpful.
- "Session done" modal is calm and clear; tab bar floating pill is consistent on all tabs; Friends/Boards empty states have helpful copy.
- Calendar week strip with Finds/Reviews toggle is a nice at-a-glance idea.
