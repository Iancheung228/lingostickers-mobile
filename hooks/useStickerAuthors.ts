import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Sticker, PersonSummary } from '@/lib/types';

// ---------------------------------------------------------------------------
// Who a sticker belongs to, in the "whose face goes on the card" sense.
//
// Every sticker in the collection is *owned* by the signed-in user — RLS has
// been owner-only since 022_restrict_stickers_to_owner.sql — but one won off a
// friend was their find. That word was theirs; showing your own face on it
// would be a small lie, and a rail of identical faces is less interesting to
// look at besides.
//
// This used to join sticker_challenges.sender_id on won_sticker_id, which is
// the IMMEDIATE SENDER and therefore only correct one hop deep: a card passed
// A → B → C credited B. Since 042 the answer is stored on the row itself as
// `origin_author_id`, stamped at creation and carried through every win, so it
// is right at any depth. That also makes this a single lookup by id rather
// than a two-query join.
//
// Returns a lookup rather than a map so call sites never have to spell out the
// "…or me" fallback themselves.
// ---------------------------------------------------------------------------
export function useStickerAuthors(
  stickers: Sticker[],
  self: PersonSummary | null | undefined,
): (sticker: Sticker) => PersonSummary | null {
  // Only the ids we cannot already answer from `self`, so an ordinary
  // collection of your own scans issues no query at all.
  const authorIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of stickers) {
      if (s.origin_author_id && s.origin_author_id !== self?.id) ids.add(s.origin_author_id);
    }
    return [...ids].sort();
  }, [stickers, self?.id]);

  const key = authorIds.join('|');
  const [people, setPeople] = useState<Map<string, PersonSummary>>(new Map());

  useEffect(() => {
    if (!key) { setPeople(new Map()); return; }
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, avatar_path')
        .in('id', key.split('|'));
      if (cancelled || !data) return;
      setPeople(new Map(data.map(p => [p.id as string, p as PersonSummary])));
    })();

    return () => { cancelled = true; };
  }, [key]);

  return useCallback(
    (sticker: Sticker) => {
      const id = sticker.origin_author_id;
      if (!id || id === self?.id) return self ?? null;
      // A known author whose profile has not arrived yet resolves to null
      // rather than to you — better a fallback initial for a moment than
      // your face on someone else's find.
      return people.get(id) ?? null;
    },
    [people, self],
  );
}
