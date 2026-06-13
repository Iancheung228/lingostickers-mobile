-- ============================================================
-- LingoStickers — Memory Photo (Phase 5a)
-- Stores the full, uncropped photo alongside the sticker cutout so the
-- app can "flip" a sticker to reveal the original moment.
-- Nullable: existing stickers and any future failed uploads simply have
-- no memory photo to flip to.
-- ============================================================

ALTER TABLE public.stickers
  ADD COLUMN memory_photo_path TEXT;
