-- ============================================================
-- LingoStickers — per-board background photo, replacing the single
-- global wall background that used to live on profiles
-- ============================================================
-- Each board now carries its own cover photo, so a user can give every
-- board its own look instead of one background shared across all of them.
-- Storage convention: `${userId}/board-${boardId}-background.jpg` in the
-- existing sticker-images bucket (per-owner-folder RLS already covers it).

ALTER TABLE public.boards
  ADD COLUMN background_path TEXT,
  ADD COLUMN background_dim TEXT NOT NULL DEFAULT 'medium'
    CHECK (background_dim IN ('none', 'light', 'medium', 'dark'));

-- The old global setting is gone from the Settings screen — drop it rather
-- than leave dead columns around. home_background_path/dim (the separate
-- home-screen mini wall cover photo) is untouched.
ALTER TABLE public.profiles
  DROP COLUMN wall_background_path,
  DROP COLUMN wall_background_dim;
