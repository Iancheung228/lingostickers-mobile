-- ============================================================
-- LingoStickers — learning steps and a minute-granular due time
-- ============================================================
-- 029 said, in as many words, that the app has "no intraday scheduling and no
-- learning steps, so the queue only ever changes at midnight". That was the
-- source of the complaint these columns exist to fix: on a card you had just
-- met, Again, Hard and Good all resolved to the same interval — one day — so
-- three of the four buttons were the same button, and answering honestly that
-- you had blanked on a word bought you nothing over answering that you knew
-- it. A grading scale whose options don't differ isn't a scale.
--
-- Anki's answer, and the one lib/review.ts now implements, is that a card
-- being *learned* is not on the day-granular ladder at all. It walks a short
-- ladder of minutes (1m, 10m by default) and only graduates onto the
-- day-granular SM-2 ladder once it has been answered correctly through the
-- end of that ladder. A lapse drops a graduated card onto a second, shorter
-- ladder (10m) rather than straight back to "tomorrow".
--
-- due_at: the authoritative moment the card next comes up, which is what the
--   day-granular arithmetic in 028/029 could only *infer* from
--   last_reviewed_at + interval_days. Minute-granular, because a learning
--   step is measured in minutes. Review-card due times are still written at
--   local midnight of the target day, so the day-granular feel — the queue
--   turning over overnight rather than reshuffling through the afternoon — is
--   unchanged for every card past its learning steps.
--   NULL means "never scheduled by the new code"; lib/review.ts falls back to
--   the old last_reviewed_at + interval_days inference for those rows, in the
--   user's own timezone, which is why they are deliberately NOT backfilled
--   here: a UTC date_trunc would shift the due day for anyone west of GMT.
--
-- learning_step: position on whichever ladder the card is on, or NULL for a
--   card in plain review. Which ladder is implied by interval_days, exactly as
--   Anki distinguishes them: a card on a step with interval_days = 0 has never
--   graduated (learning), one with interval_days > 0 has lapsed back
--   (relearning), and its stored interval is what it graduates back onto.
--   Existing rows get NULL, which reads as: already-studied cards are review
--   cards (correct — they graduated under the old scheduler), and cards with
--   no last_reviewed_at are new (also correct).

ALTER TABLE public.stickers
  ADD COLUMN due_at        TIMESTAMPTZ NULL,
  ADD COLUMN learning_step SMALLINT    NULL;

-- The due queue is now a question about due_at rather than about
-- last_reviewed_at + interval_days, so the index from 028 no longer covers
-- it. Kept alongside rather than replacing it: 028's index still serves the
-- review-count ordering used to break ties.
CREATE INDEX stickers_user_due_idx
  ON public.stickers (user_id, due_at);
