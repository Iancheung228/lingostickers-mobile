-- 044: let sign-up ask whether a username is free.
--
-- Sign-up runs signed out, and 033 scoped `profiles` SELECT to
-- `authenticated`, so the client's availability check (a direct
-- `profiles.ilike(username)`) has returned [] for every name since — the form
-- said "Username available" for names that were taken, and the clash only
-- surfaced as an error after submitting. Verified 2026-10-31: anon lookup of
-- an existing username returns [].
--
-- A yes/no answer and nothing else: no id, no profile row, no prefix search
-- (that stays search_profiles, authenticated only). Case-insensitive, matching
-- how the client compares.

CREATE OR REPLACE FUNCTION public.username_available(q TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE lower(username) = lower(trim(q))
  );
$$;

-- Supabase's default privileges grant EXECUTE to anon/authenticated by name,
-- so revoking PUBLIC alone changes nothing (see 035); grant explicitly to the
-- two roles that need it.
REVOKE ALL ON FUNCTION public.username_available(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.username_available(TEXT) TO anon, authenticated;
