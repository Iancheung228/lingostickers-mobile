-- ============================================================
-- Tabi Stickers — cards that did not start as a cut-out object
-- ============================================================
--
-- Until now every card was a scan: one photo, one cut-out sticker, one noun.
-- Two new paths make cards from something else:
--
--   * Quick Add (create-card): the learner types a word, phrase or idiom.
--     There may be no image at all.
--   * Scene prompts (scene-words → create-card): one photo is asked several
--     questions ("What's happening?", "What's it like?") and yields several
--     cards — verbs, adjectives, idioms — that share that photo.
--
-- Additive only. No existing row changes and nothing is backfilled.

-- ── 1. A card may have no image ──────────────────────────────
-- A typed word has nothing to show. NULL rather than an empty-string
-- sentinel, so "has an image" is a real check and not a convention.
ALTER TABLE public.stickers
  ALTER COLUMN image_path DROP NOT NULL;

-- ── 2. The forms a learner needs, by part of speech ──────────
-- Verb conjugations, a noun's gender or counter, an adjective's agreement,
-- an idiom's literal meaning and register. Label/value pairs as produced by
-- _shared/cardSchema.ts (FormEntry[]): what is worth listing differs by part
-- of speech AND by language, so one fixed set of columns would be wrong for
-- most combinations. NULL for every card made before this existed.
ALTER TABLE public.stickers
  ADD COLUMN forms JSONB NULL;

COMMENT ON COLUMN public.stickers.forms IS
  'Array of {l, v}: label and form, e.g. {"l":"present (je)","v":"je cours"}. NULL = not generated (pre-043 cards).';

-- ── 3. Cards from the same photo know they are siblings ──────
-- Used to keep them apart in a study session (similar items learned together
-- interfere with each other) and to offer "more from this photo". Generated
-- by the client once per photo; NULL for a card that stands alone.
ALTER TABLE public.stickers
  ADD COLUMN scene_id UUID NULL;

CREATE INDEX idx_stickers_user_scene
  ON public.stickers(user_id, scene_id)
  WHERE scene_id IS NOT NULL;

-- ── 4. How the card was made ─────────────────────────────────
-- `source` already exists (006) and says 'scan' or 'challenge'. It gains the
-- new capture paths, for the funnel (which ones people actually use) and so a
-- typed card is never mistaken for a scan with a missing image. Existing rows
-- keep their value. The constraint is found by its definition rather than by
-- an assumed auto-generated name.
DO $$
DECLARE
  c TEXT;
BEGIN
  FOR c IN
    SELECT con.conname
      FROM pg_constraint con
     WHERE con.conrelid = 'public.stickers'::regclass
       AND con.contype = 'c'
       AND pg_get_constraintdef(con.oid) LIKE 'CHECK ((source = ANY%'
  LOOP
    EXECUTE format('ALTER TABLE public.stickers DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.stickers
  ADD CONSTRAINT stickers_source_check
    CHECK (source IN ('scan', 'challenge', 'scene', 'text', 'mined', 'onboarding'));

-- part_of_speech (028) is unconstrained TEXT, so the new 'idiom' value needs
-- no change here; the closed set lives in _shared/cardSchema.ts.
