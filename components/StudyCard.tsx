import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, Pressable, Animated,
  ActivityIndicator, AccessibilityInfo, ScrollView, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  useAudioRecorder, useAudioRecorderState, RecordingPresets,
  requestRecordingPermissionsAsync, setAudioModeAsync,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { X, Volume2, HelpCircle, Mic, Play, Trash2, PenLine, PinOff } from 'lucide-react-native';
import { Sticker } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { speak } from '@/lib/speech';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useSignedUrls } from '@/hooks/useSignedUrls';
import { useStickerAuthors } from '@/hooks/useStickerAuthors';
import { ageInDays, intervalPreview, schedule, Grade } from '@/lib/review';
import { computeTrimOffsets, MeteringSample } from '@/lib/audioTrim';
import { useTrimmedVoicePlayback } from '@/hooks/useTrimmedVoicePlayback';
import Avatar from '@/components/Avatar';
import FieldEditor, { EditorSpec } from '@/components/FieldEditor';
import { getFunctionErrorMessage } from '@/lib/functionError';
import { colors, radii, spacing, shadows, fonts } from '@/constants/theme';

/**
 * 'browse' — just look at the card. Flipping is free: nothing is written, no
 * grade is asked for, and the schedule is untouched. This is what tapping a
 * sticker anywhere in the app does.
 *
 * 'review' — the card is part of a study session. The answer side asks for a
 * grade, and that grade is what advances SM-2.
 *
 * Keeping these apart matters: if simply looking at a word counted as a
 * review, the schedule would slowly fill with cards you glanced at rather
 * than cards you actually recalled.
 */
export type StudyCardMode = 'browse' | 'review';

interface StudyCardProps {
  sticker: Sticker | null;
  mode?: StudyCardMode;
  onClose: () => void;
  /// Fired after a grade is written. The parent decides what "next" means —
  /// advance a session queue, or close a one-off card.
  onGraded?: (grade: Grade) => void;
  /// Position in the current study session, if there is one.
  progress?: { index: number; total: number };
  /// Fired after the sticker and every file it owns are gone, so the screen
  /// behind can drop it from its list.
  onDeleted?: () => void;
  /// Same patch channel the lists use, so a review written here is reflected
  /// in the grid and the due queue without a refetch — see skills.md #1.
  onUpdate?: (id: string, patch: Partial<Sticker>) => void;
  /// Present only when this card was opened from a board, where "remove" has
  /// a second and far narrower meaning than the delete button above: unpin it
  /// from this one board, leave it in the collection. Without it the only
  /// destructive control on a board sticker was the one with the widest
  /// possible blast radius, wearing the same trash glyph.
  onRemoveFromBoard?: { boardName: string; remove: () => void | Promise<void> };
}

const FLIP_MS = 420;
// Shorter than this and it's an accidental brush of the mic, not a take.
const MIN_RECORDING_MS = 300;

// A stable four-digit label. Deliberately hashed from the id rather than
// taken from the sticker's position in the collection: an index would
// renumber every card behind one you delete, and a card number that moves
// is worse than no card number.
function cardNumber(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return String(h % 10000).padStart(4, '0');
}

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}TH`;
  switch (n % 10) {
    case 1: return `${n}ST`;
    case 2: return `${n}ND`;
    case 3: return `${n}RD`;
    default: return `${n}TH`;
  }
}

export type EditTarget = 'note' | 'word' | 'reading' | 'meaning' | 'sentence';

// Columns that are genuinely nullable — anything else keeps its old value
// rather than being blanked, so an accidental empty save can't strip the
// headword off a card.
const NULLABLE_FIELDS = new Set(['notes', 'part_of_speech', 'sentence_insight']);

function editorSpecFor(target: EditTarget, sticker: Sticker): EditorSpec {
  switch (target) {
    case 'note':
      return {
        title: 'What happened?',
        subtitle: 'Where you were, who you were with, why this one stuck — the part no dictionary has.',
        inputs: [{
          key: 'notes',
          value: sticker.notes ?? '',
          placeholder: 'Queued twenty minutes in the rain for this…',
          multiline: true,
        }],
      };
    case 'word':
      return {
        title: 'The word',
        subtitle: 'As it is written in the target language. Correcting a spelling here changes nothing else on the card.',
        inputs: [{ key: 'word', label: 'WORD', value: sticker.word }],
      };
    case 'reading':
      return {
        title: 'How to say it',
        inputs: [{ key: 'reading', label: 'READING', value: sticker.reading }],
      };
    case 'meaning':
      return {
        title: 'What it means',
        subtitle: 'If the scan identified the wrong object, this is the field to fix — everything else on the card follows from it.',
        inputs: [
          { key: 'translation', label: 'MEANS', value: sticker.translation },
          { key: 'part_of_speech', label: 'PART OF SPEECH', value: sticker.part_of_speech ?? '', placeholder: 'noun, verb, adjective…' },
        ],
        regenerate: {
          label: 'Update the word and reading to match',
          hint: 'Re-derives the word, reading and part of speech from the new meaning. Your sentence is left alone — it describes your actual photo, and a regenerated one would not.',
        },
      };
    case 'sentence':
      return {
        title: 'In use',
        subtitle: 'The example sentence and its English.',
        inputs: [
          { key: 'sentence', label: 'SENTENCE', value: sticker.sentence, multiline: true },
          { key: 'sentence_translation', label: 'IN ENGLISH', value: sticker.sentence_translation, multiline: true },
        ],
      };
  }
}

/**
 * Re-derives the target-language fields from a corrected English meaning.
 *
 * Deliberately does NOT touch `sentence`/`sentence_translation`: the stored
 * sentence was generated against the actual photo and names real things in
 * the scene, while translate-word only ever sees a bare English word and
 * returns a generic example. Overwriting would trade something specific to
 * that moment for something anyone could have written.
 */
async function regenerateFromMeaning(englishWord: string, language: Sticker['language']) {
  const { data, error } = await supabase.functions.invoke('translate-word', {
    body: { englishWord, language },
  });
  if (error) throw new Error(await getFunctionErrorMessage(error));
  if (data?.error) throw new Error(String(data.error));
  // Only keys the model actually returned — an `undefined` in the patch would
  // travel to Supabase as a column being set, not as one being left alone.
  const derived: Record<string, unknown> = {};
  if (data.word) derived.word = String(data.word);
  if (data.reading) derived.reading = String(data.reading);
  if (data.part_of_speech) derived.part_of_speech = String(data.part_of_speech);
  if (data.category) derived.category = data.category;
  return derived;
}

const GRADES: Array<{ grade: Grade; label: string; tone: 'toneAgain' | 'toneHard' | 'toneGood' | 'toneEasy' }> = [
  { grade: 'again', label: 'Again', tone: 'toneAgain' },
  { grade: 'hard',  label: 'Hard',  tone: 'toneHard'  },
  { grade: 'good',  label: 'Good',  tone: 'toneGood'  },
  { grade: 'easy',  label: 'Easy',  tone: 'toneEasy'  },
];

/** "6d", "3mo", "1.5y" — the gap each button would open up. */
export function formatInterval(days: number): string {
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  const years = days / 365;
  return `${years < 10 ? years.toFixed(1).replace(/\.0$/, '') : Math.round(years)}y`;
}

/**
 * Splits a sentence around the headword so it can be bolded in place.
 *
 * The headword is often stored with an article the sentence doesn't repeat
 * ("Le Café" vs "…un café…"), so a failed exact match falls back to the last
 * whitespace-separated token. Returns null when neither is found, and the
 * caller renders the sentence plain rather than guessing.
 */
export function splitAroundWord(sentence: string, word: string): [string, string, string] | null {
  const attempt = (needle: string): [string, string, string] | null => {
    if (!needle) return null;
    const at = sentence.toLowerCase().indexOf(needle.toLowerCase());
    if (at < 0) return null;
    return [sentence.slice(0, at), sentence.slice(at, at + needle.length), sentence.slice(at + needle.length)];
  };
  const tokens = word.trim().split(/\s+/);
  return attempt(word.trim()) ?? attempt(tokens[tokens.length - 1]);
}

export default function StudyCard({
  sticker, mode = 'browse', onClose, onGraded, progress, onDeleted, onUpdate, onRemoveFromBoard,
}: StudyCardProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const [flipped, setFlipped] = useState(false);
  const [hintShown, setHintShown] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const flip = useRef(new Animated.Value(0)).current;
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  // Polled well under the default 500ms so the silence trim has enough
  // resolution to find where speech actually starts and ends.
  const recorderState = useAudioRecorderState(recorder, 100);
  const meteringSamplesRef = useRef<MeteringSample[]>([]);
  const [grading, setGrading] = useState(false);
  // Which field the editor sheet is open on, if any. Carrying the whole spec
  // rather than a flag means it can't reopen onto the previous field's draft.
  const [editing, setEditing] = useState<{ target: EditTarget; spec: EditorSpec } | null>(null);
  const [savingField, setSavingField] = useState(false);

  // Every sticker readable here is the signed-in user's own (RLS is
  // owner-only since 022_restrict_stickers_to_owner.sql), but one won off a
  // friend is still credited to them — the byline and the face follow
  // whoever actually found the word. Resolved from the sticker itself rather
  // than threaded in as a prop, which is exactly the kind of prop that gets
  // forgotten at a call site.
  const authorOf = useStickerAuthors(
    useMemo(() => (sticker ? [sticker] : []), [sticker]),
    profile,
  );
  const author = sticker ? authorOf(sticker) : null;
  const authorName = author?.username ?? 'You';

  const urls = useSignedUrls(useMemo(
    () => (sticker ? [sticker.image_path] : []),
    [sticker?.image_path]
  ));
  const imageUrl = sticker ? urls.get(sticker.image_path) ?? null : null;

  const { play: playVoice, pause: pauseVoice } = useTrimmedVoicePlayback(
    voiceUrl, sticker?.voice_note_start_ms, sticker?.voice_note_end_ms
  );

  // Signed here rather than through useSignedUrls: re-recording overwrites
  // the same storage path, so the map keyed by that path would never
  // re-sign and the player would keep serving the previous take.
  const refreshVoiceUrl = useCallback(async (path: string) => {
    const { data } = await supabase.storage.from('sticker-images').createSignedUrl(path, 3600);
    if (data) setVoiceUrl(data.signedUrl);
  }, []);

  useEffect(() => {
    setVoiceUrl(null);
    if (!sticker?.voice_note_path) return;
    let cancelled = false;
    supabase.storage.from('sticker-images')
      .createSignedUrl(sticker.voice_note_path, 3600)
      .then(({ data }) => { if (!cancelled && data) setVoiceUrl(data.signedUrl); });
    return () => { cancelled = true; };
  }, [sticker?.id, sticker?.voice_note_path]);

  useEffect(() => {
    if (!recorderState.isRecording) return;
    meteringSamplesRef.current.push({
      t: recorderState.durationMillis,
      db: recorderState.metering ?? -160,
    });
  }, [recorderState.isRecording, recorderState.durationMillis, recorderState.metering]);

  // Never leave the mic hot when the card changes or closes.
  useEffect(() => () => {
    if (recorderState.isRecording) recorder.stop();
  }, [sticker?.id]);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(e => { if (mounted) setReducedMotion(e); });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => { mounted = false; sub.remove(); };
  }, []);

  // Every card opens on its prompt side, with no hint spent.
  useEffect(() => {
    if (!sticker) return;
    setFlipped(false);
    setHintShown(false);
    setGrading(false);
    setEditing(null);
    flip.setValue(0);
  }, [sticker?.id]);

  // Grading is what advances the schedule — flipping on its own no longer
  // counts as a pass. An earlier version logged a review on flip, which meant
  // a word you had completely blanked on advanced exactly like one you
  // answered instantly.
  const handleGrade = useCallback(async (grade: Grade) => {
    if (!sticker || grading || mode !== 'review') return;
    setGrading(true);
    Haptics.impactAsync(
      grade === 'again' ? Haptics.ImpactFeedbackStyle.Rigid : Haptics.ImpactFeedbackStyle.Light
    );
    const patch = schedule(sticker, grade);
    onUpdate?.(sticker.id, patch);
    onGraded?.(grade);
    const { error } = await supabase.from('stickers').update(patch).eq('id', sticker.id);
    // Roll back rather than leave the card claiming a review the server never
    // stored — the schedule would then disagree on the next load.
    if (error) {
      onUpdate?.(sticker.id, {
        ease_factor: sticker.ease_factor,
        interval_days: sticker.interval_days,
        review_count: sticker.review_count,
        lapses: sticker.lapses,
        last_reviewed_at: sticker.last_reviewed_at,
      });
    }
    setGrading(false);
  }, [sticker, grading, mode, onUpdate, onGraded]);

  const openEditor = (target: EditTarget) => {
    if (!sticker) return;
    Haptics.selectionAsync();
    setEditing({ target, spec: editorSpecFor(target, sticker) });
  };

  const handleSaveField = async (values: Record<string, string>, regenerate: boolean) => {
    if (!sticker || !editing) return;
    setSavingField(true);
    // Clearing a nullable field stores null, so "no note" and "a note that is
    // one space" aren't two different states. Clearing a required one is
    // ignored rather than written — an accidental empty save must not be able
    // to strip the headword off a card.
    const patch: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(values)) {
      if (raw.length > 0) patch[key] = raw;
      else if (NULLABLE_FIELDS.has(key)) patch[key] = null;
    }

    try {
      // Re-derive before writing, so one update carries both the correction
      // and everything downstream of it — a half-applied card that says
      // "ramen" over a reading of "noodles" is worse than a failed save.
      if (regenerate && values.translation) {
        Object.assign(patch, await regenerateFromMeaning(values.translation, sticker.language));
      }
      if (Object.keys(patch).length === 0) { setEditing(null); return; }

      const before = sticker as unknown as Record<string, unknown>;
      const previous = Object.fromEntries(
        Object.keys(patch).map(k => [k, before[k]])
      ) as Partial<Sticker>;
      onUpdate?.(sticker.id, patch as Partial<Sticker>);
      const { error } = await supabase.from('stickers').update(patch).eq('id', sticker.id);
      if (error) {
        onUpdate?.(sticker.id, previous);
        throw error;
      }
      setEditing(null);
    } catch (err: any) {
      Alert.alert("Couldn't save", err?.message ?? 'Something went wrong.');
    } finally {
      setSavingField(false);
    }
  };

  // Hold the mic to record, let go to stop — re-holding overwrites the
  // previous take at the same storage path, so there is always at most one
  // voice note per sticker.
  const handleStartRecording = async () => {
    if (!sticker || uploadingVoice || recorderState.isRecording) return;
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      Alert.alert('Microphone access needed', 'Allow microphone access to record your pronunciation.');
      return;
    }
    pauseVoice();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    meteringSamplesRef.current = [];
    // record() silently no-ops unless the audio session has allowsRecording
    // on — lib/speech.ts only ever sets playsInSilentMode for TTS, so this
    // has to be set explicitly here.
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  };

  const handleStopRecording = async () => {
    if (!sticker || !recorderState.isRecording) return;
    const durationMs = recorderState.durationMillis;
    const samples = meteringSamplesRef.current;
    await recorder.stop();
    // Back to playback-only, so speak() and voice playback afterward aren't
    // left routed through the recording session.
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    if (durationMs < MIN_RECORDING_MS) return;

    setUploadingVoice(true);
    try {
      if (!recorder.uri) throw new Error('Recording failed');
      const { startMs, endMs } = computeTrimOffsets(samples, durationMs);
      const path = `${sticker.user_id}/${sticker.id}-voice.m4a`;
      const bytes = await new File(recorder.uri).bytes();
      const { error } = await supabase.storage
        .from('sticker-images')
        .upload(path, bytes, { contentType: 'audio/m4a', upsert: true });
      if (error) throw error;
      await supabase.from('stickers').update({
        voice_note_path: path,
        voice_note_start_ms: startMs,
        voice_note_end_ms: endMs,
      }).eq('id', sticker.id);
      onUpdate?.(sticker.id, {
        voice_note_path: path, voice_note_start_ms: startMs, voice_note_end_ms: endMs,
      });
      await refreshVoiceUrl(path);
    } catch (err: any) {
      Alert.alert("Couldn't save recording", err?.message ?? 'Something went wrong.');
    } finally {
      setUploadingVoice(false);
    }
  };

  // A sticker and its card are one thing, not a note pointing at a photo —
  // so deleting takes the row and every file it owns with it. Leaving the
  // cutout, memory photo or voice note behind would orphan them in storage
  // with nothing left that could ever reference or clean them up.
  const handleDelete = () => {
    if (!sticker) return;
    Alert.alert(
      'Delete card',
      `Remove "${sticker.word}" from your collection? The cutout, photo and any recording go with it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const paths = [sticker.image_path];
            if (sticker.memory_photo_path) paths.push(sticker.memory_photo_path);
            if (sticker.voice_note_path) paths.push(sticker.voice_note_path);
            const [{ error }] = await Promise.all([
              supabase.from('stickers').delete().eq('id', sticker.id),
              supabase.storage.from('sticker-images').remove(paths),
            ]);
            if (error) {
              Alert.alert("Couldn't delete", error.message);
              return;
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onDeleted?.();
            onClose();
          },
        },
      ]
    );
  };

  const handleRemoveFromBoard = () => {
    if (!sticker || !onRemoveFromBoard) return;
    const { boardName, remove } = onRemoveFromBoard;
    Alert.alert(
      'Remove from board',
      `Take "${sticker.word}" off "${boardName}"? It stays in your collection.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          onPress: async () => {
            await remove();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onClose();
          },
        },
      ]
    );
  };

  const toggleFlip = useCallback(() => {
    if (!sticker) return;
    const next = !flipped;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFlipped(next);
    Animated.timing(flip, {
      toValue: next ? 1 : 0,
      duration: reducedMotion ? 160 : FLIP_MS,
      useNativeDriver: true,
    }).start();
  }, [sticker, flipped, reducedMotion, flip]);

  if (!sticker) return null;

  // Under Reduce Motion the faces cross-fade in place instead of rotating —
  // a half-second of spinning geometry is exactly what that setting is for.
  const frontFace = reducedMotion
    ? { opacity: flip.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }
    : {
        opacity: flip.interpolate({ inputRange: [0, 0.5, 0.5001, 1], outputRange: [1, 1, 0, 0] }),
        transform: [
          { perspective: 1400 },
          { rotateY: flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) },
        ],
      };
  const backFace = reducedMotion
    ? { opacity: flip }
    : {
        opacity: flip.interpolate({ inputRange: [0, 0.4999, 0.5, 1], outputRange: [0, 0, 1, 1] }),
        transform: [
          { perspective: 1400 },
          { rotateY: flip.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] }) },
        ],
      };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={[styles.screen, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} style={styles.topBtn} hitSlop={10}>
            <X size={20} color={colors.inkDark} />
          </TouchableOpacity>
          {!!progress && (
            <Text style={styles.progress}>{progress.index + 1} / {progress.total}</Text>
          )}
          <TouchableOpacity onPress={handleDelete} style={styles.topBtn} hitSlop={10}>
            <Trash2 size={18} color={colors.error} />
          </TouchableOpacity>
        </View>

        <Pressable style={styles.cardArea} onPress={toggleFlip}>
          <Animated.View style={[styles.face, frontFace]} pointerEvents={flipped ? 'none' : 'auto'}>
            <FrontFace
              sticker={sticker}
              authorName={authorName}
              authorAvatarPath={author?.avatar_path ?? null}
              imageUrl={imageUrl}
              hintShown={hintShown}
              onHint={() => { Haptics.selectionAsync(); setHintShown(true); }}
              // Mid-session the note is part of the prompt, so tapping it
              // should flip the card like the rest of the face. Editing is a
              // browsing action.
              onEditNote={mode === 'browse' ? () => openEditor('note') : undefined}
            />
          </Animated.View>

          <Animated.View style={[styles.face, backFace]} pointerEvents={flipped ? 'auto' : 'none'}>
            <BackFace
              sticker={sticker}
              mode={mode}
              onEditField={mode === 'browse' ? openEditor : undefined}
              imageUrl={imageUrl}
              voice={{
                hasTake: !!sticker.voice_note_path,
                recording: recorderState.isRecording,
                uploading: uploadingVoice,
                onPlay: playVoice,
                onStart: handleStartRecording,
                onStop: handleStopRecording,
              }}
            />
          </Animated.View>
        </Pressable>

        {/* The grading row lives below the card rather than on it, so both
            faces stay exactly as designed — the card is the flashcard, this
            is the machinery around it. */}
        {flipped && mode === 'review' ? (
          <View style={styles.gradeRow}>
            {GRADES.map(({ grade, label, tone }) => (
              <TouchableOpacity
                key={grade}
                style={[styles.gradeBtn, styles[tone]]}
                onPress={() => handleGrade(grade)}
                disabled={grading}
              >
                <Text style={[styles.gradeLabel, tone === 'toneAgain' && styles.gradeLabelOnDark]}>
                  {label}
                </Text>
                <Text style={[styles.gradeWhen, tone === 'toneAgain' && styles.gradeWhenOnDark]}>
                  {formatInterval(intervalPreview(sticker, grade))}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.browseFooter}>
            <Text style={styles.flipHint}>
              {flipped ? 'Tap the card to go back' : 'Tap the card to reveal'}
            </Text>
            {mode === 'browse' && !!onRemoveFromBoard && (
              <TouchableOpacity
                style={styles.unpinBtn}
                onPress={handleRemoveFromBoard}
                activeOpacity={0.7}
                hitSlop={6}
              >
                <PinOff size={13} color={colors.inkLight} />
                <Text style={styles.unpinText} numberOfLines={1}>
                  Remove from “{onRemoveFromBoard.boardName}”
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <FieldEditor
        spec={editing?.spec ?? null}
        saving={savingField}
        onCancel={() => setEditing(null)}
        onSave={handleSaveField}
      />
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Front — the prompt. Everything you recorded about the moment, and nothing
// that would give the word away.
// ---------------------------------------------------------------------------
function FrontFace({ sticker, authorName, authorAvatarPath, imageUrl, hintShown, onHint, onEditNote }: {
  sticker: Sticker; authorName: string; authorAvatarPath: string | null; imageUrl: string | null;
  hintShown: boolean; onHint: () => void; onEditNote?: () => void;
}) {
  const found = new Date(sticker.discovered_at);
  const hint = Array.from(sticker.word.trim())[0] ?? '';
  const note = sticker.notes?.trim() ?? '';

  return (
    <View style={styles.card}>
      <View style={styles.cardBody}>
        <View style={styles.frontHead}>
          <View style={styles.frontDate}>
            <Text style={styles.dayNumber}>{found.toLocaleDateString(undefined, { day: 'numeric' })}</Text>
            <View>
              <Text style={styles.weekday}>{found.toLocaleDateString(undefined, { weekday: 'long' })}</Text>
              <Text style={styles.monthYear}>
                {found.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }).toUpperCase()}
              </Text>
            </View>
          </View>
          <View style={styles.frontAuthor}>
            <View style={styles.frontAuthorText}>
              <Text style={styles.authorName} numberOfLines={1}>{authorName}</Text>
              <Text style={styles.dayCount}>DAY {ageInDays(sticker.discovered_at)}</Text>
            </View>
            <Avatar name={authorName} avatarPath={authorAvatarPath} size={38} />
          </View>
        </View>

        <ScrollView
          style={styles.frontScroll}
          contentContainerStyle={styles.frontScrollContent}
          showsVerticalScrollIndicator={false}
          // The card itself is the tap target for flipping; without this a
          // drag that starts on the note is swallowed by the scroll view and
          // the tap never reaches the Pressable behind it.
          scrollEnabled={!!note}
        >
          {onEditNote ? (
            <TouchableOpacity onPress={onEditNote} activeOpacity={0.7}>
              {note ? (
                <Text style={styles.note}>{note}</Text>
              ) : (
                // An empty note is the common case on a fresh card, so it gets
                // an invitation rather than blank space — this is the one
                // field only the person who was there can fill in.
                <View style={styles.notePrompt}>
                  <PenLine size={15} color={colors.inkFaint} />
                  <Text style={styles.notePromptText}>Add what happened that day…</Text>
                </View>
              )}
            </TouchableOpacity>
          ) : (
            !!note && <Text style={styles.note}>{note}</Text>
          )}

          <View style={styles.wellWrap}>
            <View style={styles.well}>
              {imageUrl ? (
                <Image
                  source={{ uri: imageUrl, cacheKey: sticker.image_path }}
                  cachePolicy="memory-disk"
                  contentFit="contain"
                  style={styles.wellImage}
                />
              ) : (
                <ActivityIndicator color={colors.terra} />
              )}
            </View>
          </View>
        </ScrollView>

        <View style={styles.promptRow}>
          <Text style={styles.prompt}>
            {hintShown ? `Starts with ${hint}` : 'What did you call this?'}
          </Text>
          {!hintShown && (
            <TouchableOpacity style={styles.hintPill} onPress={onHint} hitSlop={8}>
              <HelpCircle size={14} color={colors.inkDark} />
              <Text style={styles.hintText}>Hint</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Perforation />
      <View style={styles.footer}>
        <FooterField label="WHERE" value={sticker.location_label ?? 'Not recorded'} />
        <FooterField
          label="WHEN"
          value={`${found.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}, ${found.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`}
          align="right"
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Back — the answer, as a run of labelled rows.
// ---------------------------------------------------------------------------
interface VoiceControls {
  hasTake: boolean;
  recording: boolean;
  uploading: boolean;
  onPlay: () => void;
  onStart: () => void;
  onStop: () => void;
}

function BackFace({ sticker, mode, onEditField, imageUrl, voice }: {
  sticker: Sticker; mode: StudyCardMode; onEditField?: (target: EditTarget) => void;
  imageUrl: string | null; voice: VoiceControls;
}) {
  const found = new Date(sticker.discovered_at);
  // In a session the badge names the review being done right now; browsing
  // it names the history, because looking is not reviewing.
  const reviewsDone = sticker.review_count ?? 0;
  const badge = mode === 'review'
    ? `${ordinal(reviewsDone + 1)} REVIEW`
    : reviewsDone === 0
      ? 'NEW CARD'
      : `${reviewsDone} REVIEW${reviewsDone === 1 ? '' : 'S'}`;
  const parts = splitAroundWord(sticker.sentence, sticker.word);
  const wordFont = sticker.language === 'fr' ? fonts.cozy : fonts.jp;

  return (
    <View style={styles.card}>
      <View style={styles.cardBody}>
        <View style={styles.backHead}>
          <Text style={styles.backMeta}>CARD {cardNumber(sticker.id)} · {sticker.language.toUpperCase()}</Text>
          <Text style={styles.backMeta}>{badge}</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.backScroll}>
          <Field label="WORD" onEdit={onEditField && (() => onEditField('word'))}>
            <Text style={[styles.word, { fontFamily: wordFont }]}>{sticker.word}</Text>
          </Field>

          <Field label="SAY IT" onEdit={onEditField && (() => onEditField('reading'))}>
            <View style={styles.sayItRow}>
              <Text style={styles.reading} numberOfLines={2}>[{sticker.reading}]</Text>
              <View style={styles.sayItBtns}>
                <TouchableOpacity
                  style={styles.speakBtn}
                  onPress={() => speak(sticker.word, sticker.language)}
                  hitSlop={8}
                >
                  <Volume2 size={17} color={colors.white} />
                </TouchableOpacity>

                {voice.hasTake && !voice.recording && (
                  <TouchableOpacity style={styles.voiceBtn} onPress={voice.onPlay} hitSlop={8}>
                    <Play size={14} color={colors.sageDark} fill={colors.sageDark} />
                  </TouchableOpacity>
                )}

                {/* Press-and-hold rather than tap-to-toggle: a hold can't
                    leave the mic running if the card is dismissed mid-take. */}
                <TouchableOpacity
                  style={[styles.micBtn, voice.recording && styles.micBtnLive]}
                  onPressIn={voice.onStart}
                  onPressOut={voice.onStop}
                  disabled={voice.uploading}
                  hitSlop={8}
                >
                  {voice.uploading
                    ? <ActivityIndicator size="small" color={colors.terra} />
                    : <Mic size={16} color={voice.recording ? colors.white : colors.terra} />}
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.micHint}>
              {voice.recording
                ? 'Recording… let go to stop'
                : voice.hasTake
                  ? 'Hold the mic to record a new take'
                  : 'Hold the mic to record your pronunciation'}
            </Text>
          </Field>

          <Field
            label={sticker.part_of_speech ? `MEANS · ${sticker.part_of_speech.toUpperCase()}` : 'MEANS'}
            onEdit={onEditField && (() => onEditField('meaning'))}
          >
            <Text style={styles.means}>{sticker.translation}</Text>
          </Field>

          <Field label="IN USE" last onEdit={onEditField && (() => onEditField('sentence'))}>
            <Text style={styles.sentence}>
              {parts ? (
                <>
                  {parts[0]}
                  <Text style={styles.sentenceWord}>{parts[1]}</Text>
                  {parts[2]}
                </>
              ) : sticker.sentence}
            </Text>
            <Text style={styles.sentenceTranslation}>{sticker.sentence_translation}</Text>
          </Field>
        </ScrollView>
      </View>

      <Perforation />
      <View style={styles.footer}>
        <View style={styles.footerThumb}>
          {imageUrl && (
            <Image
              source={{ uri: imageUrl, cacheKey: sticker.image_path }}
              cachePolicy="memory-disk"
              contentFit="cover"
              style={styles.wellImage}
            />
          )}
        </View>
        <FooterField label="SHOT AT" value={sticker.location_label ?? 'Not recorded'} />
        <Text style={styles.footerWhen}>
          {found.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })},{' '}
          {found.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }).toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

// A field is only tappable while browsing. Mid-session every tap on the card
// should flip it — being dropped into a text editor because you tapped
// slightly left of centre would be a bad surprise while studying.
function Field({ label, children, last, onEdit }: {
  label: string; children: React.ReactNode; last?: boolean; onEdit?: () => void;
}) {
  const body = (
    <>
      <View style={styles.fieldHead}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {!!onEdit && <PenLine size={13} color={colors.inkFaint} />}
      </View>
      {children}
    </>
  );
  if (!onEdit) return <View style={[styles.field, !last && styles.fieldRuled]}>{body}</View>;
  return (
    <TouchableOpacity
      style={[styles.field, !last && styles.fieldRuled]}
      onPress={onEdit}
      activeOpacity={0.7}
    >
      {body}
    </TouchableOpacity>
  );
}

function FooterField({ label, value, align }: { label: string; value: string; align?: 'right' }) {
  return (
    <View style={[styles.footerField, align === 'right' && styles.footerFieldRight]}>
      <Text style={styles.footerLabel}>{label}</Text>
      <Text style={styles.footerValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// The torn-ticket seam between the card and its footer. A dashed border on a
// zero-height view, rather than a row of drawn dots, so it stretches to any
// card width without the dashes ever landing half-off the edge.
function Perforation() {
  return <View style={styles.perforation} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.sky, paddingHorizontal: spacing.md },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
  },
  topBtn: {
    width: 36, height: 36, borderRadius: radii.full,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card,
    ...shadows.card,
  },

  cardArea: { flex: 1 },
  face: { ...StyleSheet.absoluteFillObject, backfaceVisibility: 'hidden' },

  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 28,
    overflow: 'hidden',
    ...shadows.card,
  },
  cardBody: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },

  // ── front ──
  frontHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  frontDate: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dayNumber: { fontSize: 34, lineHeight: 38, fontFamily: fonts.cozy, color: colors.inkDark },
  weekday: { fontSize: 15, fontFamily: fonts.cozy, color: colors.inkDark },
  monthYear: { fontSize: 9.5, fontFamily: fonts.mono, color: colors.inkLight, letterSpacing: 1.4 },
  frontAuthor: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  frontAuthorText: { alignItems: 'flex-end' },
  authorName: { fontSize: 13, fontFamily: fonts.cozy, color: colors.inkDark },
  dayCount: { fontSize: 9.5, fontFamily: fonts.mono, color: colors.inkLight, letterSpacing: 1.4 },

  frontScroll: { flex: 1, marginTop: spacing.md },
  frontScrollContent: { paddingBottom: spacing.sm },
  note: { fontSize: 17, lineHeight: 26, color: colors.inkMid },
  notePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.ms,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  notePromptText: { fontSize: 15, color: colors.inkFaint },

  // Offset left rather than centred, as in the reference: the cutout reads as
  // a photo laid onto the card, not as a framed illustration.
  wellWrap: { alignItems: 'flex-start', marginTop: spacing.lg },
  // A sizing box only — no fill, no rounding, no clipping. The cutout is a
  // transparent PNG, so it should sit on the card the way a sticker sits on
  // a page; a tinted circle behind it reads as a photo frame and crops the
  // silhouette that the whole cutout pipeline exists to produce.
  well: {
    width: '82%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wellImage: { width: '100%', height: '100%' },

  promptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  prompt: { flex: 1, fontSize: 20, fontFamily: fonts.cozy, color: colors.inkDark },
  hintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 1,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.inkDark,
  },
  hintText: { fontSize: 14, fontFamily: fonts.cozy, color: colors.inkDark },

  // ── back ──
  backHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backMeta: { fontSize: 10, fontFamily: fonts.monoBold, color: colors.inkLight, letterSpacing: 1.5 },
  backScroll: { paddingTop: spacing.md, paddingBottom: spacing.md },

  field: { paddingBottom: spacing.md, marginBottom: spacing.md },
  fieldRuled: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  fieldHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontSize: 10,
    fontFamily: fonts.monoBold,
    color: colors.inkLight,
    letterSpacing: 1.5,
  },
  word: { fontSize: 38, lineHeight: 48, color: colors.inkDark },
  sayItRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  reading: { flex: 1, fontSize: 22, fontFamily: fonts.mono, color: colors.inkDark },
  sayItBtns: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  speakBtn: {
    width: 40, height: 40, borderRadius: radii.full,
    backgroundColor: colors.blushDeep,
    alignItems: 'center', justifyContent: 'center',
    ...shadows.card,
  },
  voiceBtn: {
    width: 36, height: 36, borderRadius: radii.full,
    backgroundColor: colors.sageLight,
    alignItems: 'center', justifyContent: 'center',
  },
  micBtn: {
    width: 40, height: 40, borderRadius: radii.full,
    backgroundColor: colors.terraLight,
    borderWidth: 1.5,
    borderColor: colors.terra,
    alignItems: 'center', justifyContent: 'center',
  },
  micBtnLive: { backgroundColor: colors.error, borderColor: colors.error },
  micHint: { fontSize: 11, color: colors.inkFaint, marginTop: spacing.sm },
  means: { fontSize: 20, color: colors.inkDark, lineHeight: 27 },
  sentence: { fontSize: 19, lineHeight: 30, color: colors.inkDark },
  sentenceWord: { fontFamily: fonts.cozy },
  sentenceTranslation: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.inkLight,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },

  // ── shared footer ──
  perforation: {
    borderTopWidth: 1.5,
    borderTopColor: colors.border,
    borderStyle: 'dashed',
    marginHorizontal: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.sky,
  },
  footerThumb: {
    width: 42, height: 42, borderRadius: radii.full,
    backgroundColor: colors.sand,
    overflow: 'hidden',
  },
  footerField: { flex: 1, gap: 2 },
  footerFieldRight: { alignItems: 'flex-end' },
  footerLabel: { fontSize: 9.5, fontFamily: fonts.monoBold, color: colors.inkLight, letterSpacing: 1.4 },
  footerValue: { fontSize: 14, fontFamily: fonts.cozy, color: colors.inkDark },
  footerWhen: { fontSize: 12, fontFamily: fonts.mono, color: colors.inkDark, letterSpacing: 0.5 },

  browseFooter: { alignItems: 'center', gap: spacing.sm },
  // Deliberately quiet and text-led, sitting apart from the top bar's red
  // trash: same screen, two removals, and only the loud one is permanent.
  unpinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.ms,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: '90%',
  },
  unpinText: { fontSize: 12, fontWeight: '700', color: colors.inkLight, flexShrink: 1 },
  flipHint: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.inkFaint,
    paddingTop: spacing.ms,
    paddingBottom: spacing.xs,
  },
  progress: { fontSize: 12, fontFamily: fonts.monoBold, color: colors.inkLight, letterSpacing: 1.2 },

  gradeRow: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.ms },
  gradeBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingVertical: spacing.ms,
    borderRadius: radii.md,
    borderWidth: 1.5,
  },
  toneAgain: { backgroundColor: colors.error, borderColor: colors.error },
  toneHard:  { backgroundColor: colors.card, borderColor: colors.border },
  toneGood:  { backgroundColor: colors.terraLight, borderColor: colors.terra },
  toneEasy:  { backgroundColor: colors.successLight, borderColor: colors.success },
  gradeLabel: { fontSize: 14, fontFamily: fonts.cozy, color: colors.inkDark },
  gradeLabelOnDark: { color: colors.white },
  gradeWhen: { fontSize: 10, fontFamily: fonts.mono, color: colors.inkLight },
  gradeWhenOnDark: { color: colors.white, opacity: 0.85 },
});
