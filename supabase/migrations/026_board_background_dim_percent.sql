-- ============================================================
-- LingoStickers — board background tint becomes a continuous 0-70% slider,
-- replacing the four fixed levels (none/light/medium/dark)
-- ============================================================
-- Only boards.background_dim changes here — profiles.home_background_dim
-- (the separate home-screen mini wall cover photo) keeps its fixed levels,
-- since only the per-board tint got a slider control.

ALTER TABLE public.boards
  DROP CONSTRAINT boards_background_dim_check,
  ALTER COLUMN background_dim DROP DEFAULT;

-- Map existing string values to the opacity percentages they used to render
-- as (see the old DIM_OPACITY table) before the column becomes numeric.
ALTER TABLE public.boards
  ALTER COLUMN background_dim TYPE INTEGER
  USING (
    CASE background_dim
      WHEN 'none' THEN 0
      WHEN 'light' THEN 18
      WHEN 'medium' THEN 38
      WHEN 'dark' THEN 58
      ELSE 38
    END
  );

ALTER TABLE public.boards
  ALTER COLUMN background_dim SET DEFAULT 38,
  ADD CONSTRAINT boards_background_dim_check CHECK (background_dim BETWEEN 0 AND 70);
