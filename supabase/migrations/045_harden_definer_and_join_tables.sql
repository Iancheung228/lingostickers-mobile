-- 045: two hardening fixes from the 2026-11-11 backend audit. Neither changes
-- behaviour for the app as it is written; both close gaps a hand-crafted
-- request could use.
--
-- 1. handle_new_user is SECURITY DEFINER (001, redefined in 039) but never
--    pinned its search_path. A definer function resolves unqualified names
--    through the caller's search_path, which is the classic privilege
--    escalation route; every other definer function here (034, 037, 044)
--    already pins it. The body only uses schema-qualified names, so this is
--    belt and braces, but it is also what Supabase's linter flags.
--    ALTER rather than CREATE OR REPLACE so the body in 039 stays the one
--    source of truth.
ALTER FUNCTION public.handle_new_user() SET search_path = public;

-- 2. The join tables checked only that the row's user_id was the caller's.
--    sticker_id and board_id were trusted: the foreign keys prove the targets
--    exist, not that the caller owns them, so a client could pin another
--    user's sticker id (or attach to another user's board) by guessing a
--    UUID. Nothing would render, since stickers and boards are owner-only
--    to read (022, 014), but the row should never have been writable.
--
--    USING is unchanged (read/delete your own rows). WITH CHECK, which
--    governs INSERT and the new row of an UPDATE, now also requires the
--    referenced sticker and board to be the caller's. The subqueries run
--    under the caller's RLS, which already limits them to their own rows,
--    and both hit primary keys.
DROP POLICY IF EXISTS "home_stickers: own rows only" ON public.home_stickers;
CREATE POLICY "home_stickers: own rows only"
  ON public.home_stickers FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.stickers s
      WHERE s.id = sticker_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "board_stickers: own rows only" ON public.board_stickers;
CREATE POLICY "board_stickers: own rows only"
  ON public.board_stickers FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.stickers s
      WHERE s.id = sticker_id AND s.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.boards b
      WHERE b.id = board_id AND b.user_id = auth.uid()
    )
  );
