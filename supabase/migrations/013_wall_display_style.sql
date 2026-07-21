-- ============================================================
-- LingoStickers — wall display preference (framed card vs bare cutout)
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN wall_display_style TEXT NOT NULL DEFAULT 'framed'
    CHECK (wall_display_style IN ('framed', 'cutout'));
