// Pure rules for batch create's limits and for cards that share a photo
// (several loops drawn on one photo). Framework-free so a node test can pin
// them down (scripts/test-batch-queue.mts).

/**
 * How many loops the learner may draw on the photo they are cutting now.
 * A batch makes at most `max` cards in total; every photo still to come needs
 * one card of its own, so those are reserved.
 */
export function loopCapacity(max: number, alreadyQueued: number, photosAfterThis: number): number {
  return Math.max(1, max - alreadyQueued - photosAfterThis);
}

interface Sibling {
  id: number;
  photoId: number;
  status: string;
  /** Word of the finished card, if it has a result. */
  word: string | null;
  /** Scene words already chosen on that card. */
  chipWords: string[];
}

/**
 * Words the scene chips of card `id` must not offer: the scanned words of the
 * other cards cut from the same photo, and the extras those cards already
 * chose, so the same word never becomes two cards. Skipped cards carry
 * nothing, so their words are free again.
 */
export function sceneAvoidWords(items: readonly Sibling[], id: number): string[] {
  const me = items.find((i) => i.id === id);
  if (!me) return [];
  const out = new Set<string>();
  for (const s of items) {
    if (s.id === id || s.photoId !== me.photoId || s.status === 'skipped') continue;
    if (s.word) out.add(s.word);
    for (const w of s.chipWords) out.add(w);
  }
  return [...out];
}
