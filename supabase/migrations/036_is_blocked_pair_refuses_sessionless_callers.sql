-- ============================================================
-- Tabi Stickers — Close the block oracle without breaking `[]`
-- ============================================================
-- 035 revoked EXECUTE on is_blocked_pair from `anon`, which closed the oracle
-- but had a side effect worth undoing. The RLS policies on friendships and
-- sticker_challenges call that function, and PostgreSQL does not guarantee
-- short-circuit evaluation of AND — so for a caller with no session the policy
-- still reaches the call and fails on permissions rather than simply matching
-- no rows. Verified after 035:
--
--   GET /rest/v1/friendships?select=*        (anon key, no session)
--   -> {"code":"42501","message":"permission denied for function is_blocked_pair"}
--
-- Not a leak — no data crosses either way — but it is a regression in
-- behaviour. Every other table in this schema answers an unauthenticated
-- caller with `[]`, and one that answers with a stack-shaped error instead is
-- a loose thread for anyone auditing this later, including us.
--
-- The fix moves the refusal from the GRANT into the function itself: `anon`
-- may call it again, and always gets NULL no matter what it passes. NULL
-- propagates through `NOT ...` and the surrounding AND, so the policy matches
-- no rows and the endpoint goes back to `[]` — while the oracle stays shut,
-- because the answer no longer depends on the arguments.
--
-- NULL rather than FALSE deliberately. FALSE would read as "these two have
-- not blocked each other", which is a claim this function is in no position
-- to make on behalf of a caller it cannot identify. NULL is the honest value:
-- unknown, and unknowable from here.

CREATE OR REPLACE FUNCTION public.is_blocked_pair(a UUID, b UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN NULL
    ELSE EXISTS (
      SELECT 1 FROM public.user_blocks
      WHERE (blocker_id = a AND blocked_id = b)
         OR (blocker_id = b AND blocked_id = a)
    )
  END;
$$;

GRANT EXECUTE ON FUNCTION public.is_blocked_pair(UUID, UUID) TO anon, authenticated;

-- search_profiles stays revoked from anon. It has no reason to be reachable
-- without a session and, unlike is_blocked_pair, nothing in an RLS policy
-- calls it — so revoking it costs nothing.

-- ============================================================
-- After applying, with the anon key and no session:
--   GET  /rest/v1/friendships?select=*                  -> []
--   GET  /rest/v1/sticker_challenges?select=*           -> []
--   POST /rest/v1/rpc/is_blocked_pair {a,b}             -> null
--   POST /rest/v1/rpc/search_profiles {"q":"ab"}        -> 401
-- ============================================================
