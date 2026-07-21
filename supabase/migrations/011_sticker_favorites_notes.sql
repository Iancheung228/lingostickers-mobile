-- ============================================================
-- LingoStickers — Favorites and personal notes on stickers
-- ============================================================

ALTER TABLE public.stickers
  ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN notes TEXT;
