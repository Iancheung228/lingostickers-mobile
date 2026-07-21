-- ============================================================
-- LingoStickers — user-created custom boards (freeform, draggable
-- sticker arrangements, separate from the auto chapter wall)
-- ============================================================

CREATE TABLE public.boards (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_boards_user ON public.boards(user_id);

ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "boards: own rows only"
  ON public.boards FOR ALL
  USING (auth.uid() = user_id);

-- Join table: which stickers are on which board, and where the user
-- dragged each one to. user_id is denormalized here (rather than joining
-- through boards) so the RLS check doesn't need a subquery.
CREATE TABLE public.board_stickers (
  board_id   UUID        NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  sticker_id UUID        NOT NULL REFERENCES public.stickers(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  x          REAL        NOT NULL DEFAULT 0,
  y          REAL        NOT NULL DEFAULT 0,
  rotation   REAL        NOT NULL DEFAULT 0,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (board_id, sticker_id)
);

CREATE INDEX idx_board_stickers_board ON public.board_stickers(board_id);

ALTER TABLE public.board_stickers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "board_stickers: own rows only"
  ON public.board_stickers FOR ALL
  USING (auth.uid() = user_id);
