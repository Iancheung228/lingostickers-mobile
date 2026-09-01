import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Sticker, PersonSummary } from '@/lib/types';

// ---------------------------------------------------------------------------
// Who a sticker belongs to, in the "whose face goes on the card" sense.
//
// Every sticker in the collection is *owned* by the signed-in user — RLS has
// been owner-only since 022_restrict_stickers_to_owner.sql — but one with
// source 'challenge' was won off a friend. That word was their find; showing
// your own face on it would be a small lie, and a rail of identical faces is
// also just less interesting to look at. The link back to the sender is
// sticker_challenges.won_sticker_id, which both parties can read.
//
// Returns a lookup rather than a map so call sites never have to spell out
// the "…or me" fallback themselves.
// ---------------------------------------------------------------------------
export function useStickerAuthors(
  stickers: Sticker[],
  self: PersonSummary | null | undefined,
): (sticker: Sticker) => PersonSummary | null {
  // Keyed on the won-sticker ids alone, so ordinary collection churn (a
  // favorite toggled, a note edited, a scan added) doesn't re-run the query.
  const wonIds = useMemo(
    () => stickers.filter(s => s.source === 'challenge').map(s => s.id).sort(),
    [stickers]
  );
  const key = wonIds.join('|');
  const [senders, setSenders] = useState<Map<string, PersonSummary>>(new Map());

  useEffect(() => {
    if (!key) { setSenders(new Map()); return; }
    let cancelled = false;

    (async () => {
      const { data: challenges } = await supabase
        .from('sticker_challenges')
        .select('won_sticker_id, sender_id')
        .in('won_sticker_id', key.split('|'));
      if (cancelled || !challenges || challenges.length === 0) return;

      const senderIds = [...new Set(challenges.map(c => c.sender_id as string))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_path')
        .in('id', senderIds);
      if (cancelled) return;

      const byId = new Map((profiles ?? []).map(p => [p.id, p as PersonSummary]));
      const next = new Map<string, PersonSummary>();
      for (const c of challenges) {
        const person = byId.get(c.sender_id as string);
        if (c.won_sticker_id && person) next.set(c.won_sticker_id as string, person);
      }
      setSenders(next);
    })();

    return () => { cancelled = true; };
  }, [key]);

  return useCallback(
    (sticker: Sticker) => senders.get(sticker.id) ?? self ?? null,
    [senders, self]
  );
}
