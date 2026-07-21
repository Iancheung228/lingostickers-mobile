-- ============================================================
-- LingoStickers — cutout border style (white outline / shadow / none)
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN cutout_border_style TEXT NOT NULL DEFAULT 'shadow'
    CHECK (cutout_border_style IN ('shadow', 'outline', 'none'));
