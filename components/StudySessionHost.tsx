import { useEffect, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { Sticker } from '@/lib/types';
import { Grade } from '@/lib/review';
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

  const handleGraded = (grade: Grade) => {
    if (!cards) return;
    setStats(prev => ({
      graded: (prev?.graded ?? 0) + 1,
      again: (prev?.again ?? 0) + (grade === 'again' ? 1 : 0),
    }));

    // An "Again" card goes to the back of the queue so it comes round once
    // more this session. The schedule has already booked it for tomorrow
    // either way, but being told you forgot a word and then never seeing it
    // again in that sitting reads as broken.
    const next = grade === 'again' && current ? [...cards, current] : cards;
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
