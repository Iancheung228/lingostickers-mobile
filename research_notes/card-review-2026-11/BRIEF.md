# Card + Review rethink — debate brief (Nov 14 2026)

Owner read the write-up (https://claude.ai/artifact/H8GkEj1DR9ogEJocVEFxXc;
local copy with screenshots:
/private/tmp/claude-502/-Users-school-lingostickers-mobile-lingostickers-mobile/841c9e5e-5ddc-4e3a-8319-d624b0487b38/scratchpad/cards/web/tabi-card-rethink.html,
screenshots in .../scratchpad/cards/prod/*.png and .../cards/dev/*.png) and
"mostly agrees"; for anything unsure, the team decides. Then scope, plan,
build on branch `feature/calendar-reimagine` (pushed as `dev`).

## The decisions

1. **Card shape.** Restore the production (App Store, branch `main`) flip
   card as THE card — white card, date header ("7 Saturday · Day 7"), big
   sticker, labelled rows on the back (WORD / SAY IT / MEANS · POS / IN USE)
   with per-row edit, Where/When footer — and port dev's improvements onto it
   (word-type rows: forms/notes; progress + record/compare behind "Details";
   Test me). Production source: `git show main:components/StudyCard.tsx`,
   `git show main:components/StickerCard.tsx`, `git show main:app/(tabs)/collection.tsx`.
   Dev source: `components/CardView.tsx`, `CardDetail.tsx`, `StudyCard.tsx`,
   `StudySessionHost.tsx`, `GradeRow.tsx`.
2. **Opening a card from Collection:** on the look/answer ("keepsake") face,
   flip for reference; quizzing only in Review — vs production's quiz-first.
3. **Review:** one first-class Review place, "Quick 5" (~1 min) sessions,
   no separate "Anki" section. Where it lives (Collection header chip? a
   Today card on the Collection/Home band? elsewhere?).
4. **Reminders:** 1–3 per day at chosen times, each a slice of today's due
   cards, silent when nothing is due. Today: one daily local notification
   (`lib/reminder.ts`, expo-notifications, JS only).
5. **Lapses:** today `lib/review.ts` resets interval on "Again"
   (`LAPSE_MULTIPLIER = 0`). Keep part of the interval? What value? FSRS later?
6. **Backlog:** daily review cap, catch-up mode after a break, never show a
   scary total ("5 cards · 1 min" instead).
7. **Practice mode:** quiz any board/day without touching the schedule.

## Facts and constraints (don't relitigate)

- Expo SDK 54, React Native, reanimated 4. Read AGENTS.md and skills.md
  (lessons index; docs/lessons.md has details). Theme tokens only
  (`npm run lint` rejects raw hex), motion only via `lib/motion.ts`,
  MIN_TAP 44, Reduce Motion respected.
- The app is LIVE. Staging by default; no production deploys, no `eas
  update`/build without the owner. Prefer client-only changes; any backend
  change must stay compatible with older store builds (skills.md #18).
  Scheduling is computed client-side in `lib/review.ts` (pure, unit-tested
  in scripts/test-review.mts).
- Study prefs: `lib/studyPrefs.ts` (simpleGrading, newCardsPerDay ...),
  queue: `lib/studyQueue.ts`, due logic: `dueToday` in `lib/review.ts`.
- Owner taste (memory): keep the production Rose look and the floating rose
  pill tab bar; no physical-metaphor skeuomorphism (stamps/washi/notebook);
  digital holo/foil light on cards is welcome later (not in scope now). The
  product pitch is "a better, customisable Anki for language learning".
- Tabs on dev: Collection, Calendar, Scan (centre), Boards, Profile.
- Visual changes are verified on the Simulator by the qa-tester subagent.
