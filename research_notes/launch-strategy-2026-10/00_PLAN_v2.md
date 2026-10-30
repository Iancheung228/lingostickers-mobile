# Tabi — revised plan v2 (2026-10-29)

> **Superseded for this round by [`00_PLAN_v3.md`](./00_PLAN_v3.md):** functionality only, no visual changes; scene prompts first; fr/yue/ja only; name stays Tabi Stickers.

Supersedes the pitch, aesthetic thesis and phase order in `00_SYNTHESIS.md`.
The travel-notebook metaphor is **dropped**: no stamps, washi or specimen
labels. Still valid from v1: the launch blockers (§6 here), the learning
science, the cost math and the harness v2 changes.

Founder's priorities, in order:
1. **Pitch:** a much better, customisable Anki for language learning, in
   any language.
2. **Capture beyond nouns:** verbs, adjectives, adverbs, idioms.
3. **Functional Anki-grade features.**
4. **Lower friction everywhere.**

---

## 1. The pitch

> **"Anki, rebuilt for language learners. Capture any word or phrase in
> seconds — from a photo, a sentence, a menu or your own head — and get a
> beautiful card you can shape however you study."**

Short form for the store subtitle: *"Flashcards that make themselves"* or
*"Your Anki, beautiful & effortless"*. Avoid "Anki" in the store name; it is
a trademark.

**Why it beats Anki** (pain-point numbers from `02_anki_painpoints.md`):

| Anki pain | Tabi answer |
|---|---|
| #2 Making cards is the barrier | AI builds the whole card from any input: reading, audio, example, gloss, conjugation |
| #4 Ugly, 1995 UI | Designed cards, themes and layouts with no HTML/CSS templates |
| #5 Setup takes an hour | Good defaults: FSRS, sensible limits, card directions picked per word type |
| #1 Review backlog | Daily caps, minutes not counts, catch-up mode (Phase 3) |
| #6 Knows the card, not the language | Every card carries a real example sentence; production, listening and cloze directions |
| #8 Leeches | Auto-detect, then "give it a new example / photo / mnemonic" |
| Lock-in fear | Anki import **and** export from day one |

**Competitors under this pitch** (more relevant now than CapWords):

- **Noji** (formerly Anki Pro): polished consumer Anki at $4.99/mo,
  $29.99/yr, $74.99 lifetime. It is general-purpose, with no language-specific
  card intelligence and no capture-from-the-world.
- **Migaku:** the immersion power tool. Strong sentence mining, but heavy
  and expensive.
- **CapWords:** photo-only and noun-only. Tabi's photo capture becomes *one
  of several* input methods rather than the identity, which also defuses the
  4.3(b) copy risk.

**The defensible gap:** a language-aware card (part of speech, conjugation,
gender, reading, tones, idiom literal vs real meaning) + effortless capture
from anywhere + real SRS + it looks good. Noji has the polish but no
language brain; Migaku has the brain but is hard to use; Anki has the power
but neither the polish nor the ease.

**Languages:** make the language list data-driven and add the biggest
learner markets. The order follows learner-market size; see the caveat
below.

- **Already supported:** fr, ja, yue.
- **Add:** es, ko, zh (Mandarin, pinyin), de, it, pt.
- **Cost per language:** a prompt config (word / reading / sentence notes)
  in `_shared/vocab.ts`, a TTS locale and a font check. The **syllabus is
  optional** per language, so a language without one still gets cards.
  Pinyin and Korean romanisation need prompt care.

*Caveat:* the ordering is my judgement from general market knowledge; no
agent researched it this session.

---

## 2. Priority 1 — Capture anything, not just nouns

**Today (verified):** every card starts from an image (`create-sticker`).
Text only enters as a *correction* (`translate-word` in
`scan.tsx:731` / `StudyCard.tsx:170`), and only English-to-target.
`PARTS_OF_SPEECH` already includes `verb, adjective, adverb, phrase`
(`cardSchema.ts:50`), so the schema is closer than the UI. `CATEGORIES`
(Kitchen/Animals/Study/Nature) is noun-shaped and must give way to decks
and tags.

### Capture modes, by value ÷ effort

| # | Mode | What the user does | Unlocks | Effort | Native? |
|---|---|---|---|---|---|
| C1 | **Quick Add (type or paste)** | Type a word or phrase *in either language* ("to run late", "courir", "猫の手も借りたい") → card in about 2 s | All POS, idioms, anything heard in class | **S–M** (extend `translate-word` into `create-card`) | No |
| C2 | **Scene → many words** | One photo returns chips for nouns *and* the action and qualities in it ("pouring", "steaming", "carefully"); tap the ones you want | Verbs/adj/adv from the camera, the existing magic, extended | M (prompt + chip UI) | No |
| C3 | **Text in the world (OCR mining)** | Photograph a menu, sign, book page or subtitle → tap words or phrases → cards, keeping *that* sentence as the example | Sentence mining, the top Anki workflow, without a PC | M (Gemini reads the text; no VisionKit needed) | No |
| C4 | **Mine from your own cards** | Tap any chunk of an existing card's example sentence → "make a card" | Verbs/adjectives at zero effort | **S** (gloss chunks exist) | No |
| C5 | **Batch paste / list import** | Paste a class vocab list → N cards | Students, teachers' lists | S–M | No |
| C6 | **Anki & CSV import** | Bring your `.apkg` / CSV; Tabi enriches the cards (audio, example, gloss) | **Acquisition wedge:** switchers keep their history | M–L (server-side parse) | No |
| C7 | **Voice capture** | "How do you say *I'm running late*?" → card | Hands-free, phrases | M (Gemini audio input) | No |
| C8 | **Share sheet / Shortcut / widget quick-add** | Share selected text from Safari, Kindle or Netflix → card | Zero-friction capture from anywhere | L | **Yes** (extension target) |

**Pictures for non-nouns.** The image becomes *optional* per card, in
priority order:

1. The user's photo (scene or OCR source).
2. An emoji or icon the model picks.
3. A typographic card that uses the word itself as the art.

AI-generated illustrations are deferred: they cost money and risk looking
cheap.

### Word-type-aware cards ("note types", done for you)

The model already returns `part_of_speech`. The card *layout* and *extra
fields* follow it:

| Type | Extra fields generated | Default directions |
|---|---|---|
| Noun | gender/article (fr/de/es/it/pt), counter/classifier (ja/zh/yue), plural | meaning→word, picture→word |
| Verb | infinitive + key forms (fr: present/passé composé/aux; ja: dictionary/masu/te/nai; es: yo/tú + preterite), transitivity, common object | meaning→word, cloze in sentence |
| Adjective | agreement forms (fr/es), i-/na- (ja), comparative | meaning→word, opposite pair |
| Adverb | position note, a contrasting example | cloze |
| Idiom / phrase | **literal gloss vs real meaning**, register (casual/formal), when to use, 2 examples | meaning→phrase, situation→phrase |
| Grammar point | pattern, 2 examples, the existing syllabus entry | cloze |

This extends `_shared/cardSchema.ts` with a field registry keyed by POS,
following lessons #15 (one registry, prose and schema projected from it,
field order still load-bearing).

---

## 3. Priority 2 — Customisation (what "better Anki" means visually)

There's no imposed metaphor; the user shapes the card. Anki's power without
HTML:

- **Card layout editor.** Toggle which fields appear on front and back,
  reorder them by drag, set per deck. Ship 4–5 presets first ("Minimal",
  "Full context", "Picture first", "Reading practice", "Exam mode") and the
  free-form editor second.
- **Themes.** A handful of curated palettes + fonts (serif/sans/rounded,
  plus the per-script fonts already in place), plus a **dark mode**, which is
  currently off in `app.json` and needs the native build. Per-deck theme
  colour so decks are visually distinct.
- **Personal fields.** Mnemonic, personal note, your voice recording
  (exists), your own photo; "My example sentence" overrides the generated
  one.
- **Card directions per deck.** Recognition, production, listening, cloze
  and typing, each switchable.
- **Design quality, metaphor-free** (from `13_design.md`):
  - Fix contrast: `inkLight` fails AA; add `ink500`.
  - Use semantic tokens.
  - Replace the 64 `Alert.alert`s with a toast and a confirm sheet.
  - Ship a real app icon.
  - Tidy home duplicates.
  - Add one haptics module.

  All remain worth doing.

---

## 4. Priority 3 — Anki-grade functional features

What an Anki user will look for in the first 5 minutes, marked as present or
needed:

| Feature | State today | Plan |
|---|---|---|
| Decks | ✗ (boards are visual, not decks; categories are noun-only) | **Decks + tags**; boards can stay as a gallery view of a deck |
| Multiple card directions per note | ✗ (picture→word only) | Note → N cards; listening and production first |
| Typed / spoken answer check | ✗ | Type-in with fuzzy accents; "say it" with on-device recognition later |
| FSRS + desired retention | SM-2 | `review_logs` **now** (can't backfill), FSRS via `ts-fsrs` next |
| Daily new/review limits, load balancing | ✗ (goal of 5 is cosmetic) | Per-deck limits, fuzz, minutes-not-counts |
| Undo last answer | ✗ (verify) | Must-have |
| Suspend / bury / leech handling | ✗ | Auto-flag at 8 lapses → "new example / photo / mnemonic" |
| Custom study / cram / study ahead / by tag | ✗ | Filtered sessions |
| Browse & search with filters | Partial (no sentence or tag search) | Full-text over all fields + filters (deck, POS, due, leech) |
| Stats | ✗ | Retention %, review heatmap, 30-day forecast, words mature |
| Reminders | ✗ | Daily local reminder |
| Offline study | ✗ (grades lost offline) | Write queue first, cached decks next |
| Import / export | ✗ | **Anki .apkg + CSV, both ways** |
| Shared decks | ✗ | 1.1+: share a deck with a friend (friends system exists) |
| Bulk edit / move / tag | ✗ | Browse multi-select |

---

## 5. Priority 4 — Lower friction

1. **Capture in two taps.** A persistent "+" on every screen opens Quick Add
   with the keyboard already up and the camera one tap away. Typing beats
   photographing for most non-nouns.
2. **Nothing is required.** AI fills every field. You can save instantly and
   edit later. Image optional.
3. **Either-language input.** Type the English or the target word. The model
   detects which and fills the other.
4. **Duplicate detection.** "You have *courir* already. Add this as a new
   example instead?" This strengthens the old card (new context helps
   memory) rather than cloning it.
5. **Two-button grading option** (Again / Good). FSRS works well with it and
   it halves decisions per card. The four-button scale stays for those who
   want it.
6. **Study starts where you land.** If anything is due, home's primary
   button is "Study · ~6 min". New cards are first due in 10 minutes, not at
   midnight (`NEW_CARD_REST_DAYS = 1`, `lib/review.ts:46`).
7. **Account later.** Try 3 cards before signing up (anonymous auth). *Your
   call*: it changes auth and RLS.
8. **Onboarding = capture.** Pick a language, then "type a word you learned
   this week". The first card arrives in under 30 s; the camera is
   introduced on the second card.
9. **Smart defaults over settings.** Directions chosen per word type, limits
   chosen per level, no settings screen needed to start.
10. **Leave and come back gently.** A catch-up mode after days away, never
    a 400-card wall.

---

## 6. Still non-negotiable before submission (from v1, unchanged)

- Groq photo disclosure: set `LLM_FALLBACK=off`.
- Aptabase in the privacy policy.
- Sign-out push token.
- Offline grade loss.
- Draft loss on app kill.
- AI spend breaker.
- Sentry.
- App icon.
- `review_logs`.
- Contrast.
- Supabase Pro.

These run in parallel with Phase 1; several are small.

---

## 7. Revised phases

**Phase 1 — "Any word, beautiful card" (core of the new pitch)**
- C1 Quick Add (either language, any POS, idioms) via a new `create-card`
  function; image optional.
- POS-aware card fields and layouts (verb forms, gender, idiom literal vs
  meaning).
- C4 mine from a sentence chunk.
- Decks + tags, replacing noun-only categories.
- `review_logs` + same-day first review + undo.
- Launch blockers in parallel.

**Phase 2 — "Anki-grade"**
- Card directions: production, listening, cloze, typed answer.
- Daily limits and minutes-not-counts; leech handling.
- Browse/search with filters and bulk actions.
- Stats screen; daily reminder.
- Layout presets + themes.

**Phase 3 — "From anywhere"**
- C2 scene → many words; C3 OCR mining; C5 batch paste.
- C6 Anki/CSV import + export.
- FSRS with desired retention; two-button option.
- More languages (es, ko, zh, de, it, pt).

**Phase 4 — 1.1**
- C7 voice capture; C8 share extension + widget (native).
- Free-form layout editor; shared decks.
- Paywall.
  - Free: capped AI cards/day, all reviews and import/export.
  - Paid: unlimited capture, OCR, themes, stats depth.

**Native build batch:** Sentry, icon, dark mode, EAS Update, RevenueCat;
later share extension + widget. One EAS build each time, with your yes.

---

## 8. Decisions for you

1. Store name: keep "Tabi Stickers"? "Stickers" undersells a serious Anki
   alternative. Consider "Tabi Cards" or "Tabi: Language Flashcards".
2. Anonymous try-before-signup: yes or later?
3. Which new languages first? I'd pick es, ko, zh.
4. Should the photo/sticker cutout stay the hero of onboarding, or should
   Quick Add be? I recommend Quick Add first and photo second.
5. Keep boards and the home wall as a gallery view of decks, or cut them?
