-- ============================================================
-- LingoStickers — user-uploaded wall background photo
-- ============================================================
-- No new storage bucket/policy needed: the background is stored in the
-- existing sticker-images bucket at `${userId}/wall-background.jpg`, which
-- is already covered by that bucket's per-owner-folder RLS policy.

ALTER TABLE public.profiles
  ADD COLUMN wall_background_path TEXT,
  ADD COLUMN wall_background_dim TEXT NOT NULL DEFAULT 'medium'
    CHECK (wall_background_dim IN ('light', 'medium', 'dark'));
