-- ============================================================
-- LingoStickers — Word-by-word gloss, and which structure the card teaches
-- ============================================================
-- Two columns behind the sentence rewrite in
-- supabase/functions/_shared/{vocab,syllabus,gloss}.ts.
--
-- sentence_gloss: the sentence split into chunks, each paired with what that
-- chunk means here — [{"t": "机の上に", "g": "on the desk"}, …]. The card has
-- always shown a sentence and its English translation and never shown which
-- part of one corresponds to which part of the other. In French that costs a
-- learner some guesswork; in Japanese and Cantonese it is fatal, because the
-- script is unsegmented and a beginner cannot even tell where one word ends
-- and the next begins. Stored as JSONB rather than a side table because it is
-- read only ever as a whole, only ever alongside its own sticker, and is
-- never queried into.
--
-- The array is validated server-side before it is written: concatenating the
-- chunks must reproduce the sentence, spacing and punctuation aside, or the
-- whole thing is stored as NULL (see normalizeGloss). A wrong segmentation is
-- worse than no segmentation — it teaches boundaries that do not exist,
-- confidently — so this fails closed rather than storing a partial answer.
-- The app re-runs the same check at render time (lib/gloss.ts), because a
-- sentence that is later hand-edited leaves its old gloss behind describing a
-- sentence that no longer exists.
--
-- grammar_key: which structure from the language's syllabus the sentence was
-- built around ('fr.depuis', 'ja.te-iru', 'yue.zo'…). Two jobs. It is read
-- back on the next scan so the rotation can avoid teaching the same structure
-- three cards running — which is why it is stored rather than inferred: the
-- model is offered two targets and picks the one the photo can carry, so what
-- it actually used is a fact only it knows. And it is a record of what this
-- collection has covered, which is the beginning of being able to show a
-- learner their own progress through the syllabus.
--
-- Both are NULL for every existing sticker, and stay that way. Backfilling
-- would mean re-running the vision model against each original photo, which
-- risks changing the sentence itself — the same reasoning as
-- 021_sentence_insight.sql and 028_study_card_review_state.sql. A card with
-- no gloss renders exactly as it does today.

ALTER TABLE public.stickers
  ADD COLUMN sentence_gloss JSONB NULL,
  ADD COLUMN grammar_key    TEXT  NULL;

-- Every scan now reads the tail of the user's own collection to build the
-- prompt: their recent headwords (to re-expose a word they already met) and
-- the grammar keys of their recent cards (to avoid repeating a structure).
-- That query is `where user_id = ? and language = ? order by created_at desc
-- limit 40`, and none of the existing indexes serve it — stickers_user_due_idx
-- (040) and stickers_user_review_idx (028) are both ordered for the review
-- queue. Collections are small enough that the sort was never going to be the
-- bottleneck, but this is on the hot path of every scan, so it gets the index
-- that matches it exactly.
CREATE INDEX stickers_user_language_recent_idx
  ON public.stickers (user_id, language, created_at DESC);
