# Card + Review — build spec (Nov 14 2026)

Decided after a 3-way debate (position-A learning science, position-B product,
position-C engineering, each with a rebuttal; same folder). The owner agreed
with the write-up and delegated open calls. Branch `feature/calendar-reimagine`
(pushed as `dev`). Read BRIEF.md first for constraints (AGENTS.md, skills.md,
tokens only, motion via lib/motion.ts, MIN_TAP 44, Reduce Motion, staging
only, no backend/schema changes, older store builds share the same rows).

## Decisions (final)

| # | Decision | Final call |
|---|---|---|
| 1 | Card shape | The production card look, built by **restyling dev's `CardView` faces** (not reviving main's 1600-line StudyCard; four screens share CardView). |
| 2 | Opening from Collection | Opens on the **front = keepsake** (sticker, word visible, flip cue). Flip for the reference back. **No quiz prompt in browse, ever.** |
| 3 | Review entry | A **Today card on the Collection band**, "Quick 5" sessions. No separate Anki section. |
| 4 | Reminders | Pure `planReminders()`, one-shot date triggers for the next 7 days, skip empty slots. One time by default, "Add another time" up to **3**. |
| 5 | Lapses | Keep **25%** of the interval on "Again": `clamp(round(interval*0.25), 1, 14)` days. Ease floor and leech flag: later. |
| 6 | Backlog | **30 review-phase cards/day** cap (learning/relearning exempt; new cards keep `newCardsPerDay`); most-overdue-relative-to-interval first; catch-up mode; **never show a total**. |
| 7 | Practice mode | v1. Zero schedule writes, enforced by one guard plus a unit test. |

## 1–2. The card

Source of the look: `git show main:components/StudyCard.tsx` (front + back
faces) and the screenshots
`/private/tmp/claude-502/-Users-school-lingostickers-mobile-lingostickers-mobile/841c9e5e-5ddc-4e3a-8319-d624b0487b38/scratchpad/cards/prod/02-card-opened-top.png`,
`06-study-back.png` (dev today: `.../cards/dev/*.png`).

- **One white card object** (`colors.card`, radius lg, `e1`) on the cream sheet. It flips about Y (reuse existing flip motion in lib/motion.ts; Reduce Motion = crossfade). No scrolling detail page.
- **Front (keepsake, browse default):**
  - Header row: big day number + weekday, small mono month/year (production's "7 Saturday / NOV 2026"); right side "Day N" (days since the user's first card, as production).
  - The sticker, big, centred on white (cutout; text-only cards keep the existing fallback).
  - Under it: the word in the learning face + reading + speaker button.
  - If the card has a note ("what happened"), show it as a one/two-line caption. If not, show nothing (the add-note affordance lives on the back).
  - Footer: "Tap to flip · pull down to close" (production copy).
- **Back (reference):** production's labelled rows, small mono uppercase labels, one edit pencil per row (wire to the existing field-edit flow, lib/cardEdit.ts / FieldEditor):
  - WORD · SAY IT (reading + speaker + hold-mic record as production) · MEANS · {POS} · IN USE (sentence with existing tap-to-gloss + translation) · then word-type rows from `forms` (e.g. GENDER, FORMS) and NOTES when present.
  - Where / When footer as production ("WHERE Not recorded · WHEN 10:32, 7 Nov"); "Add what happened that day" lives here when there's no note.
  - A small "Details" button → bottom sheet with Progress (interval, due, lapses, reviews, last) and "Say it yourself" compare (moved from dev's CardDetail body).
  - Actions in the top bar as production: close, share, save, delete (keep dev's existing handlers).
- **Test me** (small secondary button on the card, either face) → Practice for this one card (see 7).
- **Review/study face** (StudySessionHost) keeps dev's calmer study front (question + progressive hint + Tap to reveal) and grade row, restyled to sit in the same white card. **The review front never shows the answer.**
- testIDs: keep every existing one; add `card-flip`, `card-details`, `card-test-me`.

## 3. Today card (Collection band)

- Sits on the Collection band where the current due/“caught up” line is.
- States:
  - Due: **"Today · 5 cards · about 1 min"** + `[Start]` (testID `today-start`). If fewer than 5 are due, say the real number ("3 cards").
  - After finishing a Quick 5 with more waiting: "Nice. 5 more?" `[5 more]` (`today-more`).
  - Nothing due: "All caught up. Next one tomorrow." / "…in 3 days" (existing next-due logic).
  - Catch-up (see 6): "Welcome back · 5 cards · about 1 min".
- A Quick 5 session = the next 5 cards of today's capped queue (learning cards that come due mid-session may join, as now). Sessions end with the existing ReviewSummary.
- `reviewMinutes` (lib/review.ts) assumes ~1 min per card: use ~12 s per card, min 1 min, so 5 cards ≈ "about 1 min".
- No totals anywhere: Calendar's pill becomes "Review" (no number; keep testID `calendar-review-cta`), and Home/Collection copy never shows "N due" above 5.

## 4. Reminders

- `lib/reminder.ts` gains a pure `planReminders({ slots: {hour,minute}[], cards, now, days: 7 })` → list of `{ fireAt, title, body }`:
  - Today's slots: count of cards whose `dueAtMs <= fireAt` (capped queue, no totals). ≤5 → "3 cards · about 1 min"; >5 → "A quick 5 is ready · about 1 min". Zero → no notification.
  - Later days: generic "Your Tabi cards are ready" only if any card is due by then; else skip.
  - DST-safe (local wall-clock times), slots in the past today skipped.
- Scheduling: cancel all Tabi reminder notifications and re-schedule one-shot DATE triggers from the plan on app foreground, after a study session, and when settings change. Migrate the old repeating DAILY reminder (cancel it by its stored id) — settings keep their enabled/hour/minute as slot 1.
- Profile UI: existing reminder row keeps one time; "Add another time" adds up to 3 (each removable). Permission asked only when switching on (as now).
- Unit tests: zero-due day skipped, slots in the past skipped, count text, DST transition day, 3 slots no duplicates.

## 5. Lapses

- `lib/review.ts`: `LAPSE_MULTIPLIER = 0.25`, keep `MIN_LAPSE_INTERVAL_DAYS = 1`, add `MAX_LAPSE_INTERVAL_DAYS = 14`. Relearning steps unchanged. Update `intervalPreview` so the Again button label stays truthful. Tests in scripts/test-review.mts (30d → 8d, 90d → 14d, 2d → 1d).

## 6. Backlog

- `lib/studyQueue.ts`: `capReviews(queue, { reviewCap: 30, reviewedToday })` where `reviewedToday` = cards in review phase with `last_reviewed_at` today (derived from data, so it's cross-device). Learning/relearning cards are never capped. Order capped reviews by overdue ratio `(now - due) / interval` descending.
- Catch-up mode (derived, no storage): if ≥ 20 review cards are ≥ 3 days overdue, or the newest `last_reviewed_at` is ≥ 7 days ago: new cards paused for the day and the Today card shows the welcome-back copy. Exits automatically when the condition stops holding.
- Unit tests for the cap, ordering, learning exemption, catch-up trigger.

## 7. Practice

- `StudySessionHost` gains `mode: 'review' | 'practice'`. In practice: grading shows only "Again / Got it" style feedback (or the normal row, but) **no `schedule()`, no DB write, no new-card slot, no review_count/last_reviewed_at change** — one early return in the grade handler, plus a unit test that the practice path never calls the write.
- Header label "Practice · doesn't change your schedule".
- Entry points v1: card **Test me** (one card), and the Day screen (`app/day/[date].tsx`) "Practice this day". Boards later.

## Milestones (each ends with typecheck + lint (calendar/card files) + `npm test`)

1. **M1 logic:** lapse change, `capReviews` + catch-up, `planReminders`, `reviewMinutes`; unit tests.
2. **M2 card:** CardView restyle (front/back/Details/Test me), Collection opens on front. qa-tester: new `.maestro/agent/card-v2.yaml` (demo account, look-only) + existing card/study flows in `.maestro/agent/` still pass.
3. **M3 Today + Quick 5 + practice:** Today card states, Quick 5 sessions, practice mode + entries, Calendar pill copy. qa-tester flows on the **QA account** (review writes OK there; no AI calls; mind qa-budget) and look-only on demo.
4. **M4 reminders:** planner wired, Profile UI with up to 3 times, migration from the daily repeating reminder. Verify scheduled notifications via a debug readout or `Notifications.getAllScheduledNotificationsAsync` logged in dev.
5. **M5 polish:** catch-up copy, Reduce Motion, a11y labels, dark/light, 375pt width.

Then an independent code review, fixes, final QA, and a side-by-side main-vs-dev card screenshot for the owner.

## Not in v1
Ease floor 1.5, leech flag (derivable from `lapses` later), FSRS (needs review logs), board-level practice, holo/foil card effects.
