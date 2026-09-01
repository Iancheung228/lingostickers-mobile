-- ============================================================
-- Tabi Stickers — Close profile reads to signed-in users
-- ============================================================
-- 006_friendships.sql replaced the original owner-only policy with
--
--   CREATE POLICY "profiles: read any" ON public.profiles FOR SELECT USING (true);
--
-- so that friend search could look up a username. A policy with no TO clause
-- applies to the `public` role, which includes `anon` — and the anon key is
-- embedded in the shipped app, where it is trivially extractable and is
-- *meant* to be public. So the policy, not the key, is the only thing standing
-- between an unauthenticated stranger and the whole table.
--
-- Verified against the live project before writing this, with the anon key and
-- no session:
--
--   curl '<project>/rest/v1/profiles?select=*' -H 'apikey: <anon>'
--   -> 200, every row: id, username, created_at, target_language, preferences
--   -> content-range: 0-1/2   (the full table, and its exact count)
--
-- The same request against stickers, friendships and push_tokens correctly
-- returns [], so this is one policy out of step with an otherwise
-- properly-scoped schema, not a systemic gap.
--
-- TO authenticated is the whole fix. Every read the app actually performs —
-- friend search, the friends list, challenge senders, sticker authors — runs
-- with a session, so no client behaviour changes. Cross-user reads stay
-- possible on purpose: a username and an avatar are what make another person
-- recognisable, and they are all this table exposes to a friend.

DROP POLICY "profiles: read any" ON public.profiles;

CREATE POLICY "profiles: read any"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- After applying, re-run the curl above. It should come back `[]`.
