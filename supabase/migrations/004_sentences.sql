-- ============================================================
-- LingoStickers — Sentences, not just words (Phase 3)
-- A short sentence describing the object in the scene it was found in,
-- in both the target language and English. Defaults to '' so existing
-- stickers render fine without a sentence.
-- ============================================================

ALTER TABLE public.stickers
  ADD COLUMN sentence TEXT NOT NULL DEFAULT '',
  ADD COLUMN sentence_translation TEXT NOT NULL DEFAULT '';
