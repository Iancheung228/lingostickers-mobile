-- ============================================================
-- LingoStickers — user-recorded pronunciation per sticker
-- ============================================================

ALTER TABLE public.stickers
  ADD COLUMN voice_note_path TEXT;
