# Position A — learning science / spaced repetition

Facts from code: lapse now = `LAPSE_MULTIPLIER 0`, floor `MIN_LAPSE_INTERVAL_DAYS 1` (lib/review.ts:78,80), then relearn 10m (`RELEARNING_STEPS_MIN`, :63) and graduate onto the parked `interval_days` (:230, :260). Learning steps 1m/10m, graduate 1d, Easy 4d. `dueToday` (:405) is uncapped, due_at <= now. `limitNewCards` caps only new cards (studyQueue.ts:12). Reminder is one repeating DAILY notification with a fixed body (reminder.ts:72-77), so it cannot be "silent when nothing is due."

## 1. Card shape — restore production flip card, port dev parts
Pick: production card as the face; progress/record/compare behind "Details"; Test me stays. Confidence: med. Reasons: the keepsake face is a recognition-and-context cue (photo, where/when), which is the strongest encoding in this product; labelled rows reduce effort on the back; Details keeps the answer side short, which keeps reviews fast. Risk: per-row edit on the back invites fiddling mid-review; edit must not be reachable from the review grading surface. When: v1 (visual, client-only).

## 2. Collection opens on the keepsake face; quiz only in Review
Pick: agree with the write-up. Confidence: high. Reasons: browsing is not retrieval practice; quiz-first on browse is accidental testing and, if graded, corrupts the schedule (early, unscheduled reviews). Flip is free reference. Risk: users who liked quiz-first lose a shortcut; give a visible "Test me" (practice, decision 7). When: v1.

## 3. One Review place, "Quick 5"
Pick: a Today card on the Collection top band (primary) plus a small header chip; no "Anki" section. Copy: "5 cards · 1 min", button "Start". Session size 5 but chainable ("5 more"), never forced to stop. Confidence: med. Reasons: lowest friction wins daily habit; short sessions only work if continuing is one tap. Fix `reviewMinutes` (review.ts:597) which says 1 min per card: 5 cards is about 1 min only if learning cards are included; use ~12s/card. Risk: Quick 5 plus a 100-card due list tempts users to do only 5 forever; catch-up (6) addresses it. When: v1.

## 4. Reminders: 1–3 slices
Pick: user picks 1–3 times (default 1 at current time). Do NOT use slices of a fixed set. Compute at app foreground and after each session by scheduling one-shot notifications (not DAILY repeats) for the next 48h: at each time, count cards with `dueAtMs <= that time` (learning steps included) minus those already reviewed today. If zero, schedule nothing. Slice rule: partition by due_at, not by an index — reminder k covers cards whose `dueAtMs` falls in the window ending at its time; a reviewed card gets `due_at` in the future, so it can never reappear in a later slice. Body: "7 cards ready · about 2 min". Cap shown at 20 ("20+ ready") and apply the daily cap (6). Confidence: med. Risk: local notifications can't be updated if the app isn't opened (counts stale); keep wording count-light ("a few cards ready"). Cap iOS pending at 64, fine. When: v1 for 1 reminder with the silent-when-empty fix; multi-slot v1.1.

## 5. Lapses
Pick: `LAPSE_MULTIPLIER = 0.3`, `MIN_LAPSE_INTERVAL_DAYS = 1` unchanged, i.e. `newInterval = max(1, round(interval * 0.3))` (a 3d card gives 1d, 30d gives 9d, 90d gives 27d). Keep ease penalty -0.20 but add a floor at 1.5 (not 1.3) to blunt ease hell. Do not touch `phaseOf`, which already reads relearning from interval_days>0. Reasons: Anki's 0 is a legacy default; its own FSRS and the lapse data show post-lapse stability is a fraction of the prior (roughly 20–40%), and a 90-day card restarted at 1d wastes about 6 reviews; the ladder (:230) already takes the parked interval, so this is a one-constant change; unit tests in test-review.mts need the matching expectations. Risk: slightly optimistic for leeches; add leech flag at 8 lapses (surface "tricky word" and offer rewriting the example). FSRS: later, requires per-review log which the schema lacks (review.ts:496-503); start logging events in v1.1 as the precondition. When: constant change v1; FSRS later.

## 6. Backlog
Pick: daily review cap 40 (new cards stay 10 via `limitNewCards`); learning cards exempt. Order: most overdue relative to interval first (overdue/interval), not oldest-due, so long-interval cards are not starved. Catch-up: if >=20 cards overdue by >=3 days (or >=7 days away), show only "Catch-up: 5 cards · 1 min" a day, pull from the top of the order, pause new cards until overdue < 20 (silent, no count). Remaining cards are not rescheduled and not lost; no fuzzed reset. Never display the total anywhere; forecast chart (weekAhead) bar for today clamps to the cap. Reason: the spiral is caused by showing totals and by new cards continuing to land on top. Risk: capped cards go further overdue, so retention drops slightly; accept it. When: cap and catch-up v1.

## 7. Practice mode
Pick: quiz any board/day with a flag `practice: true` in StudySessionHost that skips `schedule()` and `recordNewCardIntroduced`, also `review_count`/`last_reviewed_at` untouched; ungraded buttons: Got it / Missed, results shown on the end screen only. Confidence: high. Reasons: early reviews of Anki-style schedulers bring little benefit and distort intervals; users want drilling before exams; the only way to be safe is zero writes. Risk: a missed card in practice feels unrecorded; optionally offer "Add missed to tomorrow". When: v1 (small).

## Disagreements with the write-up
Daily DAILY-repeat notifications cannot be silent when empty; that needs foreground rescheduling. The 1-min estimate is wrong per card.

## Top 3 for v1
1. Practice mode with zero schedule writes (7) plus keepsake-first opening (2).
2. Lapse fix `LAPSE_MULTIPLIER 0.3`, floor 1d, ease floor 1.5, with tests (5).
3. Cap 40 plus "5 cards · 1 min" catch-up with no total shown (6/3).

## Rebuttal
(a) Cap: I move from 40 to 30 review-phase cards a day (learning-step cards exempt). B's 20 sits below steady-state load for anyone adding ~5 cards a day (DAILY_GOAL), so the backlog would grow permanently, which is the spiral we are avoiding. C's 100 never binds. 30 binds only after a break, and "Another 5?" lifts it. Order by overdue/interval.

(b) A ceiling is sound, and I concede it: 0.25, ceiling 14 days. A lapse on a mature card signals interference, and the 14d ceiling costs about two extra reviews while growth resumes at x2.5. I changed my mind from 0.3 to 0.25. I keep the 1.5 ease floor (one line, anti ease-hell). Leech at 8 lapses is dropped from v1: it needs UI, and nothing in v1 uses it.

(c) Ship C's `planReminders()` in v1: pure, tested, DATE triggers, skipped when nothing is due. This is the only honest way to get "silent when empty", which B also needs. Expose one slot by default and "Add another time" up to 3, which answers B's settings-sprawl worry. Slices partition by `dueAtMs` windows, not C's index ceil-split, so a reviewed card cannot reappear in a later slice.

(d) Practice in v1. "Test me" needs a destination; otherwise it either quizzes in browse (writes to the schedule) or is a dead button. Guard: a single early return in the grade handler, plus a test that the update callback is never called. I disagree with B here.

(e) No objection to restyling CardView. One constraint: review mode must never leak the answer. B's word-on-front is acceptable in browse only, never in the review face.
