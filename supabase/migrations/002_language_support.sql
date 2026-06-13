-- ============================================================
-- LingoStickers — Language Support (Phase 1)
-- Adds a per-user target language and per-sticker language,
-- and renames language-specific fields to be language-neutral.
-- ============================================================

-- 1. Per-user active learning language — used as the default for new captures.
ALTER TABLE public.profiles
  ADD COLUMN target_language TEXT NOT NULL DEFAULT 'fr'
    CHECK (target_language IN ('fr', 'ja'));

-- 2. Per-sticker language — stickers keep the language they were captured in,
--    even if the user later switches their active target language.
ALTER TABLE public.stickers
  ADD COLUMN language TEXT NOT NULL DEFAULT 'fr'
    CHECK (language IN ('fr', 'ja'));

-- 3. Rename language-specific fields to be language-neutral:
--    "name" (French word + article) -> "word" (target-language word/phrase)
--    "pronunciation" (English phonetic spelling) -> "reading" (romanization)
ALTER TABLE public.stickers RENAME COLUMN name TO word;
ALTER TABLE public.stickers RENAME COLUMN pronunciation TO reading;
