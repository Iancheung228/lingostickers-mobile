# Position C: staff engineer / delivery realist

Premise: the whole card surface is only two things, FACES (CardFront/CardBack in `CardView.tsx`, 549 lines, already shared by StudyCard, CardDetail, TypeWordSheet, DiscoveryReveal) and a SHELL (`StudyCard.tsx`, 756 lines, gestures, flip, undo, grade row). Main's `StudyCard.tsx` is 1600 lines with faces, shell, editing and voice fused together. Dev split that on purpose (R3), and 4 other screens now depend on the dev split.

## 1. Card shape: restyle dev's CardView into the production look. Do NOT revive main's StudyCard.
Confidence high. Cost M (S-M of real work). Files: `CardView.tsx` (CardFront/CardBack styles and layout), `StudyCard.tsx` (header slot), maybe a new small `CardHeader.tsx`.
- Reviving main's faces means re-merging 1600 lines of fused code against 5 consumers and re-solving edit sheets, voice take and sizing, which dev already fixed (R4 "study back sizing", final fix pass). That is a rebuild with regression risk on a live app.
- Restyling keeps one component tree. Add: white card surface, date header ("7 Saturday · Day 7" from `created_at`/existing `ordinal` helper, copy that from main), labelled rows WORD / SAY IT / MEANS · POS / IN USE, per-row edit (dev already has `Editable` wrappers and the same EditTarget set), Where/When footer (`MemoryLine` exists). Dev's forms/notes rows stay as extra rows.
- No schema change. Zero backend. Older store builds untouched.
- Risk: visual regressions in Reveal/TypeWord/Discovery since they share `CardBack`. Mitigate with a `variant` prop (already `study|detail|reveal`) and Maestro screenshots of all four surfaces.
- v1: yes, this is the headline. Progress + record/compare stays behind Details (CardDetail exists, just reachable); "Test me" = entry into practice (see 7).

## 2. Collection open = keepsake (answer) face, flip for reference; quiz only in Review.
Confidence high. Cost S. Files: `app/(tabs)/collection.tsx`, `StudyCard` `mode='browse'` (already exists: `StudyCardMode = 'browse' | 'review'`). Just default browse to the back/answer face. Risk: none to data; Maestro flows that assume quiz-first (`r3-card-tour`, `ux-tour-study`) need updating by adding NEW flows, since `.maestro/*.yaml` is frozen but agent flows are ours. v1.

## 3. Review: one place, "Quick 5". Home = a "Today" card on Collection header band (chip as a secondary entry).
Confidence medium-high. Cost M. Files: `collection.tsx` (band), `lib/studyQueue.ts` (add `quickSlice(queue, 5)` pure), `StudySessionHost` (accept a queue and an "end after N" and a "Keep going" continue button). Reuse the existing session host; Quick 5 is just a queue slice, not a new scheduler. Delete the "Anki" section from UI only. Risk: session-end screen copy/undo state with a short queue. Test: pure unit test for slice (order preserved, learning steps due-now kept first). v1.

## 4. Reminders 1-3/day with accurate counts. Cost M. Files: `lib/reminder.ts` (rewrite), Profile UI, app `_layout` foreground hook.
Confidence medium. Key fact: a local notification body is frozen at schedule time, and counts change. Honest design:
- Store `{slots: [{h,m}] up to 3}` in AsyncStorage (`tabi.reminder.v2`, migrate v1 single slot; keep v1 key readable so downgrade is harmless; it is local only, no DB).
- Use `DATE` triggers, not `DAILY`, for the next N days (N such that total <= ~30 pending, iOS cap is 64). Call `rebuildReminders()` on app foreground, after each session end, and after grading. It cancels all by stored ids and reschedules from the live queue: slot k gets slice k of the due list (`ceil` split), body "N cards · about M min". Slots whose predicted count is 0 are simply not scheduled today.
- For days ahead use `weekAhead`/`dueCountsByDate` (exists in review.ts) to predict counts; if prediction 0, skip that day (silent when nothing due). Predictions go stale if user adds cards, so generic fallback body with NO number ("Cards are waiting") for day 2+, and exact numbers only for today and tomorrow. Numbers are never wrong when shown, because rebuild runs on every foreground and the user cannot see a stale number without having opened the app.
- Pure function `planReminders(slots, dueCounts, now)` returns the list of `{fireAt, body}`; unit test it in `scripts/test-reminders.mts` (DST day, 0 due, 1 card across 3 slots, time already passed today, 3 slots same minute). Notification tap deep link `data.type` already exists.
- Risk: permission denied state, Focus modes, iOS 64 cap, timezone change (rebuild on foreground handles it). v1: do 1-3 slots with count text for today only plus generic text after. Later: background refresh of counts (needs a native task; skip).

## 5. Lapses: keep a part of the interval. Pick `LAPSE_MULTIPLIER = 0.3`, `MIN_LAPSE = 1`.
Confidence medium. Cost S. Files: `lib/review.ts` (one constant), `scripts/test-review.mts` (update expectations; note `nextOutcome` is the single source for label and write so buttons update for free). The graduation path already reads the parked `interval_days` (see relearning branch), so the plumbing is done. Data: fields are the same `interval_days`, `ease_factor`, `lapses`; older builds reading rows just see an interval, fine. Risk: older builds still reset to 0 for the same account on another device, harmless inconsistency, but note it. Defer FSRS: it needs per-card stability/difficulty columns (migration + compat), L, not v1. v1.

## 6. Backlog: cap + catch-up + friendly copy. Cost M. Files: `lib/studyQueue.ts` (add `capReviews(queue, cap)`: most overdue first? Prefer oldest-overdue first, then ties as `dueToday`), `studyPrefs.ts` (`dailyReviewCap`, default 100, and `maxPerSession` via Quick 5), copy utility `friendlyCount(n)` returns "5 cards · 1 min" using `reviewMinutes`. Catch-up mode: if the oldest overdue > 7 days, the Today card offers "Welcome back: 10 a day" and uses a smaller cap for the day without changing any card's due date (spreading is queue-only, so no writes, no data risk). Never display raw total. Test: unit tests on cap with new-card limit interplay (`limitNewCards`). v1: cap + friendly copy. Catch-up v1.1 (just the banner variant).

## 7. Practice mode: quiz any board/day without touching the schedule. Cost S-M. Files: `StudyCard` (`mode='practice'` that skips `schedule()` and the DB write), entries from board page, `app/day/[date].tsx`, and "Test me" on the card. Risk: the critical one, an accidental write. Enforce with a single guard in `StudySessionHost`'s grade handler (`if (practice) return`) plus a test that the update callback is never invoked. Practice outcomes keep a session-local requeue only. v1.

## Build order (each milestone ends with qa-tester on `harness/qa.sh`)
- M1 (S): #5 lapse constant + #6 pure functions + #4 `planReminders` with unit tests. No UI, risk-free. Tests: `test-review.mts`, new `test-queue.mts`, `test-reminders.mts`.
- M2 (M): #1 restyle faces + #2 browse default. Flows: `card-face-collection.yaml`, `card-flip-back-rows.yaml`, `card-edit-row.yaml`, plus screenshots of Reveal/TypeWord.
- M3 (M): #3 Today card + Quick 5 + #7 practice. Flows: `quick5-session.yaml` (finish 5, end screen), `practice-no-schedule.yaml` (assert the next-due line unchanged afterward).
- M4 (M): #4 reminders UI + rebuild hooks. Flow: `reminder-settings.yaml` (UI only; Maestro cannot see the notification, so the planner unit test carries the proof).
- M5: backlog UI banner, polish, dark mode pass.

Everything is client-only, no migration, no production action. Ship order after: owner approves an EAS build; none requested here.

## Rebuttal

(a) Cap: both are one pure function in `studyQueue.ts`, equal cost (S). Learning-exempt is the correct rule and cheap: filter `phaseOf != review` out first, then cap the rest. Risk is the number, not the code. I take 40 with learning exempt (A), exposed as a pref so it can change without a release. 20 plus "Another 5?" is kinder but starves long-interval cards unless ordered by overdue/interval; adopt A's ordering (a pure sort, unit-tested).

(b) Lapse 0.3 (middle of 0.25 and 0.3; pick 0.3), ceiling 14 days (B) is a free `Math.min` in the same line; take it. Ease floor 1.5 is a change to `MIN_EASE`, a constant, but it silently alters every existing card's next Good interval, so it is a regression surface: defer to v1.1. Leech at 8: NO schema needed, `lapses` already exists; derive `isLeech = lapses >= 8` in TS and show only a Details hint. Keep v1 schema-free.

(c) Concede on reminders: v1 = one time, one-shot notifications for the next ~7 days from `dueCountsByDate`, skip empty days, generic text beyond tomorrow. Build `planReminders` to accept a slots array so 1-3 is a UI-only v1.1. Practice in v1: A is right, it is small and the no-write guard is one early return plus a test; B's "same card UI, no grade buttons" is fine.

(d) Compatible and cheaper: the front becomes sticker + date header + word + flip cue in `CardFront`; the "Add what happened" box moves into Details (CardDetail). Opening on the front vs the keepsake back is a one-line default in browse mode; I'd pick B's front since both are flip-one-tap, but it must never show a quiz prompt.

Final milestones: M1 pure logic + tests (lapse 0.3/14d, cap 40, planReminders); M2 card restyle + browse default + Details; M3 Today card + Quick 5 + practice; M4 single reminder rebuild; M5 catch-up banner, polish; v1.1 slots 2-3, ease floor.
