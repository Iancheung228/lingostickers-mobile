-- ============================================================
-- LingoStickers — Initial Schema
-- Run this in the Supabase SQL Editor (supabase.com → your project → SQL Editor)
-- ============================================================

-- 1. Profiles table (one row per user, auto-created on sign-up)
CREATE TABLE public.profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Stickers table (one row per accepted sticker)
CREATE TABLE public.stickers (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  translation   TEXT        NOT NULL,
  pronunciation TEXT        NOT NULL,
  category      TEXT        NOT NULL
                            CHECK (category IN ('Kitchen','Animals','Study','Nature','Other')),
  image_path    TEXT        NOT NULL,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Row-Level Security: users can only access their own data
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles: own row only"
  ON public.profiles FOR ALL
  USING (auth.uid() = id);

ALTER TABLE public.stickers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stickers: own rows only"
  ON public.stickers FOR ALL
  USING (auth.uid() = user_id);

-- 4. Trigger: auto-create a profile row when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'username');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================
-- After running this SQL, do the following in the Supabase dashboard:
--
-- Storage → Create bucket:
--   Name: sticker-images
--   Public: NO (keep private)
--
-- Storage → Policies → sticker-images → New policy (for objects):
--   Policy name: own images only
--   Allowed operations: SELECT, INSERT, UPDATE, DELETE
--   USING expression:
--     bucket_id = 'sticker-images'
--     AND auth.uid()::text = (storage.foldername(name))[1]
-- ============================================================
