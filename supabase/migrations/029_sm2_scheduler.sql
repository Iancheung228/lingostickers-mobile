-- ============================================================
-- LingoStickers — SM-2 per-card scheduling state
-- ============================================================
-- 028 recorded *that* a card was studied. These three record how well, which
-- is the part that makes it spaced repetition rather than a review log: until
-- now every card advanced along one shared ladder
-- (REVIEW_MILESTONES[review_count]), so a word you blanked on moved exactly
-- like one you answered instantly.
--
-- ease_factor / interval_days are the two SM-2 state variables. Interval is
-- kept in whole days on purpose — the app has no intraday scheduling and no
-- learning steps, so the queue only ever changes at midnight and lib/review.ts
-- stays a pure function of calendar dates.
--
-- 2.5 is SM-2's standard starting ease; the algorithm floors it at 1.3, below
-- which intervals barely grow and a card effectively never leaves the queue.
--
-- interval_days = 0 means "never studied". Such a card's clock runs from
-- discovered_at instead, and rests one day before first coming up — you have
-- only just seen it while scanning.
--
-- review_count (028) deliberately stays a monotonic "times studied" counter
-- for the card's own badge, and is NOT reset on a lapse. Lapses get their own
-- column so the two questions — "how often have I studied this" and "how often
-- have I forgotten it" — can't be confused for one another.

ALTER TABLE public.stickers
  ADD COLUMN ease_factor   REAL    NOT NULL DEFAULT 2.5,
  ADD COLUMN interval_days INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN lapses        INTEGER NOT NULL DEFAULT 0;
