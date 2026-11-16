import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Modal, View, Text, StyleSheet, Pressable, Animated, AccessibilityInfo, ScrollView,
  PanResponder, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Reanimated, {
  runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import { Check, MoreHorizontal, RotateCcw, X } from 'lucide-react-native';
import CardDetail from '@/components/CardDetail';
import { CardBack, CardFront, STILL_LEARNING, answerLabel, promptLabel, splitAroundWord } from '@/components/CardView';
import FieldEditor, { EditorSpec } from '@/components/FieldEditor';
import GradeRow from '@/components/GradeRow';
import { ToastLayer, useToast } from '@/components/ToastProvider';
import { useSignedUrls } from '@/hooks/useSignedUrls';
import { EditTarget, NULLABLE_FIELDS, editorSpecFor } from '@/lib/cardEdit';
import { showMenu } from '@/lib/actionMenu';
import { haptic } from '@/lib/haptics';
import { hintTiers } from '@/lib/hint';
import { flipMs, useMotion } from '@/lib/motion';
import { Grade, SchedulePatch, schedule } from '@/lib/review';
import { speak, stopSpeaking } from '@/lib/speech';
import { useStudyPrefs } from '@/lib/studyPrefs';
import { supabase } from '@/lib/supabase';
import type { Sticker } from '@/lib/types';
import { radii, spacing, MIN_TAP } from '@/constants/theme';
import { useTheme, useThemedStyles, type Theme } from '@/hooks/useTheme';

export { splitAroundWord } from '@/components/CardView';
export type { EditTarget } from '@/lib/cardEdit';

/**
 * 'browse' is the card DETAIL: it opens on the answer, nothing is graded, the
 * schedule is untouched. Tapping a sticker anywhere in the app opens this. A
 * "Test me" button turns it into an ungraded quiz.
 *
 * 'review' is the card in a STUDY SESSION: a quiz with a grade row, and that
 * grade is what advances SM-2.
 *
 * Keeping these apart matters: if simply looking at a word counted as a
 * review, the schedule would slowly fill with cards you glanced at rather than
 * cards you actually recalled.
 *
 * Both postures render the same CardView faces; this file is the Modal around
 * them, the study loop (flip, hint, grade, swipe) and the field editor.
 */
export type StudyCardMode = 'browse' | 'review';

interface StudyCardProps {
  sticker: Sticker | null;
  mode?: StudyCardMode;
  onClose: () => void;
  /// Fired when a grade is committed. The parent writes it and decides what
  /// "next" means: advance a session queue, or close a one-off card.
  onGraded?: (grade: Grade, patch: SchedulePatch) => void;
  /// Position in the current study session, if there is one. `fraction` is the
  /// share of unique cards graded at least once, for the thin bar.
  progress?: { index: number; total: number; fraction?: number };
  /// This card was graded earlier in the session and has come round again
  /// (the learn-ahead re-show), so say so rather than let it read as a bug.
  stillLearning?: boolean;
  /// Open on the answer with the grade row live: the card an Undo returns to.
  startFlipped?: boolean;
  /// Undo the last grade (the VoiceOver action; the toast has its own button).
  onUndoGrade?: () => void;
  /// Fired after the card is on its way out (undo toast up), so the screen
  /// behind can drop it from its list.
  onDeleted?: () => void;
  /// Same patch channel the lists use, so an edit written here is reflected
  /// in the grid and the due queue without a refetch — see skills.md #1.
  onUpdate?: (id: string, patch: Partial<Sticker>) => void;
  /// Present only when this card was opened from a board, where "remove" has
  /// a second and far narrower meaning than delete: unpin it from this one
  /// board, leave it in the collection.
  onRemoveFromBoard?: { boardName: string; remove: () => void | Promise<void> };
  /// Opened over a study session: no Delete, no Test me.
  embedded?: boolean;
  /// "Test me" on the card: the screen starts a practice session for it. When
  /// absent, the card falls back to its own ungraded browse quiz.
  onTest?: (sticker: Sticker) => void;
  /// Review mode, but nothing is written (see lib/practice.ts): the grade row
  /// drops its interval previews and the header says so.
  practice?: boolean;
}

// How far down, or how fast, the card has to be pulled before letting go means
// "put it away". Deliberately further than the bottom sheet's 96: this one is
// dismissed by dragging the thing you are reading, so it has to be clearly a
// pull rather than a slipped thumb.
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 1.1;
// A drag has to be this far down, and this much more vertical than horizontal,
// before it counts as a dismissal rather than a tap or a scroll.
const DRAG_SLOP = 14;
/// Grade buttons ignore taps this long after a reveal, so a double-tap on
/// "Tap to reveal" can never grade.
const GRADE_GUARD_MS = 250;
/// Horizontal travel that commits a swipe, in points.
const SWIPE_COMMIT = 96;
const SWIPE_VELOCITY = 600;

export default function StudyCard({
  sticker, mode = 'browse', onClose, onGraded, progress, stillLearning, startFlipped, onUndoGrade,
  onDeleted, onUpdate, onRemoveFromBoard, embedded, onTest, practice,
}: StudyCardProps) {
  const styles = useThemedStyles(makeStyles);
  const toast = useToast();
  const { reduced } = useMotion();
  const [testing, setTesting] = useState(false);
  // The card detail, opened over a study session ("Edit card", the memory line).
  const [detailOpen, setDetailOpen] = useState(false);
  // On the front the grade row isn't there, so the toast sits in its slot; on
  // the back it lifts clear above it.
  const [faceFlipped, setFaceFlipped] = useState(false);
  const [editing, setEditing] = useState<{ target: EditTarget; spec: EditorSpec } | null>(null);
  const [savingField, setSavingField] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Every sticker readable here is the signed-in user's own (RLS is owner-only
  // since 022_restrict_stickers_to_owner.sql).
  const urls = useSignedUrls(useMemo(
    () => (sticker ? [sticker.image_path] : []),
    [sticker?.image_path],
  ));
  const imageUrl = sticker?.image_path ? urls.get(sticker.image_path) ?? null : null;

  useEffect(() => {
    setTesting(false);
    setDetailOpen(false);
    setEditing(null);
  }, [sticker?.id]);

  const openEditor = useCallback((target: EditTarget) => {
    if (!sticker) return;
    haptic.select();
    setSaveError(null);
    setEditing({ target, spec: { ...editorSpecFor(target, sticker), id: sticker.id } });
  }, [sticker]);

  const toggleFavorite = useCallback(async () => {
    if (!sticker) return;
    const next = !sticker.is_favorite;
    haptic.tap();
    onUpdate?.(sticker.id, { is_favorite: next });
    const { error } = await supabase.from('stickers').update({ is_favorite: next }).eq('id', sticker.id);
    if (error) {
      onUpdate?.(sticker.id, { is_favorite: !next });
      toast.show({ kind: 'error', message: "Couldn't update the favourite. Try again." });
    }
  }, [sticker, onUpdate, toast]);

  const handleSaveField = async (values: Record<string, string>, follow: Record<string, string> | null) => {
    if (!sticker || !editing) return;
    setSavingField(true);
    setSaveError(null);
    // Clearing a nullable field stores null, so "no note" and "a note that is
    // one space" aren't two different states. Clearing a required one is
    // ignored rather than written — an accidental empty save must not be able
    // to strip the headword off a card.
    const patch: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(values)) {
      if (raw.length > 0) patch[key] = raw;
      else if (NULLABLE_FIELDS.has(key)) patch[key] = null;
    }

    // Three columns describe the sentence rather than being part of it: the
    // word-by-word gloss, the note explaining its grammar, and the syllabus
    // key naming the structure it was built around. Rewriting the sentence by
    // hand leaves all three describing a sentence that no longer exists.
    if (typeof patch.sentence === 'string' && patch.sentence !== sticker.sentence) {
      patch.sentence_gloss = null;
      patch.sentence_insight = null;
      patch.grammar_key = null;
    }

    // The word that followed the meaning. One update carries both, because a
    // half-applied card that says "ramen" over a reading of "noodles" is worse
    // than a failed save. A field the learner changed by hand in this same
    // sheet (the part of speech) beats the lookup's guess at it.
    if (follow) {
      const current = sticker as unknown as Record<string, unknown>;
      for (const [key, value] of Object.entries(follow)) {
        const typedByHand = key in patch && patch[key] !== current[key];
        if (!typedByHand) patch[key] = value;
      }
    }

    try {
      if (Object.keys(patch).length === 0) { setEditing(null); return; }

      const before = sticker as unknown as Record<string, unknown>;
      const previous = Object.fromEntries(Object.keys(patch).map(k => [k, before[k]])) as Partial<Sticker>;
      onUpdate?.(sticker.id, patch as Partial<Sticker>);
      const { error } = await supabase.from('stickers').update(patch).eq('id', sticker.id);
      if (error) {
        onUpdate?.(sticker.id, previous);
        throw error;
      }
      haptic.success();
      setEditing(null);

      // The word moved on and the example sentence did not. Its picked-out
      // headword silently disappears and the card shows "pear" over a sentence
      // about an apple, so ask now, while the learner is here.
      const newWord = typeof patch.word === 'string' ? patch.word : null;
      if (newWord && newWord !== sticker.word && sticker.sentence && !splitAroundWord(sticker.sentence, newWord)) {
        // After the field editor's modal has finished leaving: an Alert raised
        // mid-dismissal can be dropped by iOS.
        setTimeout(() => {
          Alert.alert(
            'Update the sentence too?',
            `Your example sentence doesn't use ${newWord} yet.`,
            [
              { text: 'Leave it', style: 'cancel' },
              { text: 'Edit sentence', onPress: () => openEditor('sentence') },
            ],
          );
        }, 400);
      }
    } catch {
      // The sheet stays, with the edit in it (lesson #3: never error.message).
      haptic.error();
      setSaveError("Couldn't save. Your edit is still here.");
    } finally {
      setSavingField(false);
    }
  };

  // ── detail: pull-down + a scale-fade in (250ms; opacity only under RM) ──
  const detail = mode === 'browse' && !testing;
  const openAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!sticker || !detail) return;
    openAnim.setValue(0);
    Animated.timing(openAnim, { toValue: 1, duration: reduced ? 120 : 250, useNativeDriver: true }).start();
  }, [!!sticker, detail]);

  const detailAtTop = useRef(true);
  const dismiss = useDismiss(
    () => { if (testing) setTesting(false); else onClose(); },
    () => detail && detailAtTop.current,
  );

  if (!sticker) return null;

  const closeAll = () => { setTesting(false); onClose(); };

  return (
    // `transparent` rather than a full-screen presentation, so the card can be
    // pulled down off the screen with something behind it instead of tearing a
    // hole in the app.
    <Modal
      visible
      animationType={detail ? 'fade' : 'slide'}
      transparent
      statusBarTranslucent
      onRequestClose={() => { if (testing) setTesting(false); else onClose(); }}
    >
      <GestureHandlerRootView style={styles.root}>
        {detail ? (
          <>
            <Animated.View style={[styles.scrim, { opacity: dismiss.scrimOpacity }]} pointerEvents="none" />
            <Animated.View
              {...dismiss.panHandlers}
              style={[styles.page, {
                opacity: openAnim,
                transform: [
                  { translateY: dismiss.dragY },
                  { scale: reduced ? 1 : openAnim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
                ],
              }]}
            >
              <CardDetail
                sticker={sticker}
                imageUrl={imageUrl}
                onClose={onClose}
                onEdit={openEditor}
                onTest={embedded ? undefined : () => { if (onTest) onTest(sticker); else setTesting(true); }}
                onUpdate={onUpdate}
                onDeleted={onDeleted}
                onRemoveFromBoard={onRemoveFromBoard}
                embedded={embedded}
                noScheduleWrites={practice}
                onAtTop={top => { detailAtTop.current = top; }}
              />
            </Animated.View>
          </>
        ) : (
          <StudyFace
            sticker={sticker}
            review={mode === 'review'}
            practice={!!practice}
            progress={progress}
            stillLearning={!!stillLearning}
            startFlipped={!!startFlipped}
            imageUrl={imageUrl}
            onClose={mode === 'review' ? closeAll : () => setTesting(false)}
            onGraded={onGraded}
            onUndoGrade={onUndoGrade}
            onToggleFavorite={toggleFavorite}
            onFlippedChange={setFaceFlipped}
            onOpenDetail={() => setDetailOpen(true)}
          />
        )}
        <ToastLayer bottomOffset={mode === 'review' ? (faceFlipped ? 84 : 14) : 0} />
      </GestureHandlerRootView>

      <FieldEditor
        spec={editing?.spec ?? null}
        saving={savingField}
        error={saveError}
        onCancel={() => { setEditing(null); setSaveError(null); }}
        onSave={handleSaveField}
      />

      {detailOpen && mode === 'review' && (
        <StudyCard
          sticker={sticker}
          mode="browse"
          embedded
          practice={practice}
          onClose={() => setDetailOpen(false)}
          onUpdate={onUpdate}
        />
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Pull down to put the card away
// ---------------------------------------------------------------------------
// The modal arrives from below, and a thing that arrives that way is read as a
// thing you can push back down; leaving the X as the only exit is the same
// broken promise the field editor's grabber used to make.
//
// The gesture is claimed on *capture*, which is the only way a parent can
// outrank a scroll view its finger is already on — so it is fenced in hard: it
// takes over only when the drag is clearly downward and `enabled()` says the
// face under the finger is at its top. Anywhere else the touch goes where it
// always went, to the scroll or to the tap.
function useDismiss(onClose: () => void, enabled: () => boolean) {
  const { height } = useWindowDimensions();
  const dragY = useRef(new Animated.Value(0)).current;
  // Read inside the responder, which is built once and would otherwise close
  // over the first render's values forever.
  const live = useRef({ onClose, enabled, height });
  live.current = { onClose, enabled, height };

  const panHandlers = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_e, g) =>
      live.current.enabled() && g.dy > DRAG_SLOP && g.dy > Math.abs(g.dx) * 1.5,
    onPanResponderMove: (_e, g) => { dragY.setValue(Math.max(0, g.dy)); },
    onPanResponderRelease: (_e, g) => {
      if (g.dy > DISMISS_DISTANCE || g.vy > DISMISS_VELOCITY) {
        Animated.timing(dragY, { toValue: live.current.height, duration: 190, useNativeDriver: true })
          .start(() => { dragY.setValue(0); live.current.onClose(); });
      } else {
        Animated.spring(dragY, { toValue: 0, useNativeDriver: true, bounciness: 2 }).start();
      }
    },
    // A drag interrupted by a call or backgrounding must leave the card where
    // it belongs rather than stranded mid-pull.
    onPanResponderTerminate: () => {
      Animated.spring(dragY, { toValue: 0, useNativeDriver: true, bounciness: 2 }).start();
    },
  }).panHandlers, [dragY]);

  const scrimOpacity = dragY.interpolate({
    inputRange: [0, Math.max(height, 1)], outputRange: [1, 0], extrapolate: 'clamp',
  });
  return { dragY, panHandlers, scrimOpacity };
}

// ---------------------------------------------------------------------------
// The study loop: top bar, the flipping card, the grade row
// ---------------------------------------------------------------------------
function StudyFace({
  sticker, review, practice, progress, stillLearning, startFlipped, imageUrl,
  onClose, onGraded, onUndoGrade, onToggleFavorite, onFlippedChange, onOpenDetail,
}: {
  sticker: Sticker;
  review: boolean;
  practice: boolean;
  progress?: StudyCardProps['progress'];
  stillLearning: boolean;
  startFlipped: boolean;
  imageUrl: string | null;
  onClose: () => void;
  onGraded?: StudyCardProps['onGraded'];
  onUndoGrade?: () => void;
  onToggleFavorite: () => void;
  onFlippedChange?: (flipped: boolean) => void;
  onOpenDetail: () => void;
}) {
  const { colors, type } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { reduced } = useMotion();
  const prefs = useStudyPrefs();

  const [flipped, setFlipped] = useState(false);
  useEffect(() => { onFlippedChange?.(flipped); }, [flipped]);
  const [hintCount, setHintCount] = useState(0);
  const [grading, setGrading] = useState(false);
  const flip = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;
  const flippedRef = useRef(false);
  const flippingRef = useRef(false);
  const gradingRef = useRef(false);
  const revealedAt = useRef(0);
  // Cards come back (learn-ahead), and a card an Undo returns to is opened on
  // its answer: one showing of a card is the id plus its place in the queue.
  const visit = `${sticker.id}:${progress?.index ?? ''}`;
  const skipAutoplay = useRef(false);
  const backAtTop = useRef(true);

  const tiers = useMemo(() => hintTiers(sticker), [sticker.id, sticker.word, sticker.reading, sticker.part_of_speech]);
  const hints = tiers.slice(0, hintCount);

  // Screen reader on: autoplay would collide with it.
  const screenReader = useRef(false);
  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then(v => { screenReader.current = v; }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', v => { screenReader.current = v; });
    return () => { sub.remove(); stopSpeaking(); };
  }, []);

  // ── card motion: exit toward the grade side, enter from 0.97 ──
  const tx = useSharedValue(0);
  const cardOpacity = useSharedValue(1);
  const cardScale = useSharedValue(1);
  const crossed = useSharedValue(false);
  const cardAnim = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [
      { translateX: tx.value },
      { rotate: `${reduced ? 0 : Math.max(-1, Math.min(1, tx.value / width)) * 6}deg` },
      { scale: cardScale.value },
    ],
  }));
  const washLeft = useAnimatedStyle(() => ({ opacity: tx.value < 0 ? Math.min(-tx.value / SWIPE_COMMIT, 1) * 0.6 : 0 }));
  const washRight = useAnimatedStyle(() => ({ opacity: tx.value > 0 ? Math.min(tx.value / SWIPE_COMMIT, 1) * 0.6 : 0 }));

  // Every card opens on its prompt side with no hint spent.
  useEffect(() => {
    flippedRef.current = startFlipped;
    flippingRef.current = false;
    gradingRef.current = false;
    skipAutoplay.current = startFlipped;
    setFlipped(startFlipped);
    setHintCount(0);
    setGrading(false);
    flip.setValue(startFlipped ? 1 : 0);
    rise.setValue(startFlipped ? 1 : 0);
    revealedAt.current = startFlipped ? Date.now() : 0;
    backAtTop.current = true;
    tx.value = 0;
    crossed.value = false;
    cardOpacity.value = 0;
    cardScale.value = reduced ? 1 : 0.97;
    cardOpacity.value = withTiming(1, { duration: reduced ? 120 : 200 });
    cardScale.value = withTiming(1, { duration: 200 });
  }, [visit]);

  // ── flip: 220ms out-cubic, or a 120ms fade under Reduce Motion ──
  const toggleFlip = useCallback(() => {
    if (flippingRef.current || gradingRef.current) return;
    const next = !flippedRef.current;
    flippingRef.current = true;
    flippedRef.current = next;
    setFlipped(next);
    if (next) { haptic.tap(); revealedAt.current = Date.now(); }
    else stopSpeaking();
    Animated.timing(flip, { toValue: next ? 1 : 0, duration: reduced ? 120 : flipMs, useNativeDriver: true })
      .start(() => { flippingRef.current = false; });
    if (next) {
      Animated.timing(rise, { toValue: 1, duration: 160, delay: reduced ? 0 : 120, useNativeDriver: true }).start();
    } else {
      rise.setValue(0);
    }
  }, [flip, rise, reduced]);

  // Autoplay: once per reveal, 150ms after the swap. Not with a screen reader
  // on, and never when an Undo has put you back on a card you already heard.
  useEffect(() => {
    if (!flipped) return;
    if (skipAutoplay.current) { skipAutoplay.current = false; return; }
    if (!prefs.autoplayAudio || screenReader.current) return;
    const t = setTimeout(() => speak(sticker.word, sticker.language), 150 + (reduced ? 0 : 0));
    return () => clearTimeout(t);
  }, [flipped, visit]);

  // ── grading ──
  const finish = useCallback((grade: Grade) => {
    onGraded?.(grade, schedule(sticker, grade));
  }, [sticker, onGraded]);

  const commit = useCallback((grade: Grade, swipe = false) => {
    if (!review || !flippedRef.current || gradingRef.current || flippingRef.current) return;
    // A double-tap on "Tap to reveal" must never also grade.
    if (Date.now() - revealedAt.current < GRADE_GUARD_MS) return;
    gradingRef.current = true;
    setGrading(true);
    stopSpeaking();
    if (grade === 'again') haptic.rigid(); else haptic.tap();
    const dir = grade === 'again' || grade === 'hard' ? -1 : 1;
    const done = (finished?: boolean) => { if (finished) runOnJS(finish)(grade); };
    if (reduced) {
      cardOpacity.value = withTiming(0, { duration: 120 }, done);
    } else {
      tx.value = withTiming(swipe ? dir * width : dir * 24, { duration: 180 });
      cardOpacity.value = withTiming(0, { duration: 180 }, done);
    }
  }, [review, reduced, width, finish]);

  // ── swipe on the back only: left = Again, right = Good ──
  const swipeActive = review && flipped && prefs.swipeGrading && !grading;
  const swipeCommit = useCallback((g: Grade) => commit(g, true), [commit]);
  const buzz = useCallback(() => haptic.select(), []);
  const pan = useMemo(() => Gesture.Pan()
    .enabled(swipeActive)
    .activeOffsetX([-12, 12])
    .failOffsetY([-24, 24])
    .onUpdate(e => {
      tx.value = e.translationX;
      const over = Math.abs(e.translationX) >= SWIPE_COMMIT;
      if (over !== crossed.value) {
        crossed.value = over;
        if (over) runOnJS(buzz)();
      }
    })
    .onEnd(e => {
      const dx = e.translationX;
      const fast = Math.abs(e.velocityX) > SWIPE_VELOCITY && Math.sign(e.velocityX) === Math.sign(dx || e.velocityX);
      if (Math.abs(dx) >= SWIPE_COMMIT || fast) {
        runOnJS(swipeCommit)((dx || e.velocityX) < 0 ? 'again' : 'good');
      } else {
        tx.value = withSpring(0, { damping: 20, stiffness: 300 });
        crossed.value = false;
      }
    }), [swipeActive, swipeCommit, buzz]);

  // ── pull down to close, on the front only ──
  const dismiss = useDismiss(onClose, () => !flippedRef.current || (!review && backAtTop.current));

  // ── progress bar ──
  const fraction = progress ? (progress.fraction ?? (progress.index + 1) / Math.max(progress.total, 1)) : 0;
  const bar = useRef(new Animated.Value(fraction)).current;
  useEffect(() => {
    Animated.timing(bar, { toValue: fraction, duration: reduced ? 0 : 200, useNativeDriver: false }).start();
  }, [fraction]);

  const openMenu = () => {
    haptic.select();
    showMenu([
      { label: sticker.is_favorite ? 'Remove from favourites' : 'Favourite', onPress: onToggleFavorite },
      { label: 'Edit card', onPress: onOpenDetail },
    ]);
  };

  // The card is one accessibility element, and iOS builds such an element's
  // label from every descendant's text, including the face that is turned
  // away, so VoiceOver would read the answer aloud before the flip. Say only
  // what is showing.
  const label = flipped
    ? answerLabel(sticker)
    : `${stillLearning ? `${STILL_LEARNING}. ` : ''}${promptLabel(sticker, hints)}`;
  const actions = flipped
    ? [
        ...(review ? [
          { name: 'again', label: 'Again' }, { name: 'hard', label: 'Hard' },
          { name: 'good', label: 'Good' }, { name: 'easy', label: 'Easy' },
          ...(onUndoGrade ? [{ name: 'undo', label: 'Undo the last grade' }] : []),
        ] : []),
        { name: 'speak', label: 'Hear it pronounced' },
        { name: 'details', label: 'Open card details' },
      ]
    : [...(hintCount < tiers.length ? [{ name: 'hint', label: 'Hint' }] : [])];

  const frontFace = reduced
    ? { opacity: flip.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }
    : {
        opacity: flip.interpolate({ inputRange: [0, 0.5, 0.5001, 1], outputRange: [1, 1, 0, 0] }),
        transform: [{ perspective: 1400 }, { rotateY: flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }],
      };
  const backFace = reduced
    ? { opacity: flip }
    : {
        opacity: flip.interpolate({ inputRange: [0, 0.4999, 0.5, 1], outputRange: [0, 0, 1, 1] }),
        transform: [{ perspective: 1400 }, { rotateY: flip.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] }) }],
      };

  return (
    <>
      <Animated.View style={[styles.scrim, { opacity: dismiss.scrimOpacity }]} pointerEvents="none" />
      <Animated.View
        {...dismiss.panHandlers}
        style={[
          styles.screen,
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.md },
          { transform: [{ translateY: dismiss.dragY }] },
        ]}
      >
        <View style={styles.topBar}>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.topBtn, pressed && styles.topBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Close this card"
          >
            <X size={22} strokeWidth={1.75} color={colors.inkDark} />
          </Pressable>
          {review && !!progress ? (
            <>
              <View style={styles.track} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Animated.View style={[styles.fill, { width: bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
              </View>
              <Text style={styles.count} maxFontSizeMultiplier={type.data.maxFontSizeMultiplier}>
                {`${progress.index + 1} / ${progress.total}`}
              </Text>
            </>
          ) : <View style={styles.flexSpace} />}
          {review ? (
            <Pressable
              onPress={openMenu}
              style={({ pressed }) => [styles.topBtn, pressed && styles.topBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="More actions"
            >
              <MoreHorizontal size={22} strokeWidth={1.75} color={colors.inkDark} />
            </Pressable>
          ) : <View style={styles.topBtn} />}
        </View>

        {practice && (
          <Text style={styles.practiceCaption} maxFontSizeMultiplier={type.small.maxFontSizeMultiplier}>
            Practice · doesn&apos;t change your schedule
          </Text>
        )}

        <GestureDetector gesture={pan}>
          <Reanimated.View style={[styles.cardArea, cardAnim]}>
            <Pressable
              style={styles.fillAbs}
              onPress={toggleFlip}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityHint={flipped ? 'Double-tap to see the question again' : 'Double-tap to reveal the answer'}
              accessibilityActions={actions}
              onAccessibilityAction={e => {
                const name = e.nativeEvent.actionName;
                if (name === 'activate') toggleFlip();
                else if (name === 'hint') setHintCount(c => Math.min(c + 1, tiers.length));
                else if (name === 'speak') speak(sticker.word, sticker.language);
                else if (name === 'details') onOpenDetail();
                else if (name === 'undo') onUndoGrade?.();
                else commit(name as Grade);
              }}
            >
              <Animated.View style={[styles.face, frontFace]} pointerEvents={flipped ? 'none' : 'auto'}>
                <View style={styles.card}>
                  <View style={styles.clip}>
                    <CardFront
                      key={`front-${visit}`}
                      card={sticker}
                      imageUrl={imageUrl}
                      hints={hints}
                      hasMoreHints={hintCount < tiers.length}
                      totalHints={tiers.length}
                      onHint={() => { haptic.select(); setHintCount(c => Math.min(c + 1, tiers.length)); }}
                      stillLearning={stillLearning}
                    />
                  </View>
                </View>
              </Animated.View>

              <Animated.View style={[styles.face, styles.backFaceBox, backFace]} pointerEvents={flipped ? 'auto' : 'none'}>
                <View style={styles.backCard}>
                  <View style={styles.backClip}>
                    <ScrollView
                      key={`back-${visit}`}
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={styles.backScroll}
                      onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => { backAtTop.current = e.nativeEvent.contentOffset.y <= 0; }}
                      scrollEventThrottle={16}
                    >
                      <CardBack
                        card={sticker}
                        variant="study"
                        thumbUrl={imageUrl}
                        thumbPath={sticker.image_path}
                        onSpeak={() => speak(sticker.word, sticker.language)}
                        onOpenMemory={onOpenDetail}
                      />
                    </ScrollView>
                  </View>
                </View>
              </Animated.View>
            </Pressable>

            {/* Swipe feedback grows from the edge it is heading for. */}
            <Reanimated.View pointerEvents="none" style={[styles.wash, styles.washLeft, washLeft]}>
              <RotateCcw size={28} strokeWidth={2} color={colors.errorInk} />
            </Reanimated.View>
            <Reanimated.View pointerEvents="none" style={[styles.wash, styles.washRight, washRight]}>
              <Check size={28} strokeWidth={2.25} color={colors.successInk} />
            </Reanimated.View>

            {/* Outside the card's accessibility element, so it stays its own
                line for VoiceOver and the approved flow. */}
            {!flipped && (
              <View style={styles.revealHint} pointerEvents="none">
                <Text style={styles.revealText} maxFontSizeMultiplier={type.small.maxFontSizeMultiplier}>Tap to reveal</Text>
              </View>
            )}
          </Reanimated.View>
        </GestureDetector>

        {/* The grading row lives below the card rather than on it, so both
            faces stay exactly as designed: the card is the flashcard, this is
            the machinery around it. The slot is reserved so the card never
            changes height at the flip. */}
        {review && (
          <View style={styles.gradeSlot}>
            {flipped && (
              <Animated.View style={{ opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
                <GradeRow sticker={sticker} practice={practice} simple={prefs.simpleGrading} disabled={grading} onGrade={g => commit(g)} />
              </Animated.View>
            )}
          </View>
        )}
      </Animated.View>
    </>
  );
}

const makeStyles = ({ colors, type, e1 }: Theme) => StyleSheet.create({
  root: { flex: 1 },
  // Dimmed, not opaque: the point of pulling the card down is to see that there
  // is a screen behind it to go back to.
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.scrim },
  page: { flex: 1, backgroundColor: colors.sky },
  screen: { flex: 1, backgroundColor: colors.sky, paddingHorizontal: 20 },

  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.sm },
  topBtn: { width: MIN_TAP, height: MIN_TAP, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  topBtnPressed: { backgroundColor: colors.terraLight },
  flexSpace: { flex: 1 },
  practiceCaption: { ...type.small, textAlign: 'center', paddingBottom: spacing.sm },
  track: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.terraLight, overflow: 'hidden' },
  fill: { height: 3, borderRadius: 2, backgroundColor: colors.terra },
  count: { ...type.data, color: colors.inkLight, minWidth: 48, textAlign: 'center' },

  cardArea: { flex: 1 },
  fillAbs: { ...StyleSheet.absoluteFillObject },
  face: { ...StyleSheet.absoluteFillObject, backfaceVisibility: 'hidden' },
  // Shadow on the outer view, clipping on the inner: a view that both clips and
  // casts a shadow loses the shadow on iOS.
  card: { flex: 1, backgroundColor: colors.card, borderRadius: radii.lg, ...e1 },
  clip: { flex: 1, borderRadius: radii.lg, overflow: 'hidden' },
  // The back hugs its content (a short card is not 60% empty white) and scrolls
  // once it outgrows the area. The empty space below still taps to flip back.
  backFaceBox: { justifyContent: 'flex-start' },
  backCard: { maxHeight: '100%', flexShrink: 1, backgroundColor: colors.card, borderRadius: radii.lg, ...e1 },
  backClip: { flexShrink: 1, borderRadius: radii.lg, overflow: 'hidden' },
  backScroll: { padding: 24, paddingBottom: 16 },

  revealHint: { position: 'absolute', left: 0, right: 0, bottom: 20, alignItems: 'center' },
  revealText: { ...type.small },

  wash: {
    position: 'absolute', top: 0, bottom: 0, width: '55%', borderRadius: radii.lg,
    justifyContent: 'center',
  },
  washLeft: { left: 0, backgroundColor: colors.againTint, paddingLeft: 24, alignItems: 'flex-start' },
  washRight: { right: 0, backgroundColor: colors.successLight, paddingRight: 24, alignItems: 'flex-end' },

  gradeSlot: { minHeight: 60 + spacing.ms, paddingTop: spacing.ms },
});
