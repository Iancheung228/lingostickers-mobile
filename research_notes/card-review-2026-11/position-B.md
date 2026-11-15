# Position B: product design / mobile UX

Read: BRIEF, prod 01/02/06, dev 01/02, lib/review.ts, lib/reminder.ts.

## 1. Card shape
**Pick:** Production flip card is THE card. Front: date header, big sticker, nothing else (drop the "Add what happened" dashed box from the front; it competes with the sticker, so it moves to Details). Back, labelled rows: WORD (with the speaker inline), SAY IT, MEANS · POS, IN USE, then per-row pencils. Dev's forms/notes slot in as extra rows only when the POS has them. A single quiet "Details" text link under the rows opens a sheet with progress, record/compare, where/when. The primary button is "Test me" only on the keepsake face.
**Confidence:** med-high.
**Reasons:**
- The prod card is the App Store look the owner likes.
- Labelled rows teach the structure, which is what a customisable Anki needs.
- Dev's detail page is a scroll of everything and loses the "one thing per screen" calm.
**Risk:** the prod back has a large empty area and 4 pencils, which is noisy. Show pencils only after a tap on "Edit" (or a long-press on the row), not permanently.
**When:** v1.

## 2. Opening from Collection
**Pick:** Disagree with the write-up. Open on the FRONT (sticker only), with a visible "Tap to flip" cue. Do not open on the answer. The sticker is the memory, and the picture is the delight. Opening on the answer makes browsing feel like reading a spreadsheet, and the sticker-wall grid is the product's emotional core. But remove prod's quiz-first framing. The front must not say "What did you call this?"; replace it with the sticker's date plus the word peeking at the bottom edge. Exact front footer: the word in the display font, with a small "Flip" affordance. So the front is a keepsake and the back is reference. No grading here, and no schedule writes.
**Confidence:** med (I'm not sure; the team should test a 3-person gut check).
**Reasons:**
- A quiz prompt on a browse tap is a trap, because people who open a card to look something up get a pop quiz.
- Showing the word on the front removes ambiguity about what the screen is for.
- Review is the only place that quizzes.
**Risk:** the word on the front weakens the "recall" feel if people use browse as a free quiz; that is fine, it is Practice (see 7).
**When:** v1.

## 3. Review entry
**Pick:** One place: a "Today" card at the top of Collection, above "Your words", under the sticker wall. It is NOT in the header chip (the header is already carrying search and filter, and a chip reads as a filter). The card has one line plus one button. Due: "5 cards · about 1 min" with a rose "Start" button. Nothing due: "All caught up. Next one tomorrow." with no button. The session is "Quick 5" internally; user-facing copy says "Review". Rename "Quick 5" to "5 cards" so the label never lies when only 3 are due. After a session: "Another 5?" (offered once, never pushed). Delete the separate "Anki" section. The same state sits as a dot on the Collection tab icon, because the tab bar stays 5 slots.
**Confidence:** high on a single place, med on Collection over Home.
**Reasons:**
- It is where the user already browses, so there is no new tab.
- A card matches the Rose language.
- It is calm and has a clear empty state.
**Risk:** the card pushes the grid down by about 70pt. Mitigation: make it a slim 56pt row.
**When:** v1.

## 4. Reminders
**Pick:** v1 keeps one daily time (Profile, "Review reminder", time picker, off by default, permission asked on switch-on). Copy: "5 stickers are ready. About a minute." The 1-3 slices go later, after the single time is trusted. The catch: a repeating local notification cannot be silent when nothing is due, because the OS fires it regardless. If v1 stays JS only, reschedule on every app open or foreground, and schedule the next ~7 days of one-shot notifications from `dueCountsByDate`, skipping empty days. State this limit plainly. Never write "0 due" in a notification.
**Confidence:** med.
**Reasons:**
- A notification about nothing teaches users to disable all of them.
- Multiple slices add settings UI, and settings sprawl is the opposite of calm.
**Risk:** the forecast goes stale if the user doesn't open the app for a week. Accept it and fall back to a generic "Your stickers are waiting".
**When:** v1 single time with skip-empty-days; multi-slice later.

## 5. Lapses
**Pick:** On "Again", keep 25% of the interval, floor 1 day, ceiling 14 days (`LAPSE_MULTIPLIER = 0.25`). Not a reset to day 1, because that punishes a slip on a 60-day card as if it were new. FSRS later. The button copy stays "Again" (don't rename it).
**Confidence:** med (the number is Anki's default 0, but a mid value is kinder).
**Risk:** the value is arbitrary and the sample size is small.
**When:** v1, a one-constant change; add a test in test-review.mts.

## 6. Backlog
**Pick:** Never show a total. Show "5 cards · about 1 min". A daily cap of 20 reviews by default, with an "I have more time" path through "Another 5?". After 3 or more days away, a "Welcome back" catch-up shows only the oldest-due 5 first, and the rest roll quietly. No red badges and no streak-loss messaging.
**Confidence:** high.
**Risk:** hidden overdue cards silently go stale; the cap must still advance the schedule fairly.
**When:** v1 (cap and wording); catch-up smoothing can wait.

## 7. Practice mode
**Pick:** In a board's "..." menu and a day's sheet: "Practice these". The session uses the same card UI with a pale "Practice" banner and no grading buttons, just "Got it" / "Not yet", which touches no schedule. It is not a second tab.
**Confidence:** med.
**Risk:** two quiz modes can confuse; the banner must be unmistakable.
**When:** later (v1.1). Keep v1 small.

## Top 3 must-haves for v1
1. Prod flip card as the single card; the front is sticker-only (no quiz prompt) and the back has the labelled rows plus a Details sheet.
2. A single Review "Today" row on Collection with soft copy ("5 cards · about 1 min"), plus a calm empty state.
3. Soft lapses (25%) and a cap, with a reminder that skips empty days.

## Rebuttal

(a) Cap: I concede 40, learning cards exempt. My 20 was about calm, but the calm comes from never showing the number and from sessions of 5, not from the cap. 40 does not hurt retention and is rarely felt.

(b) Lapses: I take A's 0.3, the 1-day floor and the leech flag. I drop my 14-day ceiling, because it is arbitrary and A's numbers (30d gives 9d) already behave. Leech copy: "Tricky word. Want a new example?". The 1.5 ease floor is fine and invisible to users.

(c) Reminders: C's planReminders plus foreground rebuild answers my objection, so I move to up to 3 times in v1. UI is a single "Review reminders" row on Profile: "9:00, 13:00, 19:00" chips and "Add a time" (max 3), default 1. Body: "5 stickers ready. About a minute." Today and tomorrow carry numbers, later days read "Your stickers are waiting".

(d) Practice v1: I concede. It is small, and the zero-write guard is the real work. It also gives "Test me" somewhere to go. Banner copy: "Practice. Doesn't change your schedule." Buttons: "Got it" / "Not yet".

(e) Placement: I change my mind. A Today card on the Collection band, no header chip (a chip reads as a filter). Copy: "Today" / "5 cards · about 1 min" / [Start]. Empty: "All caught up. Next one tomorrow." After a session: [5 more]. The tab dot stays.

(f) Restyle CardView: C is right on engineering. Reviving 1600 fused lines risks the live app. The owner liked a look (white card, date header, labelled rows, Where/When), not main's code, so the restyle is safe if I add one guard: a side-by-side screenshot of main versus dev for the front, the back and the grid, signed off before merge. I also still hold that the front shows the word (A and C agree on the answer face; I'll accept the answer face if the owner prefers it).
