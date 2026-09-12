-- ============================================================
-- Tabi Stickers — A moderation queue you can actually read
-- ============================================================
-- 034 gave reports somewhere to land and 037 made sure they still mean
-- something afterwards, but reviewing one still meant joining three tables by
-- hand in the SQL editor every time. Guideline 1.2 asks for "timely responses
-- to concerns", and a process whose first step is writing a join is a process
-- that gets skipped.
--
-- This is the whole triage surface: one view, newest and unhandled first.
--
-- WHY security_invoker = true
--
-- A Postgres view runs as its OWNER by default, which for a view created in a
-- migration is the superuser — so the plain form of this view would happily
-- hand every report in the table to anyone who could select from it, straight
-- through the RLS on content_reports that 034 was careful to write. PG15+ can
-- flip that, and this project is on 17.6, so the view evaluates as the caller:
-- `service_role` (the dashboard, and only the dashboard) bypasses RLS and sees
-- everything; `authenticated` sees only reports it filed itself, matching the
-- "content_reports: read own" policy exactly; `anon` sees nothing.
--
-- The grants below are belt and braces on top of that, not the mechanism.

CREATE VIEW public.moderation_queue
WITH (security_invoker = true)
AS
  SELECT
    r.id,
    r.created_at,
    r.status,
    r.reason,
    r.detail,
    reporter.username        AS reported_by,
    reported.username        AS reported_person,
    r.reported_user_id,
    -- Present even when the challenge itself is long gone — see 037. The path
    -- is in the PRIVATE sticker-images bucket, under the *sender's* folder, so
    -- viewing it needs the service role or a signed URL minted with it
    -- (skills.md §2 explains why a normal client call returns nothing).
    r.reported_word,
    r.reported_image_path,
    r.challenge_id,
    -- Whether this pair is already blocked, so triage can tell "the user has
    -- already protected themselves, this is a moderation decision" from "this
    -- person is still being contacted right now".
    EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE b.blocker_id = r.reporter_id AND b.blocked_id = r.reported_user_id
    ) AS reporter_has_blocked_them
  FROM public.content_reports r
  LEFT JOIN public.profiles reporter ON reporter.id = r.reporter_id
  LEFT JOIN public.profiles reported ON reported.id = r.reported_user_id
  ORDER BY
    (r.status = 'open') DESC,   -- unhandled first
    r.created_at DESC;

REVOKE ALL ON public.moderation_queue FROM PUBLIC, anon;
GRANT SELECT ON public.moderation_queue TO authenticated, service_role;

COMMENT ON VIEW public.moderation_queue IS
  'Report triage. Run: SELECT * FROM moderation_queue WHERE status = ''open''; '
  'Close one with: UPDATE content_reports SET status = ''actioned'' WHERE id = ''…''; '
  'Statuses: open, reviewed, actioned, dismissed.';

-- ============================================================
-- Verify after applying — the view must NOT become a way around the RLS on
-- content_reports:
--   curl '<project>/rest/v1/moderation_queue?select=*' -H 'apikey: <anon>'
--   -> [] (or a permission error), never a row.
-- ============================================================
