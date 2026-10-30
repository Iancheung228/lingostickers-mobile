# Tabi Stickers: pedagogy review (learning science / SRS)

Reviewer brief: second-language acquisition (SLA) and memory research. Read-only review of `/Users/school/lingostickers-mobile/lingostickers-mobile` at HEAD `59f753c`.
Code read: `lib/review.ts`, `components/StudyCard.tsx` (grading, FrontFace, hint), `components/StudySessionHost.tsx`, `components/ReviewSummary.tsx`, `lib/gloss.ts`, `supabase/functions/_shared/{syllabus,vocab,cardSchema}.ts`, and lessons §12–13 (identical to skills.md §12–13). Also read the scratchpad files 01_inventory and 02_anki_painpoints.

**How each claim was checked.** Code claims come from reading the code. Nothing was run. The srs-benchmark and ts-fsrs facts were fetched today (2026-10-29). Literature marked *(lit.)* is cited from memory as standard references and was not re-fetched.

---

## 0. Code facts that drive the conclusions

| Fact | Where | Why it matters |
|---|---|---|
| New stickers are inserted with `due_at = NULL`. `dueAtMs()` falls back to *local midnight of discovered_at + NEW_CARD_REST_DAYS(1)*. | `lib/review.ts` `dueAtMs`, `NEW_CARD_REST_DAYS` | A sticker made at 23:50 is due **10 minutes later**, while one made at 00:10 waits about 24 h. Day 0 never gets a retrieval attempt. The 1m/10m learning ladder only starts on day 1. |
| Review "Good" is `interval × ease`. **Elapsed time is ignored.** | `nextOutcome`, review branch | A 4-day card answered correctly 30 days late gets 10 d, not credit for the 34 days it actually survived. Anki's SM-2 at least adds a lateness bonus. A missed week is punished twice: once with a pile, and again with no credit for surviving it. |
| `LAPSE_MULTIPLIER = 0`. Any lapse resets the card to a 1-day graduation. | `lib/review.ts` | A 200-day card you blank on once goes back to 1 d. This is SM-2's most wasteful habit. FSRS keeps post-lapse stability. |
| There is **no fuzz and no load balancing.** Due times are exact midnights. | `schedule` / `midnightIn` | Capture is bursty: one walk produces 10 stickers at once. Graded the same way, those cards move in **lockstep forever**, so they spike together on the same days. |
| The queue is uncapped and sorted oldest-due first. | `dueToday` | After a break, the user faces the whole pile. Its first cards are the *most overdue*, not the most at risk. |
| **There is no review log**, only the current state per card. | 028/029, `weekActivity` comment | True retention can't be computed, FSRS can't be optimised, and the summary can't tell what was learned over time. This is the biggest infrastructure gap. |
| The hint reveals the first letter, and the grade is not limited afterwards. | `StudyCard` `hintShown` | A hinted "Good" counts the same as an unaided one, so the schedule is inflated. |
| The front face shows the user's **notes**, the date, and "DAY n". | `FrontFace` | A note can contain the answer word, and the photo and date cues are strong. See §1, cue overload. |
| `ReviewSummary` counts **gradings, not cards.** "recalled" = graded − again. | `StudySessionHost` stats | A card failed once and then passed on its re-queue counts as "2 cards reviewed, 1 recalled". The figure is slightly dishonest, and inflated. |
| The headword is always "the object name". `part_of_speech` allows verb and adjective, but the prompt never asks for them. | `cardSchema.ts` LANGUAGE_SCHEMAS | Every card is a concrete noun by construction. |
| The French reading is an **English respelling** ("luh ka-fay"). Japanese uses romaji. Cantonese uses Jyutping with tones. | `cardSchema.ts` | The respelling locks in English phonology (no /y/, /ʁ/ or nasal vowels), and romaji is a crutch that delays reading kana. Jyutping is the right choice. |
| The French headword is "Le Café" (capitalised, with a definite article). | `cardSchema.ts` | The article is meant to carry gender, but **l'** elides it: *l'arbre* and *l'eau* show no gender at all. Capitalising is also un-French. |
| One schedule per sticker, one direction: photo → "What did you call this?" → self-grade with 4 buttons. | `StudyCard` | See §1. |

---

## 1. What the design gets right and wrong as a learning system

### Right, and better than most competitors

1. **It removes the cost of making cards** (the #2 reason people quit SRS in 02_anki_painpoints) while keeping a real scheduler. CapWords stops at the sticker; Tabi goes on to schedule it.
2. **Self-reference and episodic encoding.** It is *your* mug, in your scene, with the day you found it. Self-referential encoding (Symons & Johnson 1997, *lit.*) and a distinctive episode are two of the most reliable memory boosters available. Of everything here, this is what most clearly beats a premade deck.
3. **Dual coding with a referent.** For concrete nouns, picture → L2 form gives two routes into memory (Paivio, *lit.*). Concrete words are also learned faster and forgotten less (de Groot & Keijzer 2000, *lit.*).
4. **Picture → word is form recall, not recognition.** "What did you call this?" asks you to recall the L2 form from its meaning. In Nation's terms that is *productive* (meaning → form) recall, which is the harder and more useful direction (Laufer & Goldstein 2004, *lit.*). The brief calls it "recognition only", which is not quite right. The real gaps are (a) **the recall is never verified**, so the user may "sort of know it" and grade Good, and (b) the **receptive and auditory directions are missing**: hearing or reading the word and getting to its meaning.
5. **The scheduler mechanics are sound for SM-2.** It has Anki's learning and relearning steps, a 20-minute learn-ahead window, a re-queue that carries the patch forward, stacked intervals so the buttons never collapse into each other, and the rule that the preview and the write come from one function. Lesson §12's reasoning about steps is correct.
6. **Sentences are syllabus-driven, not post-hoc.** Lesson §13 is pedagogically right. Choosing the form focus as an *input*, with two targets offered and the choice read back, is a light focus on form inside meaningful input (Long's "focus on form", *lit.*). The syllabus is weighted toward contrasts with English (partitive, *depuis*, counters, classifiers), which is where learners' errors actually are.
7. **The gloss is validated, and dropped whole when it doesn't fit.** A confidently wrong segmentation is a real harm, and this guards against it properly.
8. **Old words are recycled into new sentences** (`renderKnownWords`). Incidental re-exposure in a new context is free spacing and helps decontextualise the word (Webb 2007, *lit.*: repeated encounters build multiple aspects of word knowledge).
9. **Browse mode is kept separate from review mode**, so glancing at a card does not count as practice. This is correct.
10. **The capture quota** (10 scans a day) works by accident as a cap on new cards. Keep that effect even if the quota changes.

### Wrong, or missing

1. **Day 0 has no retrieval.** The code comment says "asking immediately measures nothing". That is true of a test *seconds* after study, when the answer is still in working memory. A retrieval after a gap of minutes, with other items in between, is one of the strongest single interventions in the memory literature: the testing effect (Roediger & Karpicke 2006; Karpicke & Roediger 2008, *lit.*), with expanding or lagged first retrievals (Pyc & Rawson 2009, *lit.*: harder successful retrievals produce more learning). A forgetting curve is at its steepest in the first hours. As it stands, the first retrieval happens anywhere from 10 minutes to about 47 hours after encoding, depending on the clock.
   **Fix:** on insert, write `due_at = now + 10 min, learning_step = 0`. That puts the card on the ladder that already exists, and the 20-minute learn-ahead does the rest. After a scanning walk, offer a "Practise today's finds" pass. The day-1 review then becomes the first *spaced* retrieval, which is the textbook shape.
2. **Self-grading with no commitment.** Pictures produce overconfidence in L2 learning (Carpenter & Olson 2012, *lit.*). Pictures only beat translations once that overconfidence is countered by real retrieval. With "think of it, flip, press Good", the user never has to commit to a form, so the tip-of-the-tongue "kōhī-ish" gets graded Good. **Fix:** make the user commit before the flip: say it into the mic (the button already exists) or type it. Optional, but the default. Any grade after a hint is limited to Hard.
3. **No receptive or listening practice.** For a spoken language, and above all for Cantonese, where most learners' goal is listening and speaking, the most valuable missing skill is *hearing the word and understanding it*. TTS already exists and is never used as a prompt. Receptive and productive knowledge are partly dissociable: training one direction transfers to the other only partially (Webb 2009; Griffin & Harley 1996, *lit.*).
4. **Concrete-noun ceiling.** The 2,000 most frequent word families give about 80–90% coverage of spoken text (Nation 2006, *lit.*), and household object nouns are mostly *outside* that band. They are lovely, memorable and low-frequency. A user who only collects nouns will feel that they "know 300 words" and still be unable to follow a sentence. The sentences carry verbs and grammar, but nothing schedules them. See §3.
5. **Sentence-led teaching is shown, never practised.** The sentence, the gloss and the insight are excellent *input*, but they sit on the back of the card as reading material. No task ever asks the user to *do* anything with the grammar target, so the structure is noticed at best and never retrieved. Cloze on the sentence fixes this. The challenge feature already has the blank-and-type UI.
6. **SM-2 rather than FSRS.** See §4. The specific SM-2 harms in this code are: lapses reset to 1 d, lateness is ignored, ease hell (ease only goes down, with a 1.3 floor and no mean reversion), and no fuzz. All four make missing days more painful, and missing days is exactly the behaviour a casual "fun" app should expect.
7. **Cue overload and encoding specificity.** The same cutout, the same date and the same note on every review train the user to recall *that photo*, not the concept. Varied context improves transfer (Smith, Glenberg & Bjork 1978, *lit.*). **Fix:** rotate the prompt image between the cutout, the full memory photo, a cropped detail, and later a friend's sticker of the same word. Hide the note on the front, or strip the headword from it.
8. **Readings.** The French English-respelling should be replaced: show the audio first, then IPA or nothing (a respelling is unreliable for French vowels and liaison). For Japanese, show **kana** for the reading (furigana over kanji) with romaji off by default, or available only behind a setting. Romaji delays reading and is a known ceiling.
9. **French article.** Use *un/une* (or *le/la* plus an explicit gender tag when the noun elides to *l'*) so gender is always visible. Drop the capitalisation.
10. **The summary counts are not quite honest** (gradings rather than cards, and re-queue passes counted as "recalled"). See §5.

---

## 2. Card types to add, ranked by learning gain per unit of user effort

Model: **one memory per sticker, many faces.** For v1, keep one schedule per sticker and choose the *task format* from the card's stability. Low stability gets the easier formats (listen-and-pick); higher stability gets the harder ones (say it, cloze). This is a desirable-difficulty ladder (Bjork 1994, *lit.*) and it does not multiply the load the way Anki's sibling cards do. Add a separate receptive and productive schedule only later, and only for cards that are already mature (≥ 21 d).

| Rank | Card type | Gain | User effort per card | Build effort | Fun / pretty fit |
|---|---|---|---|---|---|
| 1 | **Say-it-first (production commit).** Photo → hold the mic and say it → flip → hear TTS and your take back to back → grade. Hint limits the grade to Hard. Later, on-device ASR (iOS `SFSpeechRecognizer` supports fr-FR, ja-JP and zh-HK) can auto-suggest the grade. | High. Turns vague recall into committed retrieval, adds articulation (the production effect: saying aloud beats silent reading, MacLeod et al. 2010, *lit.*), and fixes overconfidence. | +2 s | **S.** The recorder already exists in StudyCard. ASR needs a native module, which means an EAS build. | Yes. Hearing your own voice beside the native one is charming. |
| 2 | **Listen → pick the sticker.** TTS plays the word, and four cutouts from *your own collection* float up; tap the right one. Distractors come from the same category for difficulty, or from other categories early on. | High for spoken competence; this is the missing auditory-receptive route. Auto-graded, so no self-grading bias. | 1–2 s | **S–M.** All the assets exist. | **Best fit.** Cutouts popping on cream is the most "sticker-book" interaction available. |
| 3 | **Noun-bound grammar quick-pick.** fr: *un ou une?* (swipe); yue: **which classifier?** (個 / 隻 / 張 / 架 / 條); ja: **which counter?** (〜本 / 〜枚 / 〜匹 / 〜台 / 〜個). | **Very high for this app specifically.** Gender, classifiers and counters are attached to individual nouns. They are the grammar a noun-only app *can* teach well, and they are lifelong error sources. This turns the noun limit into a strength. | 1 s | **M.** Add a `gender` / `classifier` / `counter` field to the card schema registry (`cardSchema.ts`), placed in the enforced order *before* `sentence`. | Yes. A fast swipe is game-like. |
| 4 | **Scene-sentence cloze.** The memory photo plus the sentence with one slot blanked. Early on the slot is the headword; later it is the **grammar target** (the *du*, the を, the 咗) or a collocate verb. Typed, or picked from 3 tiles. | High. Retrieval of the word *in use* (collocation and grammar), and it finally practises the syllabus. | 3–6 s | **M.** Reuse the blanking and normalisation from `ChallengeScreen`. The gloss already gives chunk boundaries for choosing the slot, and validation guarantees they are real. | Good, if it uses tiles and not a keyboard. |
| 5 | **Sentence listening and shadowing.** Play the sentence, the user shadows it into the mic, then compares. | Medium-high. Prosody, chunking and fluency. | 5–8 s | S | Medium. Feels like effort; keep it optional or occasional. |
| 6 | **Jyutping tone card (yue).** Hear the word → pick the tone contour (draw the 6 tone shapes as little curves), or a minimal pair (*si1 / si3 / si6*). | High for Cantonese, where tone errors are the main obstacle to being understood. Nobody else does this well. | 2 s | M | Yes, if the contours are drawn as pretty glyphs. |
| 7 | **Kanji → reading (ja, only words containing kanji).** Show 犬 → recall いぬ; or the reverse, kana → pick the kanji from 3. | Medium-high for ja literacy. | 2 s | S | Medium |
| 8 | **"Which one is X?" multiple choice** (text word → pick the sticker). | Low-medium; recognition only. Good as a warm-up, for comeback sessions, and for brand-new cards in the day-0 pass. | 1 s | S | Very fun, and confidence-building. |
| 9 | **English → say it (no picture).** | Medium. Tests decontextualised production. Use it only for mature cards, as transfer from the photo. | 2 s | S | Low; feels like Anki. Use sparingly. |
| 10 | **Collection "spot it" on a board.** A board scene; "Find the 鉛筆"; tap the sticker on the canvas. | Medium; recognition. | 2 s | M | **Very pretty.** Ties Boards (currently decorative) to learning. |

Two rules apply across all of these. **Auto-graded formats should write the grade themselves** (correct → Good; wrong → Again; slow or hinted → Hard), which removes self-grading bias. **Interleave formats and categories inside a session**: break ties by alternating categories so ten kitchen utensils don't come up in a row. Semantic-set interference is a documented cost (Tinkham 1993; Waring 1997, *lit.*).

---

## 3. Escaping the concrete-noun ceiling, using the photo

The photo is a scene, not just an object. Every scene contains actions, properties, relations and other things.

1. **"Collect from the sentence."** The validated gloss already gives segmented chunks with meanings. Let the user tap a gloss chunk (*boit*, 飲, 高い, *sous*) and collect it as its own card. That needs one cheap `translate-word` call to lemmatise it (*boit → boire*). The new card's prompt is **the same photo plus the sentence with that chunk blanked**. Verbs and adjectives then arrive in context, chosen by the user (a generation-effect bonus), at almost zero build cost. **This is the single best route out of the noun ceiling.** Show these cards as small "word chips" stuck to the parent sticker, so they still feel like stickers.
2. **Collocation card ("what do you do with it?").** Have the model add a `collocation` field: the verb most typical for the noun (*boire un café*, コーヒーを飲む, 飲咖啡; *ouvrir la porte*, ドアを開ける, 開門). Nation's aspects of word knowledge put collocation under *use*; learners who know *café* but not *prendre un café* stall. Practise it as cloze.
3. **Action mode.** A shutter toggle between *Thing* and *Action* (and maybe *Describe*). In Action mode the headword is the **verb** the photo shows (pouring, sleeping, cycling). The vision model can do this, and the syllabus already holds the verb structures (〜ている, 緊, present -er).
4. **Relations from Boards (spatial prepositions).** When the user drops sticker A on, under or next to sticker B on a board, generate *Le chat est sous la table / 猫は机の下にいます / 隻貓喺張枱下面* and offer it as a collectable "phrase sticker". Prepositions and locatives (`fr.prep-lieu`, `ja.aru-iru`, `yue.hai-dou`) are taught by literally arranging stickers. Boards becomes a sentence-building toy, which suits the "fun, pretty" brief.
5. **Contrast pairs for adjectives.** "Find something *bigger*, *older*, *softer* than your mug." This is a scavenger-hunt quest: the new photo's sticker carries the adjective (and the comparative structure from the syllabus). It turns capture into a game and pulls in adjectives in pairs, which are well suited to contrastive learning.
6. **Describe-the-scene (pushed output).** Once a week, show a memory photo and ask "Say one sentence about this", recorded or typed. The model gives *one* gentle recast, not a red-pen correction, and offers the corrected sentence as a card. This is the output hypothesis (Swain, *lit.*) together with recasts. Keep it optional and rare; it is effortful.
7. **Word families and neighbours.** From *café*: *cafetière*, *café au lait*, *un café* (the place). From 車: 車站, 火車, 單車. Offer them as "related stickers you could find", which becomes capture prompts and not auto-added cards. The user still controls intake.
8. **Frequency awareness.** Tag each headword with a rough frequency band, offline from a word list. Show it lightly ("everyday word" vs "specialist word"), and let quests nudge users toward high-frequency things (door, water, eat, big, go). The app should not judge rare nouns; it should simply make the high-yield ones easy to find.

---

## 4. Anti-burnout scheduling

The scheduling *maths* is less important than the *emotional framing of debt*: debt is what makes people quit (02_anki_painpoints §3).

### 4a. Fix the infrastructure first: a review log
Add a `review_logs` table: `sticker_id, user_id, reviewed_at, grade, format, elapsed_days, scheduled_days, state_before, duration_ms, hinted`. Everything below depends on it: FSRS optimisation, honest retention figures, the Reviews calendar for past days, leech detection, and A/B testing of formats. It is cheap to add now and impossible to backfill later. **Ship it before launch, even if nothing reads it yet.**

### 4b. FSRS migration path
- **Library:** `ts-fsrs` (MIT, open-spaced-repetition). Its README says v6 defaults to FSRS-7 and requires Node ≥ 24. **Verify that it runs on Hermes / RN 0.81** before committing; an older 4.x/5.x release (FSRS-5/6) may be the safer pin. The scheduler is pure maths, so it can also run in an edge function. The optimiser is a separate package (`@open-spaced-repetition/binding`) and belongs server-side, as a nightly job per user once they have enough reviews (Anki's guidance is at least a few hundred; default parameters are fine until then).
- **Why:** on srs-benchmark (about 10k Anki collections, roughly 350–520M reviews), FSRS-6 log loss is about 0.346 and RMSE(bins) about 0.065, while FSRS-7 is about 0.337 / 0.059 (fetched 2026-10-29). Plain SM-2 has no recall prediction to score at all; the benchmark had to add a trainable SM-2 variant, which FSRS beats in nearly all collections. Do **not** market "X% fewer reviews"; I found no primary source for that figure.
- **Migration:** keep `lib/review.ts`'s pure-function shape and swap the engine.
  1. Add columns `stability, difficulty, state` (`learning_step` and `due_at` already exist).
  2. Seed existing cards: ts-fsrs can initialise memory state from SM-2 history. Without a log, use the approximation stability ≈ current interval and difficulty from ease. That is good enough, and it self-corrects within a few reviews.
  3. Keep the 1m/10m learning steps (ts-fsrs supports short-term steps).
  4. Turn **fuzz on**, which is essential for bursty capture.
  5. Use FSRS's elapsed-time-aware update, which fixes the lateness and lapse-reset problems for free.
  6. Keep `intervalPreview` reading the same function, so the button labels stay honest.
- **Desired retention as a mood, not a number:** *Chill* 0.80 / *Balanced* 0.87 (default) / *Intense* 0.92. Lower retention means far fewer reviews, and for a hobby app 0.85–0.87 is the right default, not Anki's 0.90.

### 4c. Load control
- **Separate collecting from studying.** Captures are unlimited (within quota), but at most **5 new cards a day** enter study. That matches `DAILY_GOAL = 5`, and the code's own target becomes the intake cap. Extra finds wait as "resting" stickers in the book and enter study on later days, shown with a little "sleeping" state. A rough steady-state load at 5 new a day with FSRS at 0.87 is about 30–50 reviews a day, or 5–8 minutes. That is sustainable. 10 a day roughly doubles it.
- **Auto-throttle:** when the overdue pile is more than about 2 days' worth, pause new cards automatically (WaniKani's community rule).
- **Daily review cap** (default about 15 minutes' worth). When the queue is longer, take the cards with the **lowest retrievability first** (FSRS gives R directly; under SM-2, use relative overdueness), and let the rest roll over quietly.
- **Never show a raw backlog count.** Show "Today: about 6 min". The home header already has minutes, so make it the *only* number shown.
- **Easy days:** an optional "lighter weekends" setting that shifts load with the fuzz window (Anki 24.11's Easy Days).
- **Comeback mode, not a vacation freeze.** After at least 3 missed days: "Welcome back. 12 stickers picked for today," taking the top-N by risk. FSRS's elapsed-time handling means a successful late answer is rewarded. Once the day's set is done, the session is *done*, with no sense of debt. Spread the remaining backlog over 5–7 days (FSRS Helper's "disperse" idea).
- **Leeches:** at 5 or more lapses, interrupt *kindly*: "This one's slippery. Re-shoot a different one? Get a new sentence? Add a memory note?" Encoding again in a new context is the standard leech fix, and only Tabi can offer "take another photo".
- **Day 0:** as §1.1. The first retrieval happens at about 10 minutes, within the scanning session.

### 4d. Review reminders
`expo-notifications` is already installed, and **local** scheduling needs no new native module (check against the SDK 54 docs).
- One reminder a day, at the user's **habitual study time**, learned from the median of their last 7 session start times (in the review log). Before that, ask once in context at the end of the first review: "When's a good time? Morning coffee / Lunch / Evening". This uses implementation intentions (Gollwitzer 1999, *lit.*).
- Only send it if something is due and they haven't studied today. The content should be *a sticker*, not a count: "Your 咖啡 from Tuesday wants to say hi" (with an image attachment if feasible).
- Back off: after 3 ignored reminders, drop to every other day, then weekly. Never threaten a streak. Habit formation takes weeks to months (Lally et al. 2010, *lit.*, median about 66 days), so the aim is consistency without guilt.
- Forgiving streaks: "4 of the last 7 days". Optionally, a week counts when it has ≥ 3 study days.

---

## 5. Honest learning metrics, and what ReviewSummary should show

### Metrics the app can show truthfully
| Metric | Definition | Needs |
|---|---|---|
| **Words in long-term memory** | Cards with stability (or SM-2 interval) ≥ 21 days, Anki's "mature" definition. Label: "words you'll likely still know in 3 weeks". | Current state only. **Can ship today** with `interval_days ≥ 21`. |
| **Words you could recall right now** | Σ retrievability over all cards (FSRS). "If we quizzed you now, you'd get about 132 of your 150." This is honest, it moves gently, and it rewards studying. | FSRS |
| **True retention (30-day)** | Over the last 30 days, the share of *first-of-the-day* reviews of graduated cards that were not Again. Show it beside the target ("88%, aiming for 87%"), so a lower number reads as "on target" and not as failure. | Review log |
| **Words by kind** | nouns / verbs / adjectives / phrases, plus "everyday" (high-frequency) vs "specialist". Makes the noun ceiling visible and gives the user a goal. | Part of speech exists; frequency tag needed |
| **Listening vs speaking** (once formats exist) | Retention split by format. | Review log + format |

Avoid: "accuracy %" per session (it punishes honest Again presses), "words learned" = total stickers (that is a vanity number), and streak-loss alarms.

### ReviewSummary redesign (keep its current non-judgemental spirit)
1. **Fix the counting:** count unique cards. "Recalled" should mean passed *on the first attempt today*. Show "practised again" for cards failed and then re-learned, which frames the failure as having been fixed in-session.
2. **What changed:** "3 stickers moved into long-term memory ✨", meaning they crossed 21 d. Show them as a little row of cutouts, each with a "see you in 3 weeks" tag. That is the most motivating honest signal, and it is pretty.
3. **What's next:** "Tomorrow: about 4 min" (from `weekAhead`). Knowing tomorrow's load reduces anxiety.
4. **Optional link** to a stats page ("Words in long-term memory: 84 · 30-day retention 89%"), kept off the summary itself so the summary stays light.
5. **Day-0 variant:** after the first practice of today's finds: "You've met 6 new words today. We'll check in tomorrow."

---

## 6. Top 10 recommendations, ranked

Effort: S ≤ 1 day, M = 2–5 days, L = 1–2 weeks. Impact is on long-term retention and on retaining *users*.

| # | Recommendation | Effort | Impact | Notes |
|---|---|---|---|---|
| 1 | **Add a `review_logs` table** and write a row per grading (with format and hinted). | S | High (enabling) | Can't be backfilled later. Prerequisite for FSRS optimisation, true retention, past-day calendar and leech detection. |
| 2 | **Day-0 retrieval:** on insert, set `due_at = now+10m, learning_step = 0`; add a "Practise today's finds" pass after scanning. | S | High | Uses the existing ladder. Also fixes the 23:50 vs 00:10 inconsistency. Connects the capture loop to the study loop, which 01_inventory flags as disconnected. |
| 3 | **Commit before reveal:** "say it" mic step by default; hint limits the grade to Hard; hide notes on the front (or strip the headword from them). | S | Med-High | Counters picture overconfidence and inflated grades. |
| 4 | **Anti-burnout defaults:** new-into-study cap of 5 a day (= DAILY_GOAL) with resting stickers; review cap with risk-first ordering; minutes, never counts; comeback mode; leech re-shoot prompt. | M | High (user retention) | Capture is fun and will over-feed the queue; this is the main structural risk. |
| 5 | **Local daily reminder** at the learned habitual time, sticker-faced, with back-off and no streak threats. | S | High (user retention) | expo-notifications is already a dependency. Nothing currently pulls a solo user back. |
| 6 | **Listen → pick-the-sticker card**, auto-graded, distractors from own collection. | S–M | High | The missing auditory-receptive route, and the most on-brand "pretty" drill. |
| 7 | **Migrate SM-2 → FSRS** (ts-fsrs, fuzz on, retention presets Chill/Balanced/Intense, elapsed-time aware). | M | High (long-term) | Fixes lapse resets, ignored lateness, ease hell and lockstep clumps. Verify Hermes compatibility first. Optimiser server-side later. |
| 8 | **Noun-bound grammar quick-picks:** fr gender (un/une), yue classifier, ja counter. New schema field, placed before `sentence`. | M | High | The grammar a noun app can teach best; lifelong error sources. Also fix "Le Café" → "un café" (elision hides gender). |
| 9 | **Collect-from-sentence:** tap a gloss chunk → lemmatise → a new verb/adjective card cued by the same photo with a sentence cloze. | M | High | The cheapest exit from the noun ceiling. Uses the validated gloss. |
| 10 | **Scene-sentence cloze** (headword first, later the grammar-target chunk), reusing ChallengeScreen's blank UI. | M | Med-High | Finally *practises* the syllabus, which is currently shown and never retrieved. |

Next in line: an honest ReviewSummary ("moved into long-term memory", "tomorrow ~4 min", unique counts) is S effort with medium impact and could be bundled with #1. Then readings (French respelling → audio first with IPA optional; Japanese romaji → kana/furigana; keep Jyutping), Jyutping tone cards, rotating the prompt image (cutout / memory photo / friend's sticker), Board-built preposition phrases, Action capture mode, and weekly describe-the-scene.

**Do not do:** auto-add every capture straight into study; show backlog counts; punish missed days with streak loss; show per-session accuracy; add sibling cards per format before load control exists (that doubles the load).

---

### Sources fetched this session
- srs-benchmark (dataset size, FSRS-6/7 log loss and RMSE): https://github.com/open-spaced-repetition/srs-benchmark
- Expertium benchmark explainer: https://expertium.github.io/Benchmark.html
- SM-2 has no recall prediction (so the benchmark uses a trainable SM-2 variant): https://forums.ankiweb.net/t/fsrs-vs-sm2-in-2-seperate-profiles/52171
- ts-fsrs (MIT, v6 defaults to FSRS-7, Node ≥ 24, optimiser in `@open-spaced-repetition/binding`): https://github.com/open-spaced-repetition/ts-fsrs
- Anki deck options (learning steps, Easy Days, load balancer), as cited in the code: https://docs.ankiweb.net/deck-options.html
- Pain-point and burnout evidence: see the scratchpad file 02_anki_painpoints.md.

### Literature cited from memory (not re-fetched)
Nation 2001/2006 (vocabulary size, coverage, aspects of word knowledge); Laufer & Goldstein 2004 (strength of knowledge hierarchy); Webb 2007, 2009 (repetition; receptive vs productive); Griffin & Harley 1996 (direction of learning); Carpenter & Olson 2012 (picture overconfidence); Paivio 1971 (dual coding); de Groot & Keijzer 2000 (concreteness); Symons & Johnson 1997 (self-reference); Roediger & Karpicke 2006, Karpicke & Roediger 2008 (testing effect); Pyc & Rawson 2009 (retrieval effort); Bjork 1994 (desirable difficulties); MacLeod et al. 2010 (production effect); Smith, Glenberg & Bjork 1978 (varied context); Tinkham 1993, Waring 1997 (semantic-set interference); Swain 1985/1995 (output hypothesis); Long 1991 (focus on form); Gollwitzer 1999 (implementation intentions); Lally et al. 2010 (habit formation).
