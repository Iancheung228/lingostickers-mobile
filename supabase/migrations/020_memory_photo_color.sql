-- ============================================================
-- LingoStickers — Dominant color of each sticker's memory photo
-- ============================================================
-- Computed server-side (create-sticker / submit-challenge-answer edge
-- functions) at the moment the memory photo is uploaded/copied, using the
-- same weighted-HSL-average approach as pickBorderColor. Stored once so the
-- client never has to decode the photo itself — StickerDetailView uses it
-- to tint the word card so the detail screen feels color-matched to that
-- specific photo.
--
-- Null for: stickers with no memory photo, and existing rows created before
-- this column existed (backfilled separately by a one-off script, since
-- that requires downloading + decoding each photo — not expressible in
-- plain SQL).

ALTER TABLE public.stickers
  ADD COLUMN memory_photo_color TEXT NULL;
