# Pass A (functional): the card in every mode

Verified against `StudyCard.tsx`, `StudySessionHost.tsx`, `ReviewSummary.tsx`, `lib/review.ts`, baseline 03/04. Findings that surprised me:
- `Sticker.forms` (gender, conjugations, idiom literal meaning) is stored by scene/typed cards but **rendered nowhere**.
- `hintLetter()` takes the first character of the stored word, so "Le Café" hints "L". Useless for French.
- `DAILY_GOAL = 5` is a display ring only. There is **no new-card limit**, and no suspend, reset or review log anywhere.
- The back face has no audio autoplay, and TTS is the only audio (the mic take is the only recorded voice).

## 0. Principle
One card, three postures, **one component** (`CardView`: front, back, detail body):
- **Study:** a quiz. Photo front, answer back, nothing destructive, nothing editable.
- **Detail:** a reference page. It opens on the *answer*, not the quiz.
- **Reveal:** the same back, with Add/Discard, shown once.

Retrieval practice (Roediger & Karpicke) means the study front must withhold the word, and the study back must be fast to read. The memory (note, place, date) is why the casual user cares, so it sits one tap from the answer, never in the way.

## 1. Field inventory

| Element | Verdict | Why | Lives |
|---|---|---|---|
| Photo/cutout | keep | Dual coding, and the card's cue | Front (hero); back as 56pt thumb; detail hero |
| Word (Teacher's hand, with article) | keep | The answer | Back (largest); detail |
| Reading (IPA / kana / jyutping) | keep, always shown for ja/yue | The part a learner can't self-check; Cantonese tones are not guessable | Back under word; detail |
| TTS speaker | keep, **autoplay once on flip** (setting, default on) | Audio-first for tonal languages; hearing precedes reading | Back inline with reading |
| Mic / record | **move** to detail (see 5) | No feedback, 80pt of study back | Detail only |
| Part of speech | keep as small chip beside meaning | Disambiguates, and aids Hint | Back; detail |
| Meaning | keep | | Back |
| Example sentence (target word bolded) | keep | Context sentence beats isolated word (Nation, vocabulary-in-context) | Back |
| Sentence translation | keep, one tap under sentence | Don't give away sentence before the learner tries | Back (revealed) |
| Word-by-word gloss | **collapse** under "More" | Essential for ja/yue, noise for fr; value is on first meeting | Back "More"; reveal open by default |
| Grammar insight | collapse under "More" | Same | Back "More" |
| `forms` (gender, conjugation) | **add** | Fr gender is the #1 recurring error; data already exists | Back "More"; article already in word |
| Note ("what happened") | **move** to back as the Memory line | Front note can leak the answer and adds reading (learning-r2); on the back it is the reward | Back; detail (editable) |
| Place / date shot | **move**, merge into the Memory line ("Paris · 12 Nov"); hide when empty | "SHOT AT · Not recorded" is empty content | Back; detail |
| Big date "12 Thursday", month, year | cut | Chrome, duplicates date | nowhere |
| Avatar + username | cut | Friends off, always "You" | nowhere |
| "DAY n" | cut | Meaningless counter | nowhere |
| "NEW CARD / 1ST REVIEW / n REVIEWS" | cut from study; replace by status text in detail | Noise mid-session | Detail |
| Language label "FRENCH" | cut in study; keep in detail | | Detail |
| Perforation / ticket footer | cut | Physical metaphor, and it eats ~90pt | nowhere |
| Mono uppercase field labels (WORD/SAY IT/MEANS/IN USE) | cut in study; sentence-case labels in detail only | Content is self-evident | Detail |
| Share / download | move to "..." | Not a review action | Detail menu; Reveal |
| Delete | **cut from study**; detail "..." with confirm | Destructive control in a quiz header | Detail menu |
| Favourite | add to "..." in study; heart in detail | Anki "flag" equivalent | Both |
| Hint pill | keep, make tiered (see 2) | Desirable difficulty with a safety valve | Front |
| "Still learning — one more look" | keep | Explains the requeue | Front |
| "Tap to reveal" | keep (Maestro) | | Front |
| "pull down to close" | cut after first session, keep gesture | | Front |
| Progress "n / m" | keep + thin 2px bar | Maestro `2 / 2` | Study top |
| Remove from board | detail only | Narrow, rare | Detail menu |
| Edit pencils per field | study: none; detail: tap the field | Lesson #9: no flip gesture in detail, so whole-field tap is safe | Detail |
| Review stats (interval, ease, lapses, due, last) | **add** | Anki users expect it; all columns exist | Detail "Progress" block |

## 2. The front
**Prompt is production: photo (or meaning) -> recall the word.** Recognition (word -> meaning) is easier and tests a weaker trace; for vocabulary from your own photos, free recall from the image is the right default. Chosen by card, not by user:

| Card has | Front shows | Prompt |
|---|---|---|
| scan photo | photo only | "What did you call this?" |
| scene sibling (shared photo) | photo dimmed + English meaning | "How do you say 'X'?" (existing) |
| no photo (typed / mined) | English meaning, POS chip | same |

**The word never appears on the front.** Only exception: a later reading-direction sibling card (needs a per-direction schedule, so schema, so later).

**Hint, tiered, per language** (fixes the article bug):
1. POS + letter/character count, with the article dropped for fr and its *gender* given ("masculine, 4 letters").
2. First letter/character.
3. For ja: first kana. For yue: tone count, e.g. "2 syllables, tones 3-1".

Cantonese is audio-first: **no audio on the front** (it would be the answer), but autoplay on flip. Japanese: the back shows kanji with kana reading underneath (RN has no robust ruby), with romaji off. Show kana only on request via "More".

## 3. The back
Order, top to bottom, one screen, no scroll for a typical card:
1. Word (40pt) with article, with the speaker inline.
2. Reading (20pt), then meaning (22pt) with POS chip.
3. Sentence (target word bold), translation tap-to-show.
4. Memory line (one muted line, hidden if nothing to show, tap opens detail).
5. "More" disclosure: word-by-word, grammar tip, forms.

The thumbnail sits top-right at 56pt so the cue stays visible while you read. The flip is ~220ms (420ms today), and instant under Reduce Motion.

## 4. Grading
**Agree with the prior team, with three amendments.**
- **Four buttons stay.** Again and Good are primary (~38% wide each); Hard and Easy are secondary (~12%), labelled, with intervals at 13pt tabular. Anki parity matters for the serious user and the *interval text is the explanation* a casual user needs. Keep exact strings "Again — next review in…".
- **Colour without colliding with the action rose:** the grade row never uses a solid rose-brown fill.
  - Again: tint #F6E3E1 background, #A8434A text, a rotate-back icon. It is never a solid fill, so it can't be confused with #9D4D51 elsewhere (ΔE 9 is a problem only for like-for-like fills). Colour is never the only signal: icon, position and label.
  - Hard: sand with #7A5A1E text.
  - Good: solid #3F6E46.
  - Easy: pale green tint, #3F6E46 text.
  - Ramp red -> green (lesson #12). Filled brand rose appears only on Done/Start.
- **Casual path:** a **Simple grading** setting (Not yet / Got it -> Again / Good), offered once after the first completed session, not in onboarding (nothing to compare yet). Swipe L = Again, R = Good with a colour wash and haptic; Hard/Easy stay drawn buttons only.
- **Undo:** 5s toast "Undo" after every grade. It restores the pre-grade fields, and the host re-inserts the card at the cursor. This is the most-wanted missing piece in the critics' notes.

## 5. The mic
**Cut from study. Keep in detail, rebuilt as shadowing.** Recording with no feedback is a toy, but *self-comparison* is real pedagogy (Pimsleur, shadowing research): a single "Compare" button plays native TTS, then your take, back to back. Keep hold-to-record (it solved a hot-mic bug), drop the 80pt hint paragraph for a one-line caption. No ASR scoring in this release (needs a backend).

## 6. Detail vs study
**Shared component, different chrome.**
- Detail opens on the **answer page** (photo hero, word, reading, meaning, sentence, memory, Progress block). Today it opens on the quiz front (baseline 03a), a giant blank card for someone who just wants to look something up.
- A "Test me" button flips it into the quiz view.
- Edit is tap-on-field, in the `FieldEditor` sheet (word/reading/meaning+POS/sentence/note). That keeps the follow-the-word lookups and the "Update the sentence too?" alert.
- **Editing is *not* a study-mode feature** (a typo mid-session is a "..." -> Edit card shortcut that opens the detail sheet).
- Detail "..." menu: favourite, share, save, remove from board, reset progress, delete.

| For Anki users | This release | Later |
|---|---|---|
| Undo last grade | **must** | |
| Progress block (interval, ease, lapses, reviews, due, last), from existing columns | **must** | review-history list (needs a revlog table) |
| Reset progress (patch to defaults) | **must** (JS-only) | |
| Bury siblings (same `scene_id` / same photo skip the rest of the session) | **must** (JS-only, queue filter) | |
| Suspend | **must-lite**: nullable `suspended_at` column, additive, 1.0.0-safe | |
| Leech flag (lapses >= 8, with the tag/prompt to suspend or edit) | | later |
| Tags | no (category exists) | later |
| Export | | later (edge function) |

## 7. Session flow
- **Start:** Home Due card and Calendar's day Review both open the same `StudySessionHost`. Keep both entry points (strings preserved), but they must build the queue identically.
- **Limits (none today):** new cards per day default **10**, stored on-device (AsyncStorage, JS-only), review cap soft 200. New = `review_count === 0`; shown as "7 due + 3 new". Prevents the backlog spiral that is Anki's top quit reason.
- **Close mid-session:** every grade is already saved, so closing is safe. Keep without a confirm. The summary title becomes "Session done" only when the queue emptied; on early exit "Stopped early" (Maestro only needs "Session done" on completion).
- **Requeue:** keep "n / m" (the `2 / 2` string), but as a bar of *unique* cards, so an Again doesn't read as moving goalposts. The "Still learning" label already explains the return.
- **Summary:** keep it small, no percentages (existing rule). Add "Next card in 10m" or "Tomorrow: 8 due", a list of the "to revisit" words (tappable to detail) and a quiet "Study 5 more" for the keen. Keep "Session done", "1 card reviewed", "Done".
- **Reveal after a scan:** this is the best moment, so keep. Same back component, Add/Discard/Retry; word-by-word open by default here (first meeting), and the scene picker unchanged. The reveal should state the *prompt it will become* ("You'll see this photo and be asked the word") once, to teach the loop.

## 8. What would make it clearly better than Anki (JS-only)
1. **Zero authoring:** photo -> card with reading, sentence, gloss, audio in seconds. Say so; it's the wedge.
2. **Memory line as reward:** your own note/place on the back of the card. Anki can't do this with any ease.
3. **Scene siblings:** one photo seeds several parts of speech and idioms; sibling burying makes them feel like a story, not five cards.
4. **Gloss + forms** (gender, conjugation) on the back where Anki decks omit them.
5. **Cloze-from-your-own-sentence** for photo-less cards: hide the target word in the sentence on the front (data exists; JS-only).
6. **Honest limits and undo**, which make the daily loop calm.

## Maestro impact
- Edit-meaning flows (`.maestro/agent/edit-*.yaml`) tap "What did you call this?", flip, then tap at "87%,45%" for the pencil. With detail opening on the answer and tap-on-field editing, these agent flows need rewriting (they are agent-owned, not human-approved).
- Approved strings stay valid: 'Tap to reveal.*', 'What did you call this\?', grade labels with "next review in", '2 / 2', 'Close this card', 'Session done', '1 card reviewed', 'Done'.
- "Session done" on early exit is the only copy decision needing the owner.
