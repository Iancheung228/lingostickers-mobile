# Tabi Stickers — launch strategy synthesis (2026-10-29)

> **Superseded in part by [`00_PLAN_v2.md`](./00_PLAN_v2.md) (same day):** the pitch, the travel-notebook aesthetic and the phase order are replaced. Launch blockers, learning science, cost math and harness changes still stand.

Ten agents, two waves. Wave 1 established facts: a code inventory (01), Anki
pain points (02), competitors (03) and aesthetic references (04). Wave 2
applied lenses to those facts: a Jobs-style product visionary (10), first
principles (11), a staff engineer (12), a UI/UX designer (13), a learning
scientist (14) and a growth lead (15). This page reconciles them. Each
numbered report keeps its evidence and URLs.

**Verified by running checks (this session):** `NEW_CARD_REST_DAYS = 1`
(`lib/review.ts:46`). Groq is the default LLM fallback
(`_shared/llm/index.ts:72`) and is missing from `AI_PROCESSORS`
(`lib/aiConsent.ts:36`). There are 64 `Alert.alert` calls. Engineering ran
typecheck, lint, tests and deno check: all green; test-drivable: 0/6.
Everything else here is the agents' reading of code and the web; their
reports say which.

---

## 1. What the app is today

You photograph a real object. It is cut out on device with Apple Vision and
becomes a die-cut sticker card. One Gemini call writes the word, the reading,
a sentence about *your* scene, a word-by-word gloss, a grammar point taken
from a 65-item syllabus, and a teaching note. TTS and your own voice note
attach to the card. You study it with SM-2 plus Anki-style minute steps. The
app also has boards and a home wall, a calendar of finds, friends with
guess-the-word challenges, block/report and account deletion. It supports
French, Japanese and Cantonese, on iOS only. There is no paywall, no
onboarding, no review reminders and no crash reporting, and 6 analytics
events, none of which form a funnel.

## 2. The hard truth: the concept is taken

**CapWords** already does photo → sticker → word → SRS. It won the **2025
Apple Design Award** and Editors' Choice (4.7★), and has about 15 clones.
"Objects become stickers" therefore cannot be the pitch, and pitching it that
way also invites a **4.3(b) spam rejection**. CapWords' known weaknesses:

- A card-required trial after about 2 captures, which users resent.
- Reviewers call it "limited in depth and structure".
- No social features and no diary.
- Cantonese unconfirmed.

## 3. Value proposition (reconciled)

> **"A travel notebook of your life in a new language — that makes sure you
> never forget a page of it."**

- **Biggest value:** it **removes the cost of making cards**, which is Anki's
  #2 pain ("the biggest barrier… is the card creation itself"), and every
  card carries a **personal memory hook**: your mug, your street, your
  sentence, your voice.
- **Why Tabi and not CapWords:** a CapWords card is an *object* (a Pokédex
  entry). A Tabi card is a *moment*: this thing, this place, this date, a
  sentence about your photo. On top of that, Tabi has **real learning depth**
  (sentence, gloss, syllabus, a real scheduler), a **diary**, **friends** and
  **Cantonese**.
- **Wedge audience:** **Cantonese heritage learners** first. No photo-vocab
  app serves them, and the fluent parent or grandparent is a built-in
  challenge partner. **Japan-trip planners** second, for volume ("Tabi"
  means travel).
- **The aesthetic thesis:** commit to **one physical metaphor, the travel
  notebook**: eki (station) stamps, washi tape, die-cut stickers, specimen
  labels, foil. Rule: *only do what paper, ink, tape or foil could do.* That
  means no confetti, no XP bars and no loot-box rarity.

## 4. The risk the concept creates

Capture is more fun than review. Tabi will therefore produce Anki's #1 pain,
**the review backlog**, *faster* than Anki does. The study side has to be
built against that from day one:

- Captures land in the notebook; only a few a day are promoted into study.
- New-card intake pauses when reviews pile up.
- Show "~12 min today", never "487 due".
- Offer a gentle "welcome back" mode instead of punishment.

**Picture cues also inflate confidence.** People over-rate words cued by
their own photo (Carpenter & Olson 2012), so make the user **say or type the
word before the flip**.

## 5. Where the agents agreed

Every lens that looked at it named these independently.

1. **The magic moment is broken after "Add".** `handleAdd`
   (`scan.tsx:646`) leaves you on the camera and the sticker vanishes. A new
   card is not due until the next local midnight (`NEW_CARD_REST_DAYS = 1`),
   so the 1m/10m learning steps never run on day 0. Fix: peel, slap onto
   today's page, then "practise it in 10 min".
2. **There is no first run.** The first sticker should arrive in under 60
   seconds, with the account requested *afterwards*.
3. **Without reminders and backlog guards, retention dies.** Add one daily
   local reminder showing *a sticker*, not a count.
4. **`review_logs` must exist before launch.** History cannot be backfilled,
   and without it there is no retention metric and no FSRS later.
5. **The study card is the hero and is currently a form.** Redesign it as a
   **Specimen Card**: sticker on a backing, a catalogue label, the scene
   photo taped on, an interlinear gloss, and a material that matures (paper →
   ink stamp per review → foil edge when mature, with washi repair tape after
   a lapse).
6. **Ship v1 free, no paywall.** A scan costs about $0.0013. Set up
   RevenueCat without a paywall, and turn the paywall on at D7 ≥ 15% and 500
   signups. Limit scans, never reviews or friends.
7. **One native build, batched.** Sentry, a real app icon (currently the
   Expo default), EAS Update, and optionally RevenueCat, Skia and dark mode.

## 6. Where they disagreed, and the call

| Question | Positions | Call |
|---|---|---|
| Cut tabs? | Jobs: notebook + scan only. Growth/competitors: friends is the differentiator and the viral loop | **3 tabs: Notebook (collection + calendar + boards folded in) · Scan · Friends.** Hide the home wall and duplicate surfaces. *Your decision.* |
| Scan before an account? | Design and first principles: yes (Supabase anonymous auth). Engineering: needs RLS and backend work | **Yes, but after launch blockers.** *Your decision*: it changes auth. |
| Groq fallback | First principles: delete. Engineering: disclose or switch off | **Turn it off** (`LLM_FALLBACK=off`). Gemini was 100% vs Groq's 89% in the bake-off. Requires you to set the secret. |
| FSRS now? | Pain-point research: yes. Learning science: log first | **Log now, FSRS in 1.1** (`ts-fsrs`; verify it runs on Hermes). |
| Streaks | Growth: gentle streaks. Aesthetics: streak-breakers churn | **No streak counter.** The notebook filling up *is* the progress. |

## 7. Launch blockers (fix before submitting)

| # | Item | Owner |
|---|---|---|
| B1 | Groq receives photos undisclosed → `LLM_FALLBACK=off` (or disclose it) | **you** (secret) |
| B2 | Aptabase missing from the privacy policy | you / loop (`docs/privacy.html`) |
| B3 | Sign-out leaves the push token on the old user (`useAuth.ts:58`) | loop + you apply the migration |
| B4 | Grades silently lost offline (`StudyCard.tsx:421-437`) | loop (`grade-write-queue`) |
| B5 | Paid scan draft lost if the app is killed; orphaned storage | loop |
| B6 | No app-wide AI spend breaker; no image-size cap | loop + you deploy |
| B7 | No crash reporting (Sentry needs the native build) | **you** (EAS yes) |
| B8 | App icon is the Expo default | you (pick from "Eight Marks, One Rim") |
| B9 | `review_logs` table | loop writes the migration, you apply it |
| B10 | Contrast failures: `inkLight` 2.86–3.13:1, tab icons 2.13:1 | loop |
| B11 | Supabase Free fills at about 10 engaged users → Pro ($25/mo) | **you** |

## 8. The plan

**Phase A — Truth (week 1).** B1–B11 plus the 7 funnel events (signup,
first_scan, sticker_saved, first_review, session_done, reminder_enabled,
challenge_sent). Activated = 3 stickers + 1 review within 48h. Targets:
D1 35%, D7 20%, D30 10%.

**Phase B — The magic moment (week 2).**
- Post-save handoff: peel → slap onto today → first review in about 10 min.
- First-run reaching a first sticker in under 60 s.
- `lib/feel.ts`: haptics + ~8 foley sounds × 3 variants, never haptics alone.
- A daily reminder.
- Backlog guards: 5 new cards/day, minutes not counts, welcome-back mode.
- A stamp press at session end in place of the summary list.

**Phase C — The card (week 3).**
- Specimen Card front and back, with the scene photo on the back.
- Maturity materials.
- Semantic colour tokens and the `ink500` fix.
- Replace the 64 Alerts with a toast, a confirm sheet and inline states.
- Home dedupe: the same sticker currently shows 4 times.

**Phase D — v1.0 submit.**
- An App Review demo account with a full notebook and a pending challenge.
- Store page leads with the diary, friends and depth (not the camera):
  "Tabi Stickers: Word Diary" / "Japanese, French & Cantonese".
- Apple featuring nomination.
- TestFlight: 25 testers recruited in pairs, growing to about 100.
- Growth's target date: **Tue 1 Dec 2026**, with a second push for Lunar New
  Year (6 Feb 2027).

**v1.1 — Depth and the "one more thing".**
- **Eki-stamp passport:** each place you learn a word mints an ink stamp with
  the place name in the target script and your sticker's silhouette. This is
  the signature, featureable, shareable piece.
- Say-it-before-flip; a hint caps the grade at Hard.
- Listening card: hear the word, pick from 4 of *your* stickers.
- Cloze on the scene sentence (reuses the challenge screen).
- Tap a gloss chunk to collect verbs and adjectives, escaping the
  noun-only ceiling.
- FSRS.
- Challenge and invite links (`/c/<id>`, `/u/<name>`). Today `deepLinks.ts`
  only handles auth, so challenges cannot reach non-users.
- Widget, foil tilt with Skia, the paywall, "On this day".

## 9. The harness: what it needs before it can build features

Engineering's verdict: **fit for testID chores, not for feature work.** These
are guarded files, so the changes are yours to make (or to ask me to make),
about 150 lines in total:

1. Tie the QA result to the tree hash it tested. Today a stale pass counts.
2. `flow_asserts`: the agent writes the flow it is graded by, so the
   script must grep the YAML for required selectors and strings.
3. Human-owned unit tests per feature (`scripts/test-<id>.mts`); first, an
   `import type` fix so `lib/review.ts` (594 lines, untested) can be tested.
4. Named seed profiles: `empty | one-due | ten-mixed | challenge-pending`.
5. `executor: loop|human`, `depends_on`, `requires_human` →
   `BLOCKED_ON_HUMAN`, so migrations and native work don't stall the loop.
6. A staging Supabase project before any schema-writing feature.
7. `--max-warnings 43` on lint, and regressions picked first.
8. A `__DEV__` debug route (the first loop feature) so notifications,
   analytics events and queued writes become assertable text.

A draft next list in that v2 schema is in
[`feature_list.next.json`](./feature_list.next.json). It is a **draft**:
`harness/feature_list.json` is yours and guarded, and the current 6
testID items should finish first.

## 10. Decisions only you can make

1. Tab structure: 3 tabs (recommended) or keep 5?
2. Anonymous scan-before-signup: yes or later?
3. `LLM_FALLBACK=off` now? (It is a secret change on production.)
4. Native build batch: Sentry + icon + EAS Update (+ RevenueCat / Skia /
   dark mode?). This spends 1 of the 15 monthly builds.
5. Launch date: 1 Dec 2026 or later?
6. Which icon from the Sep canvas.
