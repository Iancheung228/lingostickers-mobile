# UX polish sweep — findings (2026-10-30)

Four simulated users drove the app on four Simulators at once (iPhone 18 Pro ×2, 18 Pro Max, SE 4.7")
as the QA account. Scoping only — nothing was changed. Raw per-tester logs (with screenshot paths, which
live in a temporary scratchpad) are in `raw/`. Tester key: **A** Mia, beginner — scan/create · **B** Daniel,
ex-Anki power user — collection · **C** Kenji, one-handed commuter — study/calendar · **D** Priya, sceptic on a
small phone — friends/profile/auth. "×2" = found independently by two testers.

## P0 — fix before submission (broken or misleading on a core path)

1. **Collection search is unusable.** The magnifier focuses a field rendered ~1.3 screens down, under hero +
   Latest finds + Latest stickers; the keyboard covers it — no visible input, results, or Cancel. (B; verified
   by coordinator from screenshot; `app/(tabs)/collection.tsx` ~286)
2. **Scans hang 35 s – 2.5 min, then fail with the wrong message.** 4 of 5 scans sat on "Looking up the word"
   then alerted "Extraction failed — This took too long and was cut off" although the cutout had succeeded.
   No client timeout, X does nothing during the wait, no manual-word fallback. May be partly backend load
   from 4 parallel testers — needs a solo re-test + function logs before blaming the app. (A; `scan.tsx:254`)
3. **New cards dated by the photo's EXIF date, not the day they were made.** A 2018 photo gives "30 Mar ·
   DAY 3136"; "FOUND TODAY" stays 0 after adding 3 cards; new cards sort below yesterday's. (A, B ×2)
4. **Sign-in on small phones: Sign In hides under the keyboard** once fields are filled (and the error banner
   pushes it further). Only the keyboard's return key reliably submits. (coordinator, D ×2)
5. **Review label vs behaviour.** "Good — next review in 10 minutes" then the same card immediately returns
   ("2ND REVIEW"), counter grows 1/1 → 2/2, "Session done: 2 cards reviewed" for one card. The re-show is the
   intentional Anki learn-ahead (`lib/review.ts:91`, `StudySessionHost.tsx:64`) — the fix is the copy/counter,
   not the scheduler. (C)
6. **No feedback after "Add 3 cards".** Sheet closes onto a black camera — no toast, count, or link to where
   the cards went. (A)

## P1 — App Store / trust / account hygiene

7. Raw backend error copy: "Invalid login credentials" (coordinator, D ×2). No client-side email validation on
   sign-in or forgot-password ("notanemail" enables Send Reset Code). (D; `sign-in.tsx:24`, `forgot-password.tsx:22`)
8. Usernames accept spaces/punctuation ("a b!tabc" → "Username available") — then unsearchable in friend search. (D)
9. iOS "Save Password?" offered after a **failed** login. (D)
10. Profile lacks: app version, Terms/EULA link, data export, ways to change username/display name/email/password. Sign-up shows no Terms/Privacy notice. (D)
11. "Report a problem" shows your personal Gmail as its subtitle; Privacy Policy leaves the app for Safari. → support@ address, in-app browser. (D)
12. Internal id visible to users: "CARD 9668 · FR" on the review card and detail. (B, C ×2)

## P2 — UX: confusing or inconvenient

**Scan / create (A)**
- No "type a word" entry point on Scan or Home — the feature is only reachable via scene chips after a scan.
- Scan consent: "Read the privacy policy" sits under the floating tab bar; "Agree & Start Scanning" jammed against it. (A, C ×2)
- "More words from this photo" duplicates the visible MORE FROM THIS PHOTO chips and seems to do nothing; "Retry" is ambiguous.
- Unselected scene chips look disabled.
- Crop screen: "Extract Sticker" is both title and button (same VoiceOver label); handles half off-screen and box larger than the photo by default; portrait photos put the bottom handles on the Extract button; photo jumps ~90 px when extraction starts.
- Scene cards reuse the full photo, so "un pétale" and "une plante" look identical — no hint what each word points at.

**Home / habit loop (C, A)**
- Nothing-due state: the due pill just vanishes — no "all caught up · next due in …", no reviews-today count, no streak anywhere. Header counts only finds, so a review-only day reads "0 FOUND TODAY".
- First-time home: same sticker repeated in three modules; no "scan your first sticker" call to action; floating tab bar covers content; "Study" chip cut off by the sort icon.
- Tap targets: home search/settings ~15×15 pt; calendar month arrows ~20 pt; review delete sits next to save at the top.

**Calendar (C)**
- Reviews mode: day cells don't respond (drill-down only in Finds mode, `calendar.tsx:313`); unexplained hollow dot / ringed number, today unmarked despite a review; no way to see past reviews.
- "1 DUE IN 7 DAYS" ambiguous; week bars have no numbers; an empty month is a blank card with no message.

**Collection (B)**
- Favourites filter at zero shows "No stickers yet" title; Latest finds/stickers above stay unfiltered, so filters look broken.
- Sort: "Latest first" vs "Recently added" indistinguishable; no A–Z / due / difficulty; tap-cycles with unclear current mode.
- Three blocks (hero, Latest finds, Latest stickers) before the real grid, the same sticker in all three; "Latest stickers" is a nested scroll box that cuts rows in half.
- Mixed date formats ("18h ago" vs "30 Mar"). Delete confirms but has no undo.
- Power-user gaps (see Ideas): no bulk select, export, tags/decks, scheduling info, sort by due.

**Profile / settings / auth (D, A)**
- Scan header gear opens "My Profile" — gear position differs on every tab and is clipped against the status bar on Boards. (A, C)
- Blank white circle top-right of Profile looks like a button but is a spacer (`profile.tsx:190`). (A, D ×2)
- Log Out label pale grey, reads disabled (`profile.tsx:594`). Friends' only CTA "Find a friend" also reads disabled (`components/FriendsEmpty.tsx:36,68`).
- Sign-up on SE: "Already have an account? Sign In" at the very bottom edge; the "Sign Up" link is a ~14 pt target merged into one accessibility element.

## P3 — Visual polish

- Capitalisation inconsistent everywhere: "Apple"/"apple", "La fleur"/"un pétale", "The Flower"/"a plant". (A, B, C ×3) Pronunciation mixes respelling "[la flur]" with IPA "[pɔm]". (A)
- Wording: Profile says "watercolor memories"; everywhere else "stickers". (A, D ×2)
- Selected Box/Lasso pill: dark text on dark red, nearly unreadable. (A)
- Sticker detail: photo left-aligned at ~2/3 width with large void; back face empty under "In use"; pencil circles clipped. (B)
- Pro Max: Latest finds is one narrow tile with ⅔ of the row empty; a single filter match renders full-width and giant; category chip row clipped at the right. (B)
- Boards empty state has two "new" controls and no title. (C)
- Day screen: "Shot at: Not recorded" row wastes space; shows a gear but no tab bar. (C)
- Auth screens inconsistent: plain cream sign-in/sign-up (~35% empty above the hero, no logo) vs illustrated night sky on forgot-password, where the title has weak contrast and a cloud drifts over it with the keyboard up. (D)
- Photo cards vs die-cut stickers very different visual weight in the grid. (B)

## Accessibility

- VoiceOver: "about 1 minutes" (C); language/wall-style rows don't announce selected state (D); crop title/button same label (A); bottom auth links merged into one element (D).
- Possibly: hidden tab (scan consent) elements exposed while on Home — unconfirmed, the hierarchy tool was unreliable across devices. (C)

## Ideas (not bugs)

- Session-end screen: next-due time, streak, "study ahead". Progress bar instead of a growing N/M counter. (C)
- Anki-grade management: bulk select, export (CSV/apkg), custom tags/decks, show category on detail, per-card scheduling info (due, interval, ease, lapses), sort by due, table browser. (B — ties to the "better Anki" pitch)
- Undo snackbar for delete. (B)
- Manual-word fallback when a scan's lookup fails. (A)

## Keep — what testers liked

- Grade buttons: bottom, thumb-reachable, red→green, concrete intervals. Card layout and "tap to reveal · pull down to close" hint. Calm "Session done". (C)
- Edit sheet: grabber, scrim closes when clean, warm helper copy; clear delete confirm; well-structured detail back with per-field pencils and audio. (B)
- Extraction progress checklist; rich discovery sheet; scene chips in ~1 s; honest "word service is busy" copy; selected-chip state and "Add 3 cards". (A)
- Friend search: debounced, hint, empty state, username-only RPC that honours blocks. Honest Delete Account and Log Out confirms. Good empty-state copy (Friends, Blocked). Sign-up language pills, live username check. Small-screen fit of tab bar / Friends / Profile. (D)

## Not covered (follow-up)

Camera and lasso drawing (Simulator / Maestro limits) · check-email screen (needs a real sign-up) · challenges
(QA account has no friends) · avatar crop · saving edits, discard-draft prompt, search results, Arrange mode
(blocked by the search bug) · Discard/Retry/"Ask your own"/"Say it like a local" after a scan (blocked by hangs) ·
dark mode, Dynamic Type at large sizes, landscape, offline/airplane mode — none were tested.

## Housekeeping

- Cleaned up after the sweep: QA account reseeded (back to just "pomme", due); the three extra Simulators deleted.
- AI budget: 56/100 used on 2026-10-30.
