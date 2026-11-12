-- 046: put the storage setup in the repo, and stop avatar folder listing.
--
-- 1. The `sticker-images` bucket and its four policies were created in the
--    dashboard (see the comment in 001) and existed nowhere in the repo, so a
--    fresh project built from these migrations had no image storage at all.
--    This records them exactly as they are in production on 2026-11-11, names
--    included (the "b4jimg_N" suffixes are the dashboard's), and is written
--    to be a no-op where they already exist.
--
-- 2. "avatars: public read" let anyone with the anon key LIST the avatars
--    bucket, and every folder in it is named by a user id, so it was a
--    directory of every account that ever set a picture. Reading an avatar
--    never needed it: the bucket is public, and public URLs
--    (lib/avatars.ts getPublicUrl) are served without consulting RLS. What
--    does need a SELECT policy is the upload's `upsert: true`, for the
--    caller's own file, so SELECT is narrowed to the owner's folder rather
--    than dropped.

INSERT INTO storage.buckets (id, name, public)
VALUES ('sticker-images', 'sticker-images', false)
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  own_folder CONSTANT text :=
    $p$(bucket_id = 'sticker-images' AND (auth.uid())::text = (storage.foldername(name))[1])$p$;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
                 AND policyname = 'own images only b4jimg_0') THEN
    EXECUTE format('CREATE POLICY "own images only b4jimg_0" ON storage.objects FOR SELECT USING %s', own_folder);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
                 AND policyname = 'own images only b4jimg_1') THEN
    EXECUTE format('CREATE POLICY "own images only b4jimg_1" ON storage.objects FOR INSERT WITH CHECK %s', own_folder);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
                 AND policyname = 'own images only b4jimg_2') THEN
    EXECUTE format('CREATE POLICY "own images only b4jimg_2" ON storage.objects FOR UPDATE USING %s', own_folder);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
                 AND policyname = 'own images only b4jimg_3') THEN
    EXECUTE format('CREATE POLICY "own images only b4jimg_3" ON storage.objects FOR DELETE USING %s', own_folder);
  END IF;
END $$;

DROP POLICY IF EXISTS "avatars: public read" ON storage.objects;
DROP POLICY IF EXISTS "avatars: own folder read" ON storage.objects;
CREATE POLICY "avatars: own folder read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);
