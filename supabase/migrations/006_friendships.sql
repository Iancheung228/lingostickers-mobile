-- ============================================================
-- LingoStickers — Friendships + Push Tokens (Phase 6a)
-- ============================================================

-- 1. Push tokens — one row per (user, device)
CREATE TABLE public.push_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token      TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, token)
);

CREATE INDEX idx_push_tokens_user ON public.push_tokens(user_id);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push_tokens: own rows only"
  ON public.push_tokens FOR ALL
  USING (auth.uid() = user_id);

-- 2. Allow username search (split the existing all-in-one profiles policy)
DROP POLICY "profiles: own row only" ON public.profiles;
CREATE POLICY "profiles: read any"    ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles: insert own"  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles: update own"  ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles: delete own"  ON public.profiles FOR DELETE USING (auth.uid() = id);

-- 3. Friendships — bidirectional, one row per pair
--    requester_id is the actual sender; uniqueness enforced via
--    a LEAST/GREATEST index to prevent (A→B) and (B→A) duplicates.
CREATE TABLE public.friendships (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  addressee_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status       TEXT        NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','accepted','declined')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT no_self_friendship CHECK (requester_id != addressee_id)
);

-- Prevent (A→B) and (B→A) from both existing
CREATE UNIQUE INDEX unique_friendship_pair ON public.friendships(
  LEAST(requester_id::text, addressee_id::text),
  GREATEST(requester_id::text, addressee_id::text)
);

CREATE INDEX idx_friendships_requester ON public.friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON public.friendships(addressee_id);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "friendships: read own"
  ON public.friendships FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "friendships: insert as requester"
  ON public.friendships FOR INSERT
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "friendships: addressee updates"
  ON public.friendships FOR UPDATE
  USING (auth.uid() = addressee_id);
CREATE POLICY "friendships: parties delete"
  ON public.friendships FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- 4. Allow friends to see each other's stickers (for the friend feed)
DROP POLICY "stickers: own rows only" ON public.stickers;
CREATE POLICY "stickers: own or accepted friend" ON public.stickers FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.friendships f WHERE f.status = 'accepted'
      AND ((f.requester_id = auth.uid() AND f.addressee_id = stickers.user_id)
        OR (f.addressee_id = auth.uid() AND f.requester_id = stickers.user_id))
    )
  );
CREATE POLICY "stickers: insert own" ON public.stickers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "stickers: update own" ON public.stickers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "stickers: delete own" ON public.stickers FOR DELETE USING (auth.uid() = user_id);

-- 5. Track sticker provenance (scan vs won from a challenge)
ALTER TABLE public.stickers
  ADD COLUMN source TEXT NOT NULL DEFAULT 'scan' CHECK (source IN ('scan','challenge'));
