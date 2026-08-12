-- ============================================================
-- LingoStickers — Per-user daily rate limit on the paid AI endpoints
-- ============================================================
-- create-sticker fans out to Replicate/remove.bg (background removal) and
-- Groq (vision), and translate-word/translate-sentence each hit Groq. All
-- three cost real money per call, so before a public release each user gets
-- a fixed number of calls per UTC day.
--
-- A call is counted when it is *accepted*, not when it succeeds — a scan
-- that comes back with a bad crop, or that the user throws away, has already
-- burned the upstream spend, so it burns quota too. Otherwise a spammer just
-- sends garbage images forever for free.

CREATE TABLE public.api_usage (
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   TEXT        NOT NULL,
  usage_date DATE        NOT NULL,
  count      INT         NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, endpoint, usage_date)
);

-- For pruning old rows (see the retention note at the bottom).
CREATE INDEX api_usage_usage_date_idx ON public.api_usage (usage_date);

ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

-- Clients may read their own counters (so the app can show "3 scans left"
-- without an extra round trip) but may never write them — the only writer is
-- consume_api_quota below, called by edge functions with the service-role key.
CREATE POLICY "api_usage: own rows readable" ON public.api_usage FOR SELECT
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- consume_api_quota — atomically claim one unit of today's quota
-- ------------------------------------------------------------
-- Returns allowed=false without incrementing once the day's limit is hit.
--
-- The whole check-and-increment is a single INSERT ... ON CONFLICT DO UPDATE
-- on purpose: the conflicting insert takes a row lock, so N concurrent
-- requests from the same user serialize instead of all reading `count = 9`
-- and all deciding they're under the limit. A read-then-write in the edge
-- function would let a burst of parallel requests sail straight past the cap
-- — which is exactly the traffic shape this is defending against.
--
-- The `WHERE api_usage.count < p_limit` guard on DO UPDATE means an
-- over-limit call updates no row, so RETURNING yields nothing and v_count
-- comes back NULL. The stored counter therefore never climbs above the
-- limit, however hard someone hammers it.
CREATE OR REPLACE FUNCTION public.consume_api_quota(
  p_user_id  UUID,
  p_endpoint TEXT,
  p_limit    INT
)
RETURNS TABLE (allowed BOOLEAN, used INT, quota INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- UTC day, so the reset time is the same for everyone and can't be moved
  -- by a client changing its device clock or timezone.
  v_today DATE := (NOW() AT TIME ZONE 'UTC')::date;
  v_count INT;
BEGIN
  IF p_limit <= 0 THEN
    RETURN QUERY SELECT false, 0, p_limit;
    RETURN;
  END IF;

  INSERT INTO public.api_usage AS u (user_id, endpoint, usage_date, count)
  VALUES (p_user_id, p_endpoint, v_today, 1)
  ON CONFLICT (user_id, endpoint, usage_date) DO UPDATE
    SET count = u.count + 1
    WHERE u.count < p_limit
  RETURNING u.count INTO v_count;

  IF v_count IS NULL THEN
    RETURN QUERY SELECT false, p_limit, p_limit;
  ELSE
    RETURN QUERY SELECT true, v_count, p_limit;
  END IF;
END;
$$;

-- SECURITY DEFINER functions are granted to PUBLIC by default. Without this
-- revoke, any signed-in client could call the RPC directly and burn down an
-- arbitrary user's quota by passing their UUID.
REVOKE ALL ON FUNCTION public.consume_api_quota(UUID, TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_api_quota(UUID, TEXT, INT) FROM anon;
REVOKE ALL ON FUNCTION public.consume_api_quota(UUID, TEXT, INT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.consume_api_quota(UUID, TEXT, INT) TO service_role;

-- ------------------------------------------------------------
-- Retention (optional, not automated here)
-- ------------------------------------------------------------
-- Rows are tiny and only accumulate one per user/endpoint/day, so this can be
-- left alone for a long while. To prune later, run periodically:
--   DELETE FROM public.api_usage WHERE usage_date < CURRENT_DATE - INTERVAL '90 days';
