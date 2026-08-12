-- ============================================================
-- LingoStickers — One-line learning callout alongside the sentence
-- ============================================================
-- Generated alongside the sentence (create-sticker) or when the user
-- hand-edits it (translate-sentence): a short English note naming either a
-- grammar pattern the sentence uses or one bonus word it introduces —
-- surfaced in StickerDetailView so the "extra teaching" in the sentence is
-- actually noticed, not just passively read past.
--
-- Null for existing stickers — regenerating this retroactively would mean
-- re-running the vision model against each sticker's original photo, which
-- risks changing the sentence itself; left as a graceful no-callout state
-- for anything created before this existed.

ALTER TABLE public.stickers
  ADD COLUMN sentence_insight TEXT NULL;
