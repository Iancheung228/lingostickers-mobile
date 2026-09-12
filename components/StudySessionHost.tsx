import { useEffect, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { Sticker } from '@/lib/types';
import { dueAtMs, Grade, LEARN_AHEAD_MIN, SchedulePatch } from '@/lib/review';
import StudyCard from '@/components/StudyCard';
import ReviewSummary from '@/components/ReviewSummary';

interface StudySessionHostProps {
  /// The cards to study, or null when no session is running. A new array
  /// starts a new session.
  queue: Sticker[] | null;
  onExit: () => void;
  onUpdate?: (id: string, patch: Partial<Sticker>) => void;
  onDeleted?: () => void;
}

/**
 * Owns a study session: the queue, the cursor into it, what "Again" does, and
 * the wind-down at the end.
 *
 * Lives in its own component because more than one screen can start a
 * session — the home screen's due pill and the calendar's Review button —
 * and a second copy of this cursor logic on the calendar would be a second
 * place for "Again" to be re-queued differently. Same reasoning as
 * skills.md #1: the parts that must agree get one implementation.
 */
export default function StudySessionHost({ queue, onExit, onUpdate, onDeleted }: StudySessionHostProps) {
  const [cards, setCards] = useState<Sticker[] | null>(null);
  const [index, setIndex] = useState(0);
  const [stats, setStats] = useState<{ graded: number; again: number } | null>(null);

  // A new queue starts a session; null ends one. The summary is kept alive
  // after `cards` clears so the wind-down survives the queue emptying.
  useEffect(() => {
    if (!queue) { setCards(null); return; }
    setCards(queue);
    setIndex(0);
    setStats({ graded: 0, again: 0 });
  }, [queue]);

  const current = cards?.[index] ?? null;

  const handleGraded = (grade: Grade, patch: SchedulePatch) => {
    if (!cards || !current) return;
    setStats(prev => ({
      graded: (prev?.graded ?? 0) + 1,
      again: (prev?.again ?? 0) + (grade === 'again' ? 1 : 0),
    }));

    // The graded card carries its new schedule forward, because it may well
    // be answered again before this session ends — and a second answer read
    // off the pre-grading card would compute from the wrong rung of the
    // learning ladder (or think a card that has just lapsed is still a review
    // card, and hand it a multiplied interval instead of graduating it).
    const graded = { ...current, ...patch };

    // Anything the scheduler booked inside the learn-ahead window is still
    // being learned, so it comes round again in this sitting rather than
    // being left mid-ladder until tomorrow — Again at 1m, Hard at 6m, Good at
    // 10m. Being told you forgot a word and then never seeing it again in
    // that sitting is what this exists to prevent; the window is the reason
    // it's the scheduler's answer that decides, not a special case for Again.
    const next = [...cards];
    if (dueAtMs(graded) - Date.now() <= LEARN_AHEAD_MIN * 60_000) {
      // Placed by due time, so a card due in a minute overtakes one due in
      // ten — but never immediately, while some other card is still waiting:
      // the same card twice in a row is a memory test of the last five
      // seconds.
      const tail = next.slice(index + 1);
      const ahead = tail.findIndex(c => dueAtMs(c) > dueAtMs(graded));
      const at = ahead < 0 ? tail.length : Math.max(ahead, tail.length > 0 ? 1 : 0);
      next.splice(index + 1 + at, 0, graded);
    }

    if (index + 1 < next.length) {
      setCards(next);
      setIndex(i => i + 1);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCards(null);
    onExit();
  };

  // Closing leaves the session outright rather than skipping a card: a
  // half-finished queue is a state worth being able to walk away from.
  const handleClose = () => {
    setCards(null);
    if (!stats?.graded) setStats(null);
    onExit();
  };

  return (
    <>
      <StudyCard
        sticker={current}
        mode="review"
        progress={cards ? { index, total: cards.length } : undefined}
        onClose={handleClose}
        onGraded={handleGraded}
        onDeleted={() => { setCards(null); onExit(); onDeleted?.(); }}
        onUpdate={onUpdate}
      />

      <ReviewSummary
        stats={!cards && stats?.graded ? stats : null}
        onDone={() => setStats(null)}
      />
    </>
  );
}
