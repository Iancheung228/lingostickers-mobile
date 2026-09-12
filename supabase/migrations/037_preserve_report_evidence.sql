-- ============================================================
-- Tabi Stickers — Stop a block from destroying the report's evidence
-- ============================================================
-- 034 shipped two things that interact badly, and the path they meet on is
-- the *most likely* one a real user takes:
--
--   1. ReportSheet files the report with `challenge_id`, then offers to block
--      the sender — because someone who has just reported a person almost
--      always wants them gone too.
--   2. sever_friendship_on_block DELETEs pending/active challenges between the
--      pair, and content_reports.challenge_id is ON DELETE SET NULL.
--
-- So: report an offensive picture, accept the block we ourselves offered, and
-- the challenge row is deleted and the report's pointer to it is blanked. What
-- reaches whoever reviews it is a reason and a username with no way to see the
-- thing that was reported. The report survives; the evidence does not. That is
-- worse than having no report flow, because it looks like one.
--
-- Two changes, and they fix different halves of it.

-- ── 1. Blocking no longer deletes challenges ─────────────────
-- It never needed to. The SELECT policy from 034 §5 already excludes any
-- challenge whose pair is blocked, so both people stop seeing it the moment
-- the block lands — deleting the row only removed it from the one party who
-- still had a legitimate use for it, which is us, reviewing the report.
-- Friendship deletion stays: that one has to be real, or unblocking would
-- silently restore a friendship the user never asked to have back.
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

  -- Challenges are deliberately left in place. RLS hides them from both
  -- parties (034 §5), which is the whole of what the user asked for, and
  -- keeping the rows means a report filed a second earlier still has
  -- something to point at.
  RETURN NEW;
END;
$$;

-- ── 2. The report carries its own copy of the evidence ───────
-- Even with the delete gone, `challenge_id` is not a safe place to keep the
-- only copy. The challenge cascades away if the sender deletes their account —
-- which is exactly what someone does after being reported — and
-- reported_user_id goes NULL with them. A report has to still mean something
-- after the person it is about has erased themselves.
--
-- Captured in a BEFORE INSERT trigger rather than passed up by the client, for
-- two reasons: the client cannot forget to send it, and the client cannot
-- choose what it says. A reporter must not be able to attach one person's
-- picture to another person's name.
ALTER TABLE public.content_reports
  ADD COLUMN reported_word       TEXT,
  ADD COLUMN reported_image_path TEXT;

CREATE OR REPLACE FUNCTION public.capture_report_evidence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.challenge_id IS NOT NULL THEN
    SELECT c.snapshot_word, c.snapshot_image_path
      INTO NEW.reported_word, NEW.reported_image_path
      FROM public.sticker_challenges c
      WHERE c.id = NEW.challenge_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER capture_evidence_on_report
  BEFORE INSERT ON public.content_reports
  FOR EACH ROW EXECUTE FUNCTION public.capture_report_evidence();

-- Note for whoever reviews these: reported_image_path is a path in the private
-- `sticker-images` bucket, under the *sender's* folder. Reading it needs the
-- service role — the same reason get-challenge-image exists. See skills.md §2.

-- ============================================================
-- Anon must still see nothing. After applying:
--   curl '<project>/rest/v1/content_reports?select=*' -H 'apikey: <anon>'  -> []
-- ============================================================
