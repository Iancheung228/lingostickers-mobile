-- ============================================================
-- LingoStickers — home-screen mini wall background, independent
-- of the full Wall tab's own background (wall_background_path)
-- ============================================================
-- Same storage convention as 019_wall_background.sql: stored in the
-- existing sticker-images bucket at `${userId}/home-background.jpg`,
-- already covered by that bucket's per-owner-folder RLS policy.

ALTER TABLE public.profiles
  ADD COLUMN home_background_path TEXT,
  ADD COLUMN home_background_dim TEXT NOT NULL DEFAULT 'medium'
    CHECK (home_background_dim IN ('light', 'medium', 'dark'));
