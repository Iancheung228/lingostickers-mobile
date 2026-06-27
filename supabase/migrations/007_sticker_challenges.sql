-- ============================================================
-- LingoStickers — Sticker Challenges (Phase 6b)
-- ============================================================

-- Challenges store a snapshot of the sticker at send time so the
-- challenge remains playable even if the sender later deletes
-- their sticker. source_sticker_id is a soft reference only.
--
-- Status lifecycle:
--   pending  → sent, receiver hasn't opened it
--   active   → receiver is attempting it
--   won      → answered correctly, sticker awarded
--   lost     → 3 failed attempts, 24h lock active

CREATE TABLE public.sticker_challenges (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id            UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id          UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Soft reference — not FK, sender may delete their sticker
  source_sticker_id    UUID,

  -- Immutable snapshot captured at send time
  snapshot_word        TEXT        NOT NULL,
  snapshot_translation TEXT        NOT NULL,
  snapshot_reading     TEXT        NOT NULL,
  snapshot_sentence    TEXT        NOT NULL,
  snapshot_image_path  TEXT        NOT NULL,
  snapshot_language    TEXT        NOT NULL CHECK (snapshot_language IN ('fr','ja')),

  status               TEXT        NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','active','won','lost')),
  attempts_used        SMALLINT    NOT NULL DEFAULT 0 CHECK (attempts_used BETWEEN 0 AND 3),
  hint_used            BOOLEAN     NOT NULL DEFAULT FALSE,
  locked_until         TIMESTAMPTZ,
  won_sticker_id       UUID        REFERENCES public.stickers(id) ON DELETE SET NULL,

  sent_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at         TIMESTAMPTZ,

  CONSTRAINT no_self_challenge CHECK (sender_id != receiver_id)
);

-- Prevent duplicate active challenges for same sticker→receiver from same sender
CREATE UNIQUE INDEX unique_active_challenge
  ON public.sticker_challenges(sender_id, receiver_id, source_sticker_id)
  WHERE status IN ('pending','active');

-- Inbox query: receiver + status
CREATE INDEX idx_challenges_receiver_status ON public.sticker_challenges(receiver_id, status);
-- Sent query
CREATE INDEX idx_challenges_sender ON public.sticker_challenges(sender_id, sent_at DESC);
-- Feed query: recently won by receiver
CREATE INDEX idx_challenges_won ON public.sticker_challenges(receiver_id, completed_at DESC)
  WHERE status = 'won';

ALTER TABLE public.sticker_challenges ENABLE ROW LEVEL SECURITY;

-- Both parties can read their challenges
CREATE POLICY "challenges: parties read"
  ON public.sticker_challenges FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- All writes (INSERT, UPDATE) go through service-role edge functions only.
-- No client INSERT/UPDATE policies are granted intentionally.
