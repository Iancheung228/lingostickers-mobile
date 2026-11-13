# Learning and SRS expert: round 1 position

Scope note: the scheduler (`lib/review.ts`) is sound and Anki-faithful (1m/10m steps, SM-2, learn-ahead 20m, previewed intervals). The problems are all in what surrounds it. I propose no scheduler change for v1, only UI over it.

## 1. Five biggest "vibe-coded" tells (learning seat)

1. **The review card is a detail page, not a flashcard.** Front (`04a-study-front.png`) is the chrome of a keepsake: big date "12 Thursday", username + avatar + "DAY 1", then a half-empty card with the photo left-aligned in a square (`StudyCard.tsx` FrontFace ~l.1005-1135), WHERE/WHEN footer, share/download/delete icons in the top bar. Share and delete during a review are hazards (a stray tap deletes a card) and noise (the learner's attention budget is the product). None of it helps recall.
2. **Back face (`04b`, `03b`, `ss3-review.png`) is an unranked form.** WORD, SAY IT, MEANS, IN USE, WORD BY WORD, and a grammar tip all carry the same weight, behind 5 mono uppercase labels, with a big white gap below. The answer (meaning) is the 3rd block, under the word the user already knows. On a review back the first thing seen should be the thing they were asked for.
3. **Grading row is correct but unfinished.** `04b`: four equal buttons, labels "Again/Hard/Good/Easy" with "1m/6m/10m/4d" at 11px mono. Good interval-on-button (Anki parity), but no keyboard/gesture path, no undo, no progress bar (only "1 / 7" in grey), a second dead strip between card and buttons holding the "Shot at / Not recorded" footer. "Not recorded" appears on every card; it is an empty state shown as data.
4. **Session summary (`04d`) is a modal over the home screen that says nothing.** "Session done / 1 recalled / 0 to revisit" in monospace lowercase. No next-due time, no tomorrow count, no streak, no "what's due when". The home header behind it already says "next due in 10m", so the app knows and the summary doesn't use it. Also a mixed vocabulary: "recalled", "to revisit", "found", "reviewed".
5. **Collection and Calendar present storage, not learning.** `ss5-calendar.png`: "The long view / 7 DUE IN 7 DAYS" with a month grid of one cup and 29 blank cells, a "Finds/Reviews" toggle, bars that say "0 reviewed". It never shows retention, forecast, or what is due Tuesday. The mono labels (`THIS WEEK`, `OCTOBER 2026`, `SAY IT`, `WORD BY WORD`) are the single clearest vibe-coded tell across study too.

## 2. Proposal

**One loop, two depths.** Default surface is the casual one (photo cue, warm, one tap). Anki-grade control is one layer down and never nags: gestures, intervals, stats and card options are present but quiet. No mode switch, no "advanced user" setting; the depth is progressive.

**Study session (highest priority)**
- Remove the date/avatar/share/download/delete/WHERE/WHEN chrome during review. Top bar: close X, a thin progress bar (2px, 100% width, ink on sand) and "3 / 12". Card actions (edit, delete, suspend, share) go in one "..." menu.
- Front: the photo fills the card (cutout centred on tint, `contain`, ~60% of height); prompt "What's this called?" stays as the question; a **Hint** pill stays. Add the one-line user note (from the "Add what happened that day" field) under the photo as memory cue; it is the casual user's reason to care. New copy only if the owner re-approves: keep `What did you call this\?` and `Tap to reveal` as-is for Maestro.
- Back: order = word (Klee One 40pt, with article) -> reading (kana/jyutping/IPA, 20pt, speaker button inline) -> meaning + POS chip -> sentence with target word bold + translation (collapsible, closed by default) -> grammar tip/word-by-word under "More" disclosure. Photo shrinks to a 64pt thumb at top-right so the cue stays visible. The user sees the answer in 1s without scrolling.
- Remove the mic/"Hold the mic" row from the review face (an unexplained feature that costs 80pt); keep it behind the speaker button long-press or in card detail.
- Auto-play audio on reveal (setting, default on for fr, ja, yue); skippable.
- Grading: keep four buttons and the exact "Again/Hard/Good/Easy" with interval; raise interval text to 13pt, use tabular figures. Fixed 56pt height, `gap >= 8`. Add swipe: left = Again, right = Good (with colour wash and haptic); Easy/Hard by buttons only (lesson #9: rarer actions get a drawn control). Add **Undo** (a 3s toast "Graded Good - Undo") since a mis-tap on a 10-minute ladder is costly. Haptics: Rigid on Again, Light otherwise, Success when the last card is done.
- Keep Maestro strings: 'Good — next review in.*' etc. are the accessibility labels already; leave them.
- All JS-only (Reanimated + gesture-handler if present; otherwise Animated, as `dismissPan` already uses PanResponder).

**Summary**: replace modal with a full screen of 4 things: cards reviewed + time, a 4-segment bar of Again/Hard/Good/Easy counts, "Next: 3 cards in 10m / 9 tomorrow", and the first-sentence nudge "N new words captured this week". Keep 'Session done', '1 card reviewed' and 'Done' strings.

**Card types (JS-only, no schema change)**: v1 ships photo -> word (current). Add a per-card *derived* reverse direction: meaning -> word typed or recalled, off by default, toggled in Profile ("Also test: word -> meaning"). Needs scheduler state per direction, so it is a backend question; flag it for v1.1 rather than v1. Do not add cloze.

**Collection**: serves learning with a status chip on each tile (New / Learning / Young / Mature, a 4-dot or tint) plus filters "Due", "Leeches" (lapses >= 8), "Suspended". Search must hit word, reading and meaning. Sorts: add "Due soonest" and "Hardest". Keep category pills; add language and POS filter.

**Calendar**: reframe as "Today / Next 14 days" first: a forecast bar chart (due per day, stacked new/learning/review), then the month heatmap (reviews as tint intensity, finds as photo thumbs). Retention % (7/30 day pass rate) as one stat. Drop "THE LONG VIEW" copy for "Forecast".

**Scan**: the "More from this photo" prompt chips and word picker (`ss2-scene.png`) are the best learning design in the app: they turn one photo into POS-diverse cards. Keep; label count ("Add 3 cards") clearly; show each candidate's POS and a "new/already have" mark (duplicate guard).

**Boards**: treat as decks/tags: "Study this board" button (filtered session). Boards are the Anki "deck" mental model; expose it.

**Onboarding**: ask target language and a daily new-card cap (default 5, matching DAILY_GOAL); explain the 1-day rest of new cards in one line.

**Cross-cutting**: daily new-card limit as a setting (the backlog spiral, pain points #1 and #13 in `02_anki_painpoints.md`, is the top quit reason); show it, don't hide it. Export (CSV/Anki-importable TSV) in Profile; needs an edge function, flag backend. Stats screen (Profile): reviews/day, retention, interval distribution; JS-only if computed from rows already fetched.

## 3. Rose or Powder
**Rose**, for study. The grading ramp (lesson #12) is red -> sand -> green with *no brand colour*. Powder's action is peach #F2A27A with ink text, which sits close to the Again/Hard hues and would force the brand off the grade row. Rose's action #9D4D51 collides too, but the ramp already solved it by keeping the brand out. Rose also reads as warm "moment" rather than "tool". Whichever is picked: Again/Good/Easy text on fill must hit 4.5:1 (verify by script).

## 4. Cut
- Share/download/delete from the review face. Date/avatar/username header on the front. "Not recorded" footer (hide when null). Mic row on review. Mono uppercase labels (`WORD`, `SAY IT`, `MEANS`, `IN USE`) on the back: the content is self-evident. "Pull down to close" hint text (keep gesture). The 1-card "Goal 5" copy unless it gates something.

## 5. Where I expect disagreement
- **Visual/brand designer**: will want the front to keep date/avatar for "memory" delight. I say the memory is the photo + note, and the date is one muted line.
- **Motion/delight role**: confetti on summary. I accept a restrained haptic and a count animation; no gamified streak pressure (Anki pain point #11 vs #1).
- **Information architect**: may want fewer tabs/settings. I need a Stats place and a limits setting; I'll accept them inside Profile.
- **Engineering/backend**: reverse cards and export need data/functions; I yield on v1 and call them v1.1.
