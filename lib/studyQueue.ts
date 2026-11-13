import type { Sticker } from '@/lib/types';

/**
 * Applies the daily new-card limit to a due queue (A-card 7).
 *
 * "New" is a card that has never been reviewed. Reviews are never capped here;
 * only the introductions are, so a big backlog of new cards can't swamp the
 * day. `introducedToday` is how many new cards earlier sessions today already
 * used up, and cards already in learning keep their place.
 *
 * Order is preserved. The first `limit - introducedToday` new cards stay.
 */
export function limitNewCards(queue: Sticker[], limit: number, introducedToday: number): Sticker[] {
  let slots = Math.max(0, limit - introducedToday);
  const out: Sticker[] = [];
  for (const card of queue) {
    if ((card.review_count ?? 0) === 0) {
      if (slots <= 0) continue;
      slots -= 1;
    }
    out.push(card);
  }
  return out;
}

/** "7 due + 3 new" style split of a queue. */
export function splitQueue(queue: Sticker[]): { reviews: number; fresh: number } {
  const fresh = queue.filter(c => (c.review_count ?? 0) === 0).length;
  return { reviews: queue.length - fresh, fresh };
}
