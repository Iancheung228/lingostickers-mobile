-- 048: a per-user library of saved board backgrounds.
--
-- Until now a board's background lived only on that board
-- (`{user}/board-{board}-background.jpg` + `-background-source.jpg`, migrations
-- 025 and 032), so using the same photo on a second board meant finding it in
-- Photos again. Every photo picked as a board background is now also kept here,
-- uncropped, so it can be chosen and re-cropped for any board.
--
-- Boards do NOT reference these rows or files. Choosing a saved background runs
-- the normal crop flow and writes the board's own cropped copy and source, so
-- deleting a library entry can never blank a board, and app builds from before
-- this migration keep rendering boards exactly as before (backward compatible:
-- nothing existing is altered).
--
-- Files: `{user_id}/backgrounds/{id}.jpg` (the source, long side <= 2048) and
-- `{user_id}/backgrounds/{id}.thumb.webp` (grid thumbnail, derived by convention
-- like every other thumbnail, lib/thumbnails.ts). Both sit under the user's own
-- folder, so the existing `sticker-images` policies from 046
-- ("own images only b4jimg_0..3": bucket_id = 'sticker-images' AND
-- auth.uid()::text = (storage.foldername(name))[1]) already cover them:
-- foldername('{uid}/backgrounds/x.jpg') = {uid, backgrounds}, element 1 = uid.
-- No storage policy change is needed.

CREATE TABLE public.saved_backgrounds (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  path       text        NOT NULL,
  width      int,
  height     int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX saved_backgrounds_user_created_idx
  ON public.saved_backgrounds (user_id, created_at DESC);

ALTER TABLE public.saved_backgrounds ENABLE ROW LEVEL SECURITY;

-- Owner-only. No UPDATE policy: a saved background is immutable (add or delete).
CREATE POLICY "saved_backgrounds: owner select"
  ON public.saved_backgrounds FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "saved_backgrounds: owner insert"
  ON public.saved_backgrounds FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "saved_backgrounds: owner delete"
  ON public.saved_backgrounds FOR DELETE
  USING (user_id = (SELECT auth.uid()));

COMMENT ON TABLE public.saved_backgrounds IS
  'Per-user library of uncropped board-background sources. Boards keep their own cropped copy and never reference these files. See 048_saved_backgrounds.sql.';
