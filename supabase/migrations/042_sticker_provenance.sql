-- ============================================================
-- Tabi Stickers — who originally made a card
-- ============================================================
--
-- A card that is won in a challenge is not moved, it is COPIED: a brand new
-- stickers row is created for the winner and the image is copied into their
-- own storage folder (see submit-challenge-answer, and skills.md §2). The copy
-- carries no link back to whoever first scanned it.
--
-- Until now, authorship was inferred by joining sticker_challenges.sender_id
-- on won_sticker_id. That is the IMMEDIATE SENDER, not the original author, so
-- it only survives one hop:
--
--   A scans → B wins        B's card shows A   ✔
--   A scans → B wins → C wins   C's card shows B   ✘  (A is lost)
--
-- Cards are meant to be shared, and the avatar on a card is meant to say who
-- made it. So authorship becomes a stored fact rather than an inference.
--
-- This is time-sensitive in a way most schema changes are not: there is no
-- source to backfill from for cards created after sharing starts and before
-- this column exists. Attribution not recorded at creation is gone.

-- ── 1. The column ────────────────────────────────────────────
-- Nullable on purpose. Some historical rows genuinely cannot be attributed
-- (see the backfill below), and a NOT NULL here would mean inventing an
-- author for them. ON DELETE SET NULL rather than CASCADE: if the original
-- author deletes their account, everyone else's copy of the card survives —
-- it just stops naming them, which is also the right privacy answer.
ALTER TABLE public.stickers
  ADD COLUMN origin_author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.stickers.origin_author_id IS
  'Who first scanned this card. Carried unchanged through every challenge win, so it survives any number of hops. NULL only for pre-042 rows that could not be attributed.';

-- Read pattern is "give me the authors for the cards on screen", so the index
-- is only worth it if we ever filter BY author (a feed of one person''s cards).
-- Cheap enough to add now and it makes that query possible without a rewrite.
CREATE INDEX idx_stickers_origin_author ON public.stickers(origin_author_id);

-- ── 2. The same fact, snapshotted on the challenge ───────────
-- sticker_challenges is an immutable snapshot taken at send time precisely so
-- a challenge stays playable after the sender deletes their sticker —
-- source_sticker_id is deliberately a soft reference, not a foreign key. So
-- the author has to be snapshotted with everything else; resolving it at win
-- time by reading the source sticker would reintroduce exactly the fragility
-- this table was designed to avoid.
ALTER TABLE public.sticker_challenges
  ADD COLUMN snapshot_origin_author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.sticker_challenges.snapshot_origin_author_id IS
  'origin_author_id of the sticker at send time. Copied onto the won sticker so authorship survives the sender deleting theirs.';

-- ── 3. The client does not get to decide who made a card ─────
-- The stickers row is inserted CLIENT-side (app/(tabs)/scan.tsx), so an
-- attacker-controlled body could otherwise claim any card was authored by
-- anyone — which, on a feed whose whole job is to say who made something, is
-- impersonation. Same reasoning as 037 copying report snapshots server-side.
--
-- auth.uid() is the signed-in caller and NULL for the service role. So a
-- normal insert is always attributed to the person doing it, and only an edge
-- function — the challenge win, carrying the original author forward — may
-- name someone else.
CREATE OR REPLACE FUNCTION public.set_sticker_origin_author()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.origin_author_id := auth.uid();
  ELSIF NEW.origin_author_id IS NULL THEN
    NEW.origin_author_id := NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stickers_origin_author
  BEFORE INSERT ON public.stickers
  FOR EACH ROW EXECUTE FUNCTION public.set_sticker_origin_author();

-- Authorship is a fact about the past, so a KNOWN author can never be
-- rewritten. Filling in an unknown one stays allowed: that is what the
-- backfill below does, and it leaves room to attribute an orphaned row later
-- if a way to do it honestly ever appears.
CREATE OR REPLACE FUNCTION public.freeze_sticker_origin_author()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.origin_author_id IS NOT NULL
     AND NEW.origin_author_id IS DISTINCT FROM OLD.origin_author_id THEN
    RAISE EXCEPTION 'origin_author_id is immutable once set (sticker %)', OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stickers_origin_author_frozen
  BEFORE UPDATE ON public.stickers
  FOR EACH ROW EXECUTE FUNCTION public.freeze_sticker_origin_author();

-- ── 4. Backfill what is actually knowable ───────────────────
-- Not everything is lost. Two cases can be recovered honestly:

-- (a) A card the owner scanned themselves. Unambiguous.
UPDATE public.stickers
   SET origin_author_id = user_id
 WHERE origin_author_id IS NULL
   AND source IS DISTINCT FROM 'challenge';

-- (b) A card won in a challenge: the sender of that challenge. This is the
--     one hop the old inference could see, so backfilling it loses nothing
--     and preserves every attribution the app was already displaying.
--     For a card that travelled further than one hop this names the person
--     who passed it on rather than the person who made it — that history was
--     never recorded and cannot be recovered. It is the best available truth,
--     and from here on the column is carried forward instead of re-derived.
UPDATE public.stickers s
   SET origin_author_id = c.sender_id
  FROM public.sticker_challenges c
 WHERE c.won_sticker_id = s.id
   AND s.origin_author_id IS NULL;

-- (c) Existing challenges: the author of the sticker they were cut from, now
--     that (a) and (b) have run. Falls back to the sender, who is the author
--     whenever the sticker was their own scan.
UPDATE public.sticker_challenges c
   SET snapshot_origin_author_id = COALESCE(s.origin_author_id, c.sender_id)
  FROM public.stickers s
 WHERE s.id = c.source_sticker_id
   AND c.snapshot_origin_author_id IS NULL;

UPDATE public.sticker_challenges
   SET snapshot_origin_author_id = sender_id
 WHERE snapshot_origin_author_id IS NULL;

-- ── 5. No RLS change ────────────────────────────────────────
-- stickers stays owner-only (022). This column names a person, it does not
-- grant anyone access to anything. Reading the author's username and avatar
-- uses the existing profiles SELECT policy, which 033 scoped to
-- `authenticated` — so a signed-in user can resolve a name and face, and an
-- anonymous caller still gets nothing.
