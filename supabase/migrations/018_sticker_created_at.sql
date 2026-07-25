-- ============================================================
-- LingoStickers — Track row-insertion time separately from discovered_at
-- ============================================================
-- discovered_at means "when the memory happened" (backdated to the photo's
-- own EXIF date on import) and stays the source of truth for the calendar
-- and story chapters. created_at is purely "when this landed in your
-- collection", for a "recently added" sort in the grid.
--
-- Backfill for existing rows: there's no way to recover the true original
-- insert time, so this approximates it with each row's own discovered_at —
-- accurate for live captures and challenge wins (which always set
-- discovered_at to the actual creation moment), an approximation for
-- photo imports (which may have backdated discovered_at to the photo's own
-- date). Better than clumping every existing sticker onto this migration's
-- run time.

ALTER TABLE public.stickers
  ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.stickers SET created_at = discovered_at;
