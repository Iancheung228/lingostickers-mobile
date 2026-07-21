-- ============================================================
-- LingoStickers — Add Cantonese ('yue') as a supported language
-- ============================================================
-- Widens the CHECK constraints added in 002_language_support.sql and
-- 007_sticker_challenges.sql. Constraint names aren't given explicitly in
-- those migrations (they're inline on ADD COLUMN / CREATE TABLE), so this
-- looks up whatever Postgres auto-generated rather than assuming a name.

DO $$
DECLARE
  con RECORD;
BEGIN
  FOR con IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%target_language%'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_target_language_check CHECK (target_language IN ('fr', 'ja', 'yue'));

DO $$
DECLARE
  con RECORD;
BEGIN
  FOR con IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.stickers'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%language%'
  LOOP
    EXECUTE format('ALTER TABLE public.stickers DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

ALTER TABLE public.stickers
  ADD CONSTRAINT stickers_language_check CHECK (language IN ('fr', 'ja', 'yue'));

DO $$
DECLARE
  con RECORD;
BEGIN
  FOR con IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.sticker_challenges'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%snapshot_language%'
  LOOP
    EXECUTE format('ALTER TABLE public.sticker_challenges DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

ALTER TABLE public.sticker_challenges
  ADD CONSTRAINT sticker_challenges_snapshot_language_check CHECK (snapshot_language IN ('fr', 'ja', 'yue'));
