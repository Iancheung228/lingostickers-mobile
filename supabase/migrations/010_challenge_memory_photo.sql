-- ============================================================
-- LingoStickers — Snapshot the memory photo too, not just the cutout
-- ============================================================

-- Nullable: not every sticker has a memory photo (pre-Phase-5a stickers).
ALTER TABLE public.sticker_challenges
  ADD COLUMN snapshot_memory_photo_path TEXT;
