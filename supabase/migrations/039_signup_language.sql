-- ============================================================
-- Tabi Stickers — Let sign-up choose the language
-- ============================================================
-- `profiles.target_language` has defaulted to 'fr' since 002 and nothing in
-- the sign-up flow ever set it. So someone who downloaded this to learn
-- Japanese scanned their first object — the moment the whole app is built
-- around — and got a French word back, then had to find Profile → Language
-- and do it again. The default language was decided by a migration in June.
--
-- The obvious client-side fix is to UPDATE the profile right after signUp
-- resolves, and it does not work: with email confirmation on there is no
-- session at that point, so the write is unauthorized and the choice has to be
-- parked on the device until first launch (the dance lib/pendingAvatar.ts
-- already does for the profile picture, and one of those is enough).
--
-- Passing it through `options.data` instead puts it in raw_user_meta_data,
-- which this trigger already reads for `username` — so the profile row is
-- correct the moment it is created, on both paths, with nothing to reconcile
-- later.
--
-- The CASE is load-bearing, not defensive habit. raw_user_meta_data is
-- client-supplied and target_language carries a CHECK constraint (002, widened
-- by 017); an unrecognised value would fail the INSERT, and because this
-- trigger runs on auth.users the failure surfaces as "Database error saving
-- new user" and the account is never created. Anything unexpected falls back
-- to 'fr' rather than taking sign-up down with it.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, target_language)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    CASE
      WHEN NEW.raw_user_meta_data->>'target_language' IN ('fr', 'ja', 'yue')
        THEN NEW.raw_user_meta_data->>'target_language'
      ELSE 'fr'
    END
  );
  RETURN NEW;
END;
$$;

-- Existing accounts are untouched: they already have a target_language, and
-- anyone who picked one in Profile keeps it.
