# Tabi Stickers — plan v3: functionality only (2026-10-30)

This plan supersedes `00_PLAN_v2.md` for this round of work.

## Scope rules for this round

- **Functional features only.** No visual redesign, themes, token renames,
  Alert→toast swaps or animation work.
- **Don't change what's there** unless the change serves a functional
  purpose. Boards, the home wall, the calendar, friends and the current look
  all stay as they are.
- **Name:** stays **Tabi Stickers**.
- **Languages:** stay **French, Cantonese, Japanese**. No new languages this
  round.
- **Onboarding:** leads with **Quick Add**.
- **Pitch** (unchanged from v2): a better, customisable Anki for language
  learning, any part of speech.

## Priority order

1. **Scene prompts.** One photo, many words: different prompts teach
   different parts of the scene.
2. **Quick Add.** Any word, phrase or idiom, typed in either language.
3. **Word-type-aware cards.** Verb forms, noun gender/counter, idiom literal
   vs meaning.
4. **Anki-grade basics.** Decks and tags, undo, no lost grades, same-day
   first review, backlog guards, reminders.
5. **Launch blockers** that are functional (below).

---

## 1. Scene prompts — "one photo, many words"

**Today (verified in code):** a photo yields exactly one noun.
`identifyFromPhoto` (`_shared/vocab.ts:161`) receives the crop plus the
uncropped scene, and is told to name only the object in the crop.

**New:** after taking or importing a photo, the user picks a **prompt**.
Each prompt asks the model a different question about the scene, or about a
part of it.

| Prompt | Asks for | Part of speech | Example (café photo) |
|---|---|---|---|
| **What is it?** | the object (today's path, cutout sticker) | noun | *une tasse* |
| **What's happening?** | actions in the scene, or things you'd do here | verb | *verser, siroter* |
| **What's it like?** | colour, texture, state, size | adjective | *fumant, ébréché* |
| **How?** | manner of the actions | adverb | *lentement* |
| **Where is it?** | position and relationships | preposition / phrase | *à côté de* |
| **Say it like a local** | idioms and set phrases the scene evokes | idiom | *boire un coup* |
| **What would you say here?** | a useful sentence for this situation | phrase | *L'addition, s'il vous plaît* |
| **Ask your own…** | a free-text question, capped at 80 chars | any | "what would the barista say?" |

**Focusing on part of the scene.** The existing box/lasso extractor
(`PhotoExtractor`) is reused. If you draw around part of the photo first,
the prompt is about that part ("What's happening *here*?"). If you skip it,
the prompt is about the whole scene. The crop-plus-scene pair the pipeline
already builds is exactly the input this needs.

**Flow:**
1. Take or import a photo.
2. Optionally mark a region.
3. Pick a prompt. "What is it?" stays the default, so today's path is
   unchanged.
4. See 3–6 word chips, each with its translation and part of speech.
5. Tap the ones you want, then press Save.
6. Each selection becomes a full card. Every card from one photo shares that
   photo and a `scene_id`.
7. After saving, you can ask another prompt about the same photo, so one
   photo can keep yielding words.

**Not repeating itself.** Each request sends the words already taken from
this scene, plus the user's existing headwords, as an avoid list.

**Images.** "What is it?" keeps the cutout sticker. The other prompts use
the region crop as the card's image, or the scene if there was no region.
They need no cutout, which is cheaper and faster.

**Learning hygiene.** Learning several words from one scene in a single
batch causes interference: similar items learned together get confused.
Siblings that share a `scene_id` are therefore never shown back to back in a
session. The new-card cap (backlog guards) also stops one photo from flooding
the queue.

**Cost:** one cheap call per prompt (chips use only the word fields), plus
one call per saved card. At about $0.0013 a call that's negligible. Each
counts against the existing per-user quota (`consumeQuota`).

**Backend:**
- `scene-words` is a new edge function: image + optional crop + prompt +
  language + avoid list → candidates. The prompts live in a registry in
  `_shared/`, so adding one is data, not code.
- Full cards come from `create-card` (shared with Quick Add), given the
  chosen headword plus the scene, so the example sentence is about *your*
  photo.

## 2. Quick Add (also the onboarding)

- Type or paste a word, phrase or idiom, in English or the target language.
  `create-card` returns a full card; an image is optional.
- When there's no image, the card renders text-only in the existing card
  components, purely so it doesn't show a broken placeholder.
- Duplicate check: "You already have this one. Add this as a new example
  instead?"
- Onboarding: pick a language → AI consent → Quick Add ("Type a word you
  learned this week"). The camera is offered on the second card.

## 3. Word-type-aware cards

`part_of_speech` gains `idiom`. A new `forms` field comes from the same
`cardSchema.ts` registry (lessons #15), shaped by part of speech:

| Part of speech | `forms` contains |
|---|---|
| Verb | fr: infinitive, present, passé composé + auxiliary. ja: dictionary / masu / te / nai. yue: aspect markers 咗/緊/過 usage |
| Noun | fr: article + gender. ja / yue: counter or classifier |
| Adjective | fr: agreement forms. ja: i/na type |
| Idiom | literal gloss, real meaning, register |

The study card's back shows these as extra rows, in the existing styling.

## 4. Anki-grade basics (functional)

- **Decks + tags.** The noun-only categories are hidden; their column is
  kept. Boards stay unchanged.
- **`review_logs`** before launch, since history can't be backfilled. FSRS
  comes later.
- **Same-day first review.** A new card is due 10 minutes after it's saved,
  not at midnight (`lib/review.ts:46`).
- **Undo** the last grade.
- **Grades are never lost offline.** A write queue retries them (today they
  are rolled back silently).
- **The scan/draft survives an app kill.**
- **Backlog guards:** at most 5 new cards a day, no new cards when more than
  60 reviews are due, and "~N min" shown instead of a count.
- **Daily review reminder,** using local notifications.
- **Post-save confirmation:** "We'll ask you this one in 10 minutes", with
  *Add another* and *Open deck*. No animation work.
- **Funnel analytics events.**

## 5. Functional launch blockers (from the first pass)

| # | Item | Who |
|---|---|---|
| B1 | Groq receives photos undisclosed → `LLM_FALLBACK=off` | you (secret) |
| B2 | Aptabase missing from the privacy policy | you / loop |
| B3 | Sign-out leaves the push token on the old user (`useAuth.ts:58`) | loop + you apply the migration |
| B6 | No app-wide AI spend breaker. More urgent now that scene prompts multiply calls | loop + you deploy |
| B7 | No crash reporting (Sentry needs a native build) | you (EAS yes) |
| B11 | Supabase Free fills at about 10 engaged users → Pro | you |

## Deferred (not this round)

Themes and layout editor, contrast and token work, replacing Alerts, the app
icon redesign, new languages, OCR text mining, Anki import/export, FSRS,
extra card directions (listening, production, cloze), voice capture, share
extension, widget, paywall.

## Human steps the loop can't do

- Apply migrations:
  - `image_path` nullable
  - `forms` jsonb
  - `idiom` added to `part_of_speech`
  - `scene_id`
  - decks/tags
  - `review_logs`
- Deploy `create-card` and `scene-words`.
- Write the human-owned unit tests named in `feature_list.next.json`.
- Make the harness v2 changes (`00_SYNTHESIS.md` §9).

---

## Status — 2026-10-30 (backend for priorities 1–3 shipped)

**Done:**
- **Migration `043_any_word_cards.sql`, applied to production and verified
  by query:**
  - `image_path` is nullable.
  - `forms` jsonb and `scene_id` uuid were added, with an index on
    `(user_id, scene_id)`.
  - The *existing* `source` check (from 006) now allows `scene`, `text`,
    `mined` and `onboarding`.
  - The first attempt failed because `source` already existed. The
    transaction rolled back, and the retry proves it.
- **`create-card`, deployed.** Turns any word, phrase or idiom, typed in
  either language, into a full card. It can also take a scene and an
  optional crop, plus the chosen chip. Quota: 40/day.
- **`scene-words`, deployed.** Covers the 8 prompts in
  `_shared/scenePrompts.ts`, with an optional crop, the custom question
  fenced off as data, and an avoid list. Quota: 25/day.
- **`send-challenge`, redeployed.** It refuses a card that has no picture
  with a 400, instead of failing on the snapshot copy.
- **Shared code:**
  - `cardSchema.ts` gains `idiom`, `forms` + `formsRules` +
    `normalizeForms`, and a headword wording that isn't tied to nouns.
    The scan path's wording is unchanged.
  - New `requestImages.ts` caps image size (413 over about 3MB).
- **`scripts/test-any-word.mts`:** 45 tests, now part of `npm test`.
  - Gate: 110/110 tests, typecheck, deno check, lint at 0 errors / 43
    warnings (unchanged).

**Live check against production, as the QA account:**
- *to run late* → *être en retard* (idiom, literally "to be in delay").
- *courir* → correct je/nous/passé composé forms.
- 猫の手も借りたい → idiom with its literal gloss.
- "to eat too much" (yue) → 食得滯 with 咗/緊/過 forms.
- The scene prompts returned sensible chips in fr/ja/yue.
- Guards all returned 400.

**Open findings:**
1. **Latency spikes.** Steady state is 1.6–2.0 s per scene prompt, but
   the first call in a batch took 23–46 s three times. The cause is not
   determined (the CLI has no `functions logs`; check the dashboard). The
   likely cause is Gemini retries, or failover to Groq while
   `LLM_FALLBACK` is still on. If it is failover, photos are reaching Groq,
   which is blocker B1 again.
2. **Prompt adherence.**
   - "What's it like?" (ja) returned one noun (陶器) among the adjectives.
   - "Say it like a local" (yue) returned colloquialisms rather than
     idioms.
   - Tune with `scripts/prompt-lab.mts` on more photos before the UI ships.
3. **`lib/types.ts` is not yet updated** for nullable `image_path` and
   `forms`/`scene_id`. No row can be image-less until the Quick Add /
   scene UI writes one, so the app is safe as it stands. The UI features
   must update the type and handle null.

**Next:** the client features `quick-add` and `scene-prompt-capture` (in
`feature_list.next.json`), then `pos-aware-card`.
