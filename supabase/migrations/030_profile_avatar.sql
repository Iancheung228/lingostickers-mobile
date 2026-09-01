-- ============================================================
-- LingoStickers — Profile pictures
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN avatar_path TEXT;

-- Avatars are the one file in this app that is *meant* to be seen by
-- someone other than its owner — a friend's face in the friends list, the
-- inbox, and the Due today rail. The sticker-images bucket can't hold them:
-- its policy is `auth.uid()::text = (storage.foldername(name))[1]`, so a
-- signed URL minted by anyone but the owner silently resolves to null
-- (skills.md #2).
--
-- Rather than route every avatar through a service-role edge function, they
-- get their own PUBLIC bucket. The tradeoff is deliberate: anyone holding
-- the URL can fetch that image without a session. That's the ordinary
-- bargain for a profile picture, nothing else about the account is
-- reachable from one, and it keeps an avatar a plain <Image src> that the
-- CDN can cache instead of a round-trip per face. Everything actually
-- private — stickers, memory photos, voice notes, wall backgrounds — stays
-- in sticker-images, which stays private.
--
-- If this INSERT or any of the policies below is rejected with a
-- permissions/ownership error, the project's SQL role isn't allowed to
-- touch the storage schema — create the bucket in the dashboard instead
-- (Storage -> New bucket, name `avatars`, Public: YES) and add the four
-- policies under Storage -> Policies -> avatars with the same expressions,
-- exactly as 001_initial_schema.sql documents for sticker-images.
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Writes keep sticker-images' per-owner-folder shape: every avatar lives at
-- {userId}/{filename}, and only that user may write there. The filename is
-- a fresh timestamp on each upload (lib/avatars.ts) so the public URL is
-- immutable and neither the CDN nor expo-image can serve a stale face; the
-- previous file is deleted right after the profile row is repointed.
CREATE POLICY "avatars: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars: own folder insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "avatars: own folder update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "avatars: own folder delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
