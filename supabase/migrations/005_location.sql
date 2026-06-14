-- ============================================================
-- LingoStickers — Where (and a clearer when) this memory happened (Phase 4)
-- GPS coordinates + a reverse-geocoded place name, captured at sticker
-- creation time. NULL means "no location captured" — a meaningful state,
-- so no defaults. Used to auto-cluster stickers into scrapbook "chapters".
-- ============================================================

ALTER TABLE public.stickers
  ADD COLUMN latitude DOUBLE PRECISION,
  ADD COLUMN longitude DOUBLE PRECISION,
  ADD COLUMN location_label TEXT;
