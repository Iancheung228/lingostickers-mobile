-- ============================================================
-- Tabi Stickers — Blocking and content reports
-- ============================================================
-- App Store Guideline 1.2 requires an app carrying user-generated content to
-- ship a way to report objectionable content and a way to block abusive users.
-- Before this migration the app had neither: `removeFriend` deletes the
-- friendship row, but nothing then stops the same person sending a fresh
-- request the next second, and there was nowhere for a report to go.
--
-- WHY A SEPARATE TABLE, NOT A 'blocked' FRIENDSHIP STATUS
--
-- Adding 'blocked' to friendships.status was the obvious move and it is wrong
-- for three reasons:
--
--   1. A block is DIRECTIONAL, a friendship row is not. Which of the two
--      columns holds the blocker depends on who happened to send the original
--      request, so `status = 'blocked'` cannot say who blocked whom without a
--      second column that only means anything in that one state.
--   2. You must be able to block someone you have NO friendship with — the
--      stranger who found you in search and sent a request you never answered
--      is exactly the case the guideline is about. Encoding that as a
--      friendship means fabricating a relationship to represent its absence.
--   3. Unfriending and unblocking are different acts. Sharing one row makes
--      "remove this friend" and "stop blocking this person" the same delete.
--
-- So blocks live in their own directional table, and friendships keep their
-- clean pending/accepted/declined lifecycle.

-- ── 1. Blocks ────────────────────────────────────────────────
CREATE TABLE public.user_blocks (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (blocker_id, blocked_id),
  CONSTRAINT no_self_block CHECK (blocker_id != blocked_id)
);

CREATE INDEX idx_user_blocks_blocker ON public.user_blocks(blocker_id);
CREATE INDEX idx_user_blocks_blocked ON public.user_blocks(blocked_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

-- You manage your own blocks and can read only the ones you made. Deliberately
-- no policy for reading rows where you are the *blocked* party: "who has
-- blocked me" is not something the blocked person gets to enumerate, and
-- exposing it would turn blocking into a notification.
CREATE POLICY "user_blocks: read own"   ON public.user_blocks FOR SELECT USING (auth.uid() = blocker_id);
CREATE POLICY "user_blocks: insert own" ON public.user_blocks FOR INSERT WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "user_blocks: delete own" ON public.user_blocks FOR DELETE USING (auth.uid() = blocker_id);

-- ── 2. The predicate everything else is built on ─────────────
-- SECURITY DEFINER on purpose: the policies below have to consider blocks in
-- BOTH directions, including the direction the calling user is not allowed to
-- SELECT. Without DEFINER, `NOT is_blocked_pair(...)` would silently evaluate
-- as if the other person's block did not exist, and the block would only work
-- one way.
--
-- STABLE + a pinned search_path so it is safe to call from a policy.
CREATE OR REPLACE FUNCTION public.is_blocked_pair(a UUID, b UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (blocker_id = a AND blocked_id = b)
       OR (blocker_id = b AND blocked_id = a)
  );
$$;

REVOKE ALL ON FUNCTION public.is_blocked_pair(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_blocked_pair(UUID, UUID) TO authenticated;

-- ── 3. Blocking severs the existing relationship ─────────────
-- Blocking somebody you are already friends with has to end the friendship, or
-- the block only stops *new* contact while the friend rail keeps showing them.
-- Done in a trigger rather than in the client so it is atomic with the block
-- and cannot be skipped by a client that forgets the second call.
CREATE OR REPLACE FUNCTION public.sever_friendship_on_block()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.friendships
  WHERE (requester_id = NEW.blocker_id AND addressee_id = NEW.blocked_id)
     OR (requester_id = NEW.blocked_id AND addressee_id = NEW.blocker_id);

  -- Challenges still in flight between the two are withdrawn. Completed ones
  -- ('won') are left alone: the receiver owns that sticker now, and deleting
  -- the row would strand it.
  DELETE FROM public.sticker_challenges
  WHERE status IN ('pending', 'active')
    AND ((sender_id = NEW.blocker_id AND receiver_id = NEW.blocked_id)
      OR (sender_id = NEW.blocked_id AND receiver_id = NEW.blocker_id));

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_user_block_created
  AFTER INSERT ON public.user_blocks
  FOR EACH ROW EXECUTE FUNCTION public.sever_friendship_on_block();

-- ── 4. Re-contact is refused at the table, not in the client ──
-- Both friend requests and challenges are written by service-role edge
-- functions, which bypass RLS entirely. A policy therefore cannot stop a
-- blocked pair from being re-linked; a BEFORE INSERT trigger can, and it holds
-- no matter which client, function or dashboard session is doing the insert.
-- The edge functions also check, so the user gets a sentence instead of a 500 —
-- this is the backstop under that, not a replacement for it.
CREATE OR REPLACE FUNCTION public.reject_blocked_friendship()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_blocked_pair(NEW.requester_id, NEW.addressee_id) THEN
    RAISE EXCEPTION 'blocked_pair'
      USING HINT = 'A block exists between these two users';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER no_friendship_between_blocked
  BEFORE INSERT ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.reject_blocked_friendship();

CREATE OR REPLACE FUNCTION public.reject_blocked_challenge()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_blocked_pair(NEW.sender_id, NEW.receiver_id) THEN
    RAISE EXCEPTION 'blocked_pair'
      USING HINT = 'A block exists between these two users';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER no_challenge_between_blocked
  BEFORE INSERT ON public.sticker_challenges
  FOR EACH ROW EXECUTE FUNCTION public.reject_blocked_challenge();

-- ── 5. Blocked users stop being visible to each other ────────
-- Only two tables need this. `stickers` deliberately does NOT: migration 022
-- already narrowed it back to "stickers: own rows only", so there is no
-- cross-user read there for a block to gate. Adding a block predicate to a
-- policy that is already owner-only would be dead SQL implying a hole that
-- was closed two years of migrations ago.

DROP POLICY "friendships: read own" ON public.friendships;
CREATE POLICY "friendships: read own"
  ON public.friendships FOR SELECT
  USING (
    (auth.uid() = requester_id OR auth.uid() = addressee_id)
    AND NOT public.is_blocked_pair(requester_id, addressee_id)
  );

DROP POLICY "challenges: parties read" ON public.sticker_challenges;
CREATE POLICY "challenges: parties read"
  ON public.sticker_challenges FOR SELECT
  USING (
    (auth.uid() = sender_id OR auth.uid() = receiver_id)
    AND NOT public.is_blocked_pair(sender_id, receiver_id)
  );

-- ── 6. Search stops returning blocked people, both directions ─
-- The client previously ran `profiles.ilike('username', q || '%')` directly.
-- That cannot exclude someone who has blocked *you*, because you are not
-- allowed to read that block row — so the person you blocked (or who blocked
-- you) kept appearing in search with a working "add friend" button that would
-- then fail at the trigger.
--
-- SECURITY DEFINER moves the whole query behind the same predicate the
-- policies use. It also narrows what search can do at all: prefix-only,
-- minimum two characters, at most ten rows, and never the caller.
CREATE OR REPLACE FUNCTION public.search_profiles(q TEXT)
RETURNS TABLE (id UUID, username TEXT, avatar_path TEXT)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT p.id, p.username, p.avatar_path
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND length(btrim(q)) >= 2
    AND p.id <> auth.uid()
    AND p.username ILIKE btrim(q) || '%'
    AND NOT public.is_blocked_pair(auth.uid(), p.id)
  ORDER BY p.username
  LIMIT 10;
$$;

REVOKE ALL ON FUNCTION public.search_profiles(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_profiles(TEXT) TO authenticated;

-- ── 7. Reports ───────────────────────────────────────────────
-- A report has to land somewhere a human will actually look, so this is a
-- plain table read from the Supabase dashboard rather than a fire-and-forget
-- email. `status` exists so a report can be marked handled — Apple's wording
-- is "report offensive content and timely responses to concerns", and a table
-- with no dispositions is a list, not a process.
CREATE TABLE public.content_reports (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- The person being reported. Kept even if the challenge is deleted.
  reported_user_id UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- Set when the report is about one specific challenge rather than a person.
  challenge_id     UUID        REFERENCES public.sticker_challenges(id) ON DELETE SET NULL,
  reason           TEXT        NOT NULL
                   CHECK (reason IN ('sexual','violent','hateful','harassment','spam','other')),
  -- Free text the reporter added. Capped so a report cannot be used as storage.
  detail           TEXT        CHECK (detail IS NULL OR length(detail) <= 1000),
  status           TEXT        NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open','reviewed','actioned','dismissed')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT no_self_report CHECK (reporter_id != reported_user_id)
);

CREATE INDEX idx_content_reports_open ON public.content_reports(created_at DESC)
  WHERE status = 'open';

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- File your own, read your own back. No UPDATE or DELETE policy at all: a
-- reporter must not be able to retract or edit a report after the fact, and
-- triage happens with the service role.
CREATE POLICY "content_reports: insert own" ON public.content_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "content_reports: read own" ON public.content_reports
  FOR SELECT USING (auth.uid() = reporter_id);

-- ============================================================
-- After applying, verify with the anon key and no session — every one of
-- these must come back `[]`, exactly as the other tables do:
--
--   curl '<project>/rest/v1/user_blocks?select=*'     -H 'apikey: <anon>'
--   curl '<project>/rest/v1/content_reports?select=*' -H 'apikey: <anon>'
-- ============================================================
