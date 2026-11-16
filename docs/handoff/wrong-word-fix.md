# Wrong-word fix ("Not a dog?") — handoff

Branch `feature/wrong-word-fix`, on top of `origin/feature/calendar-reimagine`.
Written by a cloud agent with no Simulator and no Supabase secrets: **nothing
here has run against a real model or a real device.** Section 4 lists exactly
what is and isn't verified.

## 1. What changed

**The bug:** a whole toy-town cutout became "Le chien / The dog". Three causes,
three fixes:

| Cause | Fix |
|---|---|
| The prompt let the model name a detail inside the cutout | New rule in `create-sticker`'s prompt: name what the cutout depicts **as a whole**; the context photo is only context (`WHOLE_RULE` in `_shared/vocab.ts`, both with-scene and no-scene preambles) |
| Fixing was invisible (tap the English to edit) | A text button under the meaning on the reveal: **"Not a dog?"** (falls back to **"Wrong word?"**), 44pt tall, no `hitSlop` (the sentence below it is tappable — lesson 9). Opens a sheet. |
| The fix swapped the headword only, keeping the old sentence, and never looked at the image | Every correction now re-runs `create-sticker`'s vocabulary step on the same cutout and replaces the **whole card** |

### The sheet (`components/WrongWordSheet.tsx`)
- **Chips:** 2–3 alternatives from the original scan call (target word + English). Tap → new card for that word.
- **"What is it?" field** (English or target language, 60 chars). Submit → new card, with the text as the user's statement of what the object is.
- Built on `BottomSheet` (all exits through one `requestClose`; while a card is being made no exit leaves, the sheet settles back). Pending spinner on the tapped chip / submit button. Errors go through `friendlyError` (lesson 3), shown in an `InlineError` in the sheet.
- Form hygiene (lesson 11): `autoComplete="off"`, `textContentType="none"`, `autoCorrect={false}`, `returnKeyType="done"` submits, `maxLength=60`.
- The previous headword is added to the alternatives after a correction, so a mis-tap is one tap to undo.

### Backend (`create-sticker`, `_shared/*`) — backward compatible
- **Request:** new optional `hint`, `chosenWord`, `chosenTranslation`. Old builds never send them → first-scan path unchanged. A correction **requires** `precutImagePath` (400 otherwise) and the existing path validation applies, so it cannot point at someone else's file.
- **Response:** new `alternatives: [{word, translation}]` (always present, possibly `[]`). Old builds ignore unknown fields. No other field changed. **No DB migration.**
- **No re-cut, no new upload:** the client resends the same close-up `image` + `contextImage` and the existing `precutImagePath`, and does **not** send `memoryImage` (the only thing that triggers a memory-photo upload). Image fields in the response are the existing ones; the client keeps its own.
- **Alternatives** live in the one card-schema registry (`_shared/cardSchema.ts`, lesson 15): new `FieldKey 'alternatives'`, rendered as prose *and* JSON Schema from the same entry. Only first scans ask for them (`SCAN_FIELDS`); corrections use `CARD_FIELDS` (no second round of chips). Placed before `sentence`, so the model commits to what the cutout *is* before writing about it. `normalizeAlternatives` keeps only well-formed entries, drops the headword and duplicates (article/accent-insensitive), caps at 3.
- **Sentence follows the word (C):** `_shared/headword.ts` `sentenceContainsHeadword` — handles French articles and elision (`l'arbre`, curly apostrophes), plurals incl. `cheval→chevaux`, accent folding, katakana/hiragana equivalence, CJK substring, parentheticals and `a / b` alternatives. `identifyFromPhoto` asks up to twice (the retry says what was wrong); the second failure throws `LlmError('mismatch')` → HTTP 422 "We couldn't make a card that fits that. Try again, or tell us what it is." For a tapped alternative it also requires the model to return *that* word (`sameHeadword`). An empty `word` (nothing recognised) is **not** a mismatch — callers keep handling it as before. This validation applies to **all** `create-sticker` calls, first scans included.
- New `LlmError` kind `mismatch`: not retried by `callModel`, never failed over (another model gets the same question), 422.
- The hint/chosen text is fenced as data (`"""`), newline/fence-stripped, capped at 60 chars, and the prompt says it is never instructions.

### The translate-word question (C, "your call") — routed through the hint path
The meaning-edit on the reveal (tap the English) no longer calls `translate-word`; it calls the same correction path with `hint = what they typed`. Reasons: one code path for three entry points; `translate-word` only ever sees a bare English word, so it can't regenerate a matching sentence or look at the image; and fixing it in place would have meant a second sentence-generating prompt to keep in sync. **`translate-word` itself is untouched** (older builds, and `StudyCard`/`lib/cardEdit.ts` still use it for editing a *saved* card, where the stored sentence is the learner's own and is deliberately left alone).
Cost of the choice: a meaning edit now costs a full card generation (one `create-sticker` call, ~2s) and counts against the same 100/day budget as a scan, instead of a cheap translate-word call.

### Client
- `lib/wordFix.ts` (pure, tested): label, alternatives parsing, request body, `applyCorrection`. `lib/regenerateCard.ts`: the call. `StickerDraft.alternatives` added; both draft builders (`app/(tabs)/scan.tsx`, `lib/batchScan.ts`) fill it.
- Single scan: the close-up is kept in `cropRef`, **keyed by the draft's `imagePath`**, so a restored/other draft can never reuse the wrong crop. Batch: the close-up is still in the queue item's payload.
- The control is hidden when a correction can't work (no close-up held, or the cutout isn't a `.png` — the server's JPEG fallback when background removal fails).
- `CardBack` got an `underHeadword` slot (reveal only).
- Batch (F): `useBatchCreate.correct` replaces `editWord`; corrections write into the queue item, so they survive closing/reopening the review.

## 2. Files
Server: `supabase/functions/_shared/{headword.ts (new), cardSchema.ts, vocab.ts, llm/types.ts}`, `create-sticker/index.ts`.
Client: `components/{WrongWordSheet.tsx (new), DiscoveryReveal.tsx, CardView.tsx}`, `lib/{wordFix.ts, regenerateCard.ts (new), types.ts, batchScan.ts}`, `hooks/useBatchCreate.ts`, `app/(tabs)/scan.tsx`.
Tests/docs/flows: `scripts/test-wrong-word.mts` (new, in `npm test`), `.maestro/agent/wrong-word-fix.yaml` (new), `.maestro/agent/batch-create.yaml` (comments only: its word-edit step is now a `create-sticker` call), `docs/lessons.md` #19 + `skills.md`.

## 3. Deploy to STAGING (owner runs; nothing was deployed)
```
scripts/deploy.sh staging functions create-sticker
```
Backend first, then the app (lesson 18). Only `create-sticker` changed (it imports the changed `_shared` files). `translate-word` doesn't need a deploy. **Do not deploy to production until you have run section 5 on staging** — and production is your call, per lesson 18.
Old builds against the new function are safe by construction (additive response, optional request fields); the one behaviour change they *do* see is the sentence-contains-headword gate, which can now turn a rare bad card into a 422 "try again" instead of a mismatched card.

## 4. Verified vs. unverified
**Verified here**
- `npm run typecheck` ✅, `npm run lint` ✅ (0 errors; 48 warnings = the same 48 as before), `npm test` ✅ (195 tests; 35 new in `scripts/test-wrong-word.mts`: headword validator in all three languages, the retry/fail path with a scripted fake provider, alternatives parsing on both sides and their parity, prompt content (whole-cutout rule, fenced hint, no alternatives on corrections), schema registry JSON-validity/key parity/order, label, request body (no `memoryImage`), `applyCorrection`).
- `deno check` **passes for** `_shared/vocab.ts`, `headword.ts`, `cardSchema.ts` and `_shared/llm/*.ts` (Deno 2.9.6 installed via npm). **`npm run typecheck:functions` itself could not run:** `esm.sh` (imported by `create-sticker/index.ts` and others) is blocked by this environment's egress proxy, and `deno.land` too. So `create-sticker/index.ts` is **not** deno-checked; its edit is ~35 lines of plain TS (new destructured fields, one new call argument) and the only function it calls with a new signature, `identifyFromPhoto`, is checked. Run `npm run typecheck:functions` once on your machine.

**NOT verified (everything that needs a simulator or a live model)**
- Whether the real model, with the new prompt, names the toy town and not the dog. **This is the actual bug and it is untested** — a prompt change can't be reviewed by reading (lesson 13). Run `scripts/prompt-lab.mts` against the toy-town photo and a few others (see §5) before trusting it.
- Alternatives quality; whether Gemini honours the new `alternatives` schema field; added latency/tokens of the field (small, but unmeasured); whether a hint in either language reliably yields a headword the sentence contains.
- The mismatch rate in practice (false rejections from the validator, e.g. an irregular plural like `œil→yeux`, or a verb-ish headword; or the model really failing twice).
- All UI: layout of the "Not a …?" button, the sheet over the reveal (a `Modal` inside a `Modal`, as the edit bar already is), keyboard avoidance, chip wrapping with long words/Dynamic Type, dark mode, VoiceOver, the pending states, the batch flow end to end.
- That Gemini treats the stored JPEG crop identically on the second call (it should — same bytes — but the crop is held in memory on the client, so a relaunch mid-review loses it and the control hides).

## 5. How to test on the simulator
1. Deploy to staging (above); `npm run dev` pointed at staging; `harness/qa.sh` checks Metro + the build.
2. Quick run: `.maestro/run.sh` with `.maestro/agent/wrong-word-fix.yaml` (3 AI calls on staging). Look at the screenshots (`01`…`06`): control visible under the meaning, sheet open (with chips), card changed after the hint, the old word offered back, card changed after the chip.
3. By hand, the real case: import the toy-town photo, lasso the whole diorama.
   - Does the first card name the town, not the dog? (the prompt fix)
   - Is "Not a …?" visible under the meaning, readable in light and dark?
   - Open it: chips present? Tap one → word, reading, sentence, gloss all change; the sentence contains the word.
   - Type "toy town" (then in the target language) → same.
   - Tap the English meaning, type something → whole card regenerates (not just the word).
   - Airplane mode / stop the function → friendly error inside the sheet, sheet stays, chip/button usable again.
   - Batch (2–3 photos): do all of the above on card 2, close and reopen the review, the correction is still there.
   - Add the card; check the collection row has the corrected word/sentence and the same image.
4. Prompt check without the app: `node --experimental-strip-types scripts/prompt-lab.mts` (needs a Gemini key; run with the staging project's key, never production's).

## 6. Owner decisions
1. **translate-word routing** (above): hint path chosen. If you'd rather keep meaning-edits cheap, the alternative is a text-only `translateWord` that also returns a sentence — but it would be blind to the image, which is the original bug.
2. **Quota:** each correction spends one `create-sticker` quota unit (the shared 100/day). A user who tries four words in a row spends four. Options: a separate `create-sticker:correct` quota key (`consumeQuota` takes a name) with its own, smaller limit — I didn't invent a number for you.
3. **Validation strictness:** the headword check is deliberately lenient on French endings (`cheval→chevaux`: prefix match) and, as a consequence, would also pass `chevalier` for `cheval`. That errs towards not rejecting good cards. Say so if you want it stricter.
4. **Validator now gates every scan**, not just corrections (request C said "server-side"). If staging shows false rejections, loosen it or make first scans fall back to returning the card with a warning.
5. The cloud-held close-up lives only in memory; a corrected card after an app relaunch isn't possible. Persisting it was out of scope.
6. Dismissing the sheet with text typed loses the text (no prompt) — 60 characters didn't seem worth a dirty-check.
