-- ============================================================
-- LingoStickers — Accept synonyms, remove the 3-attempt lockout
-- ============================================================

-- Unstick any challenge currently locked under the old 3-strikes system —
-- there are no more lockouts going forward.
UPDATE public.sticker_challenges
SET status = 'active', attempts_used = 0, locked_until = NULL
WHERE status = 'lost';

ALTER TABLE public.sticker_challenges
  DROP CONSTRAINT sticker_challenges_attempts_used_check;

ALTER TABLE public.sticker_challenges
  DROP CONSTRAINT sticker_challenges_status_check;

ALTER TABLE public.sticker_challenges
  ADD CONSTRAINT sticker_challenges_status_check CHECK (status IN ('pending','active','won'));

ALTER TABLE public.sticker_challenges
  DROP COLUMN locked_until;

-- Alternate correct answers (synonyms / common spelling variants), generated
-- once at send time via Groq. Always includes snapshot_word itself, so
-- matching still works even if that generation step fails.
ALTER TABLE public.sticker_challenges
  ADD COLUMN snapshot_accepted_answers TEXT[] NOT NULL DEFAULT '{}';
