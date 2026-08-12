-- ============================================================
-- LingoStickers — Restrict stickers back to owner-only reads
-- ============================================================
-- 006_friendships.sql granted accepted friends SELECT on a user's entire
-- stickers row ("for the friend feed"), but no client feature ever actually
-- reads another user's stickers this way — verified by auditing every
-- `.from('stickers')` call in the app: they all filter to auth.uid()'s own
-- rows, or a specific sticker/challenge ID already scoped through
-- sticker_challenges (its own snapshot table, populated at send-challenge
-- time, not a live read of the sender's stickers row). FriendProfile.tsx's
-- "stickers exchanged" count queries sticker_challenges, not stickers.
--
-- So this policy has been exposing every friend's full sticker content —
-- notes, voice recordings, memory photos, location — to any accepted
-- friend, for a feature that was never built. Locking back down to
-- owner-only; if a real "view a friend's collection" feature gets built
-- later, it should expose a deliberately narrow column set (e.g. word,
-- translation, image_path only — never notes/voice_note_path/
-- memory_photo_path/location), not this table wholesale.

DROP POLICY "stickers: own or accepted friend" ON public.stickers;
CREATE POLICY "stickers: own rows only" ON public.stickers FOR SELECT
  USING (auth.uid() = user_id);
