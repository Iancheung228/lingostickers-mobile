// ---------------------------------------------------------------------------
// Learner context — the three things the sentence prompt needs to know about
// the person it is writing for.
//
// Until now every scan was written for a stranger: the same difficulty, the
// same structures, and no idea what the learner had already met. All three
// are sitting in their own `stickers` rows and cost one indexed query to
// read.
//
//   * how many cards they have in this language → which band of the syllabus
//     they are working in (see syllabus.ts),
//   * their recent headwords → words the new sentence can quietly re-expose,
//     which is the cheapest spaced repetition available: it costs nothing,
//     and the learner never experiences it as revision,
//   * the grammar keys their recent cards actually used → what NOT to teach
//     again this time.
//
// This runs on the hot path of a scan, so it must never be the reason one
// fails. Every error resolves to the neutral context (band 1, no recycling,
// no exclusions), which is exactly the behaviour the prompt had before any of
// this existed.
// ---------------------------------------------------------------------------
import { type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { type Language } from './syllabus.ts';
import { type LearnerContext } from './vocab.ts';

// Enough rows to fill both the known-word pool (12 are offered to the model)
// and the no-repeats window (6), with room for rows whose grammar_key is null
// because they predate it.
const LOOKBACK_ROWS = 40;

// How many recent structures are excluded from the next pick. Six is about
// two sittings' worth: long enough that a learner doesn't meet the passé
// composé three cards running, short enough that a band-1 learner with only
// eight structures available doesn't exhaust the pool (and pickTargets drops
// the exclusion rather than failing if they do).
const NO_REPEAT_WINDOW = 6;

export const NEUTRAL_LEARNER: LearnerContext = {
  stickerCount: 0,
  knownWords: [],
  recentGrammarKeys: [],
};

export async function loadLearnerContext(
  client: SupabaseClient,
  userId: string,
  language: Language,
): Promise<LearnerContext> {
  try {
    // `count: 'exact'` reports the size of the whole filtered set, not of the
    // page — so the band and the sample come out of one round trip.
    const { data, count, error } = await client
      .from('stickers')
      .select('word, translation, grammar_key', { count: 'exact' })
      .eq('user_id', userId)
      .eq('language', language)
      .order('created_at', { ascending: false })
      .limit(LOOKBACK_ROWS);

    if (error) throw error;

    const rows = data ?? [];
    const knownWords = rows
      .filter(r => typeof r.word === 'string' && r.word.trim() && typeof r.translation === 'string' && r.translation.trim())
      .map(r => ({ word: String(r.word).trim(), translation: String(r.translation).trim() }));

    const recentGrammarKeys: string[] = [];
    for (const row of rows) {
      if (recentGrammarKeys.length >= NO_REPEAT_WINDOW) break;
      const key = row.grammar_key;
      if (typeof key === 'string' && key && !recentGrammarKeys.includes(key)) recentGrammarKeys.push(key);
    }

    return { stickerCount: count ?? rows.length, knownWords, recentGrammarKeys };
  } catch (err) {
    // A scan that produces a slightly less tailored sentence is a far better
    // outcome than one that fails, so this is logged and swallowed.
    console.warn('loadLearnerContext failed — falling back to a neutral prompt:', err);
    return NEUTRAL_LEARNER;
  }
}
