-- ============================================================
-- LingoStickers — Study-card fields: part of speech + review state
-- ============================================================
-- Three columns behind the Anki-style study card (components/StudyCard.tsx),
-- which flips between a prompt side and an answer side.
--
-- part_of_speech: rendered as the "MEANS · NOUN" qualifier on the answer
-- side. Produced by the vision model alongside the rest of the vocab in
-- supabase/functions/_shared/vocab.ts, so it's filled going forward only —
-- null for existing stickers, which render a bare "MEANS". Backfilling it
-- would mean re-running the vision model against each original photo (same
-- reasoning as 021_sentence_insight.sql), and unlike a grammar note this one
-- is cheap to live without.
--
-- review_count / last_reviewed_at: the first real record that a sticker was
-- actually studied. Until now lib/review.ts inferred "due today" purely from
-- how old a sticker was, because nothing recorded that you'd ever looked at
-- one — so the queue couldn't tell a card you review daily from one you've
-- never opened. These two turn that guess into an actual expanding-interval
-- schedule: the next due date is discovered_at/last_reviewed_at plus the
-- interval at review_count's position in the milestone list.
--
-- review_count defaults to 0 rather than null so the scheduler never has to
-- special-case "never reviewed" as a missing value — a 0-count sticker is
-- simply one whose clock still starts at discovered_at.

ALTER TABLE public.stickers
  ADD COLUMN part_of_speech   TEXT        NULL,
  ADD COLUMN review_count     INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN last_reviewed_at TIMESTAMPTZ NULL;

-- The due-today query orders every sticker a user owns by when it next comes
-- up; without this it's a full scan of the user's collection on every home
-- screen load.
CREATE INDEX stickers_user_review_idx
  ON public.stickers (user_id, last_reviewed_at, review_count);
