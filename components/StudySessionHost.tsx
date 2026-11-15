import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { Sticker } from '@/lib/types';
import {
  dueAtMs, formatMinutes, Grade, LEARN_AHEAD_MIN, SchedulePatch,
} from '@/lib/review';
import {
  forgetNewCardIntroduced, getStudyPrefs, newCardsIntroducedToday, recordNewCardIntroduced, studyPrefsReady,
} from '@/lib/studyPrefs';
import { limitNewCards } from '@/lib/studyQueue';
import { supabase } from '@/lib/supabase';
import { haptic } from '@/lib/haptics';
import { syncReminders } from '@/lib/reminder';
import { persistGrade, type SessionMode } from '@/lib/practice';
import StudyCard from '@/components/StudyCard';
import ReviewSummary from '@/components/ReviewSummary';
import { useToast } from '@/components/ToastProvider';

interface StudySessionHostProps {
  /// The cards to study, or null when no session is running. A new array
  /// starts a new session.
  queue: Sticker[] | null;
  onExit: () => void;
  onUpdate?: (id: string, patch: Partial<Sticker>) => void;
  /// Unused now that a study session can't delete a card; kept so the screens
  /// that start a session don't change.
  onDeleted?: () => void;
  /// 'practice' grades nothing into the schedule: no write of any kind.
  mode?: SessionMode;
  /// The session ended (finished or closed) having graded this many cards.
  onFinished?: (graded: number) => void;
}

interface Stats { graded: number; again: number; unsynced: number }

/** Everything an Undo has to put back: the whole session, not just the card. */
interface Snapshot {
  id: string;
  cards: Sticker[];
  index: number;
  seen: Set<string>;
  stats: Stats | null;
  revisit: Map<string, Sticker>;
  final: Map<string, Sticker>;
  /// The scheduler columns before the grade: restored with existing columns.
  before: Partial<Sticker>;
  wasNew: boolean;
}

const SCHEDULE_COLUMNS = [
  'ease_factor', 'interval_days', 'learning_step', 'due_at', 'review_count', 'lapses', 'last_reviewed_at',
] as const;

const GRADE_LABEL: Record<Grade, string> = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' };
const RETRY_MS = [1000, 3000, 9000];
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Owns a study session: the queue, the cursor into it, what "Again" does, the
 * grade writes and their Undo, and the wind-down at the end.
 *
 * Lives in its own component because more than one screen can start a
 * session — the home screen's due pill and the calendar's Review button —
 * and a second copy of this cursor logic on the calendar would be a second
 * place for "Again" to be re-queued differently. Same reasoning as
 * skills.md #1: the parts that must agree get one implementation.
 */
export default function StudySessionHost({ queue, onExit, onUpdate, mode = 'review', onFinished: onFinishedProp }: StudySessionHostProps) {
  const toast = useToast();
  // A session that graded cards moved due dates: re-plan the reminders.
  const onFinished = (graded: number) => {
    // After the session's chained grade writes settle, so the plan reads the new due dates.
    if (mode === 'review' && graded > 0) void writes.current.then(() => syncReminders());
    onFinishedProp?.(graded);
  };
  const [cards, setCards] = useState<Sticker[] | null>(null);
  const [index, setIndex] = useState(0);
  // Cards graded this sitting; one showing again is being re-learned.
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<Stats | null>(null);
  const [early, setEarly] = useState(false);
  // Cards whose latest grade was Again, and every card's latest state, for the summary.
  const [revisit, setRevisit] = useState<Map<string, Sticker>>(new Map());
  const [final, setFinal] = useState<Map<string, Sticker>>(new Map());
  // After an Undo the card is shown on its answer, grade row live.
  const [openOnBack, setOpenOnBack] = useState(false);
  const undoRef = useRef<Snapshot | null>(null);
  // Grade writes are chained, so an Undo's write can never overtake the grade it undoes.
  const writes = useRef<Promise<void>>(Promise.resolve());

  // A new queue starts a session; null ends one. The summary is kept alive
  // after `cards` clears so the wind-down survives the queue emptying.
  useEffect(() => {
    if (!queue) { setCards(null); return; }
    let alive = true;
    void studyPrefsReady().then(() => {
      if (!alive) return;
      // The new-card limit (A-card 7): reviews are never capped, introductions are.
      // Practice has no new-card slots: it never introduces anything.
      const limited = mode === 'practice' ? queue : limitNewCards(queue, getStudyPrefs().newCardsPerDay, newCardsIntroducedToday());
      if (limited.length === 0) {
        toast.show({ kind: 'info', message: "That's today's new-card limit. Change it in Profile." });
        onExit();
        return;
      }
      undoRef.current = null;
      setCards(limited);
      setIndex(0);
      setSeen(new Set());
      setStats({ graded: 0, again: 0, unsynced: 0 });
      setEarly(false);
      setRevisit(new Map());
      setFinal(new Map());
      setOpenOnBack(false);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue]);

  const current = cards?.[index] ?? null;

  const writeSchedule = useCallback((id: string, columns: Partial<Sticker>, onFail?: () => void) => {
    writes.current = writes.current.then(async () => {
      for (let attempt = 0; attempt <= RETRY_MS.length; attempt++) {
        if (attempt > 0) await sleep(RETRY_MS[attempt - 1]);
        const { error } = await supabase.from('stickers').update(columns).eq('id', id);
        if (!error) return;
      }
      onFail?.();
    });
  }, []);

  const undo = useCallback(() => {
    const snap = undoRef.current;
    if (!snap) return;
    undoRef.current = null;
    haptic.tap();
    setCards(snap.cards);
    setIndex(snap.index);
    setSeen(snap.seen);
    setStats(snap.stats);
    setRevisit(snap.revisit);
    setFinal(snap.final);
    setEarly(false);
    setOpenOnBack(true);
    onUpdate?.(snap.id, snap.before);
    writeSchedule(snap.id, snap.before);
    if (snap.wasNew) forgetNewCardIntroduced(snap.id);
  }, [onUpdate, writeSchedule]);

  const handleGraded = (grade: Grade, patch: SchedulePatch) => {
    if (!cards || !current) return;
    const before = Object.fromEntries(SCHEDULE_COLUMNS.map(k => [k, current[k]])) as Partial<Sticker>;
    const wasNew = (current.review_count ?? 0) === 0;
    // newStats is needed after the guard (the end-of-session count).
    let graded = current;

    // THE practice guard: every write, snapshot and toast lives in this closure.
    const wrote = persistGrade(mode, () => {
      undoRef.current = { id: current.id, cards, index, seen, stats, revisit, final, before, wasNew };

      const newStats = {
        graded: (stats?.graded ?? 0) + 1,
        again: (stats?.again ?? 0) + (grade === 'again' ? 1 : 0),
        unsynced: stats?.unsynced ?? 0,
      };
      setStats(newStats);

      // The graded card carries its new schedule forward, because it may well be
      // answered again before this session ends — and a second answer read off
      // the pre-grading card would compute from the wrong rung of the learning
      // ladder (or think a card that has just lapsed is still a review card, and
      // hand it a multiplied interval instead of graduating it).
      setSeen(prev => new Set(prev).add(current.id));
      graded = { ...current, ...patch } as Sticker;
      setFinal(prev => new Map(prev).set(current.id, graded));
      setRevisit(prev => {
        const m = new Map(prev);
        if (grade === 'again') m.set(current.id, graded);
        else if (grade === 'good' || grade === 'easy') m.delete(current.id);
        return m;
      });

      // Optimistic everywhere, then the write; failure rolls the lists back.
      onUpdate?.(current.id, patch);
      if (wasNew) recordNewCardIntroduced(current.id);
      writeSchedule(current.id, patch, () => {
        onUpdate?.(current.id, before);
        setStats(s => (s ? { ...s, unsynced: s.unsynced + 1 } : s));
      });

      toast.show({
        kind: 'undo',
        message: `Graded ${GRADE_LABEL[grade]}`,
        action: { label: 'Undo', onPress: undo },
      });

    });
    if (!wrote) {
      // Practice: just move on. Nothing was written, nothing can be undone.
      setOpenOnBack(false);
      if (index + 1 < cards.length) {
        setIndex(i => i + 1);
        AccessibilityInfo.announceForAccessibility(`Card ${index + 2} of ${cards.length}`);
        return;
      }
      setCards(null);
      toast.show({ kind: 'info', message: "Practice done. Your schedule didn't change." });
      onFinished?.(cards.length);
      onExit();
      return;
    }

    // Anything the scheduler booked inside the learn-ahead window is still
    // being learned, so it comes round again in this sitting rather than being
    // left mid-ladder until tomorrow — Again at 1m, Hard at 6m, Good at 10m.
    // Being told you forgot a word and then never seeing it again in that
    // sitting is what this exists to prevent; the window is the reason it's the
    // scheduler's answer that decides, not a special case for Again.
    const next = [...cards];
    if (dueAtMs(graded) - Date.now() <= LEARN_AHEAD_MIN * 60_000) {
      // Placed by due time, so a card due in a minute overtakes one due in ten
      // — but never immediately, while some other card is still waiting: the
      // same card twice in a row is a memory test of the last five seconds.
      const tail = next.slice(index + 1);
      const ahead = tail.findIndex(c => dueAtMs(c) > dueAtMs(graded));
      const at = ahead < 0 ? tail.length : Math.max(ahead, tail.length > 0 ? 1 : 0);
      next.splice(index + 1 + at, 0, graded);
    }

    setOpenOnBack(false);
    if (index + 1 < next.length) {
      setCards(next);
      setIndex(i => i + 1);
      AccessibilityInfo.announceForAccessibility(`Card ${index + 2} of ${next.length}`);
      return;
    }
    setEarly(false);
    setCards(null);
    onFinished?.((stats?.graded ?? 0) + 1);
    onExit();
  };

  // Closing leaves the session outright rather than skipping a card: a
  // half-finished queue is a state worth being able to walk away from. Every
  // grade is already saved, so there is no confirm; the summary says so.
  const handleClose = () => {
    setCards(null);
    if (!stats?.graded) { setStats(null); undoRef.current = null; }
    // "Stopped early" means cards were left untouched. A card that is only
    // coming round again for its learning step has been answered; closing on
    // it is a finished session (the approved flow closes exactly there).
    else setEarly(!!cards?.some(c => !seen.has(c.id)));
    onFinished?.(mode === 'practice' ? 0 : stats?.graded ?? 0);
    onExit();
  };

  const unique = cards ? new Set(cards.map(c => c.id)).size : 0;

  return (
    <>
      <StudyCard
        sticker={current}
        mode="review"
        practice={mode === 'practice'}
        stillLearning={!!current && seen.has(current.id)}
        startFlipped={openOnBack}
        progress={cards ? { index, total: cards.length, fraction: unique ? seen.size / unique : 0 } : undefined}
        onClose={handleClose}
        onGraded={handleGraded}
        onUndoGrade={undoRef.current ? undo : undefined}
        onUpdate={(id, patch) => {
          // An edit made mid-session ("Edit card") reaches the queue too.
          setCards(cs => (cs ? cs.map(c => (c.id === id ? { ...c, ...patch } : c)) : cs));
          onUpdate?.(id, patch);
        }}
      />

      <ReviewSummary
        stats={!cards && stats?.graded ? stats : null}
        early={early}
        nextDue={nextDueLine(final)}
        revisit={[...revisit.values()]}
        onDone={() => { setStats(null); undoRef.current = null; }}
        onUpdate={onUpdate}
      />
    </>
  );
}

/** "Next card in 10m", or when the soonest card in this session comes back. */
function nextDueLine(final: Map<string, Sticker>): string | null {
  if (!final.size) return null;
  const soonest = Math.min(...[...final.values()].map(dueAtMs));
  const mins = (soonest - Date.now()) / 60_000;
  if (mins <= 60) return `Next card in ${formatMinutes(Math.max(1, mins))}`;
  const midnight = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const days = Math.round((midnight(soonest) - midnight(Date.now())) / 86_400_000);
  if (days <= 0) return `Next card in ${formatMinutes(mins)}`;
  return days === 1 ? 'Next review: tomorrow' : `Next review: in ${days} days`;
}
