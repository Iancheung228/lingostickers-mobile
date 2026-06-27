-- ============================================================
-- LingoStickers — Username Uniqueness
-- ============================================================

-- Case-insensitive uniqueness: "Ian" and "ian" collide. NULL usernames
-- remain distinct from each other under Postgres unique-index semantics.
CREATE UNIQUE INDEX profiles_username_lower_unique
  ON public.profiles (LOWER(username));
