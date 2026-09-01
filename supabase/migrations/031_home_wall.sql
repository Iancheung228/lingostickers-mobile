-- ============================================================
-- LingoStickers — the home screen's mini wall becomes something
-- you arrange yourself, instead of an auto-generated fan.
-- ============================================================
--
-- Deliberately NOT reusing boards/board_stickers (014_custom_boards.sql).
-- A board is a full-screen canvas holding dozens of stickers; the home
-- panel is a short, wide strip holding a handful. An arrangement made for
-- one reads wrong squeezed into the other, and folding them together would
-- also make the home "Arrange" button a second, redundant door onto the
-- Boards tab — which is exactly the confusion this change is fixing.

CREATE TABLE public.home_stickers (
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sticker_id UUID        NOT NULL REFERENCES public.stickers(id) ON DELETE CASCADE,
  -- NORMALIZED (0-1) fractions of the canvas, not pixels — unlike
  -- board_stickers.x/y, which are absolute px tied to whatever canvasSize
  -- happened to be live. The same arrangement here has to render both in
  -- the ~360pt-wide home panel and in the editor's larger canvas, so
  -- storing pixels would land half the wall off-panel. x/y are the tile's
  -- top-left corner; lib/homeWall.ts owns the fraction -> px conversion
  -- and the matching tile size, so both surfaces agree.
  x          REAL        NOT NULL DEFAULT 0,
  y          REAL        NOT NULL DEFAULT 0,
  rotation   REAL        NOT NULL DEFAULT 0,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, sticker_id)
);

CREATE INDEX idx_home_stickers_user ON public.home_stickers(user_id);

ALTER TABLE public.home_stickers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "home_stickers: own rows only"
  ON public.home_stickers FOR ALL
  USING (auth.uid() = user_id);

-- Distinguishes "never arranged" (show the auto fan of newest + favorites)
-- from "arranged, and currently empty" (show the empty state). Without it,
-- clearing your wall would silently repopulate it with the auto fan, which
-- reads as the app undoing what you just did.
ALTER TABLE public.profiles
  ADD COLUMN home_wall_arranged BOOLEAN NOT NULL DEFAULT FALSE;
