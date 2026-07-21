-- ============================================================
-- LingoStickers — trim offsets for recorded pronunciation, so
-- playback can skip leading/trailing silence without re-encoding
-- the stored audio file
-- ============================================================

ALTER TABLE public.stickers
  ADD COLUMN voice_note_start_ms INTEGER,
  ADD COLUMN voice_note_end_ms INTEGER;
