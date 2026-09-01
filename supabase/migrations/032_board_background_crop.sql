-- ============================================================
-- LingoStickers — make a board's cover photo re-editable
-- ============================================================
-- Until now a cover photo was cropped destructively: BackgroundCropper
-- rendered the visible region and uploaded only that, so the stored file was
-- exactly the canvas frame's aspect. Reopening the editor on it offered
-- nothing to reposition — an image that exactly covers its frame has zero
-- pan range, and the pixels outside the original crop were simply gone.
-- Adjusting the framing therefore meant re-picking from the photo library
-- and composing again from scratch.
--
-- So the upload keeps two files now: the cropped photo that actually gets
-- drawn (unchanged, boards.background_path) and the uncropped source it was
-- cut from, at the sibling path
--   {user_id}/board-{board_id}-background-source.jpg
-- derived by convention rather than stored, exactly as background_path
-- itself is. This column records which region of that source is on screen.
--
-- Shape: { "x", "y", "w", "h", "sw", "sh" }
--   x/y/w/h — the visible rectangle as FRACTIONS (0-1) of the source image.
--             Fractions, not pixels, so the record stays valid if the source
--             is ever stored at a different resolution, and so it doesn't
--             bake in the frame it was composed against — another device's
--             canvas is a different size, and the same framing should still
--             restore correctly there.
--   sw/sh   — pixel dimensions of the stored source, so reopening the editor
--             can lay the image out without a round trip to measure it.
--
-- NULL means "no re-editable source": either no cover photo at all, or one
-- uploaded before this migration. Those still display fine — they just don't
-- offer Reposition until the next time the photo is replaced, which writes
-- both files and fills this in.
ALTER TABLE public.boards
  ADD COLUMN background_crop JSONB;

COMMENT ON COLUMN public.boards.background_crop IS
  'Visible region of the uncropped source photo, as fractions of it, plus the source''s pixel size. NULL for backgrounds with no stored source. See 032_board_background_crop.sql.';
