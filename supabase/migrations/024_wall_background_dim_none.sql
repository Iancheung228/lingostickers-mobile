-- ============================================================
-- LingoStickers — "None" background dim option, so the raw
-- uploaded photo can be previewed with no darkening scrim at all
-- ============================================================

ALTER TABLE public.profiles
  DROP CONSTRAINT profiles_wall_background_dim_check,
  ADD CONSTRAINT profiles_wall_background_dim_check
    CHECK (wall_background_dim IN ('none', 'light', 'medium', 'dark'));

ALTER TABLE public.profiles
  DROP CONSTRAINT profiles_home_background_dim_check,
  ADD CONSTRAINT profiles_home_background_dim_check
    CHECK (home_background_dim IN ('none', 'light', 'medium', 'dark'));
