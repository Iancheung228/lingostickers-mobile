import { createRef, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { Check } from 'lucide-react-native';
import BottomSheet, { BottomSheetHandle } from '@/components/BottomSheet';
import { colors, radii, spacing, fonts } from '@/constants/theme';

export interface EditableInput {
  key: string;
  label?: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  /// Face to type in. Set by the caller, because only the caller knows what
  /// the field holds: a headword and a sentence are target-language and need
  /// a face that has those characters, a reading is always Latin
  /// romanization, and a translation is English. Defaults to the text role.
  fontFamily?: string;
  maxLength?: number;
}

/// What a follow-up lookup derived from the edited input.
export interface Suggestion {
  /// Written into the row on save, if the learner keeps the suggestion.
  fields: Record<string, string>;
  /// The new headword, shown large, and its reading under it.
  title: string;
  detail?: string;
}

/// Fields that follow another one. When `from` changes and typing pauses,
/// `fetch` derives the rest of the card from it, and the sheet shows the
/// result before anything is saved, ticked by default. It used to be an
/// unticked box that applied blind on save: people changed the meaning and
/// were left with a word that no longer matched it.
export interface FollowSpec {
  from: string;
  fetch: (text: string) => Promise<Suggestion>;
  /// What the sheet says at each step. Written by the caller, who knows
  /// what follows what ("the Cantonese word", "the reading and meaning").
  copy: {
    /// "Finding the Cantonese word…"
    looking: string;
    /// "Change the Cantonese word to", above the suggestion.
    heading: string;
    /// "Couldn't find the Cantonese word"
    failed: string;
    /// Unticked: "Keeping 杯."
    kept: string;
    /// After a failure: "Saving keeps the word as 杯."
    failedKeep: string;
  };
  /// Face for the suggestion's title.
  fontFamily?: string;
  /// One line under a found suggestion, about what it does not change.
  note?: string;
  /// A reason not to look this text up at all (it is in the wrong language,
  /// say), shown in place of a suggestion. Null to look it up.
  skip?: (text: string) => string | null;
}

export interface EditorSpec {
  /// What is being edited, when the same field can be opened on different
  /// rows: two cards' meaning sheets share a title and inputs, not a draft.
  id?: string;
  title: string;
  subtitle?: string;
  inputs: EditableInput[];
  follow?: FollowSpec;
}

interface FieldEditorProps {
  /// Null when closed. Carrying the whole spec rather than an open flag means
  /// the sheet can never reopen onto the previous field's draft.
  spec: EditorSpec | null;
  saving?: boolean;
  onCancel: () => void;
  /// `follow` is the accepted suggestion's fields, or null for none.
  onSave: (values: Record<string, string>, follow: Record<string, string> | null) => void;
}

interface Draft {
  /// Which spec this draft belongs to. Comparing it against the live spec is
  /// what re-seeds the form when a different field is opened.
  key: string;
  values: Record<string, string>;
}

type FollowState =
  | { status: 'idle' }
  | { status: 'looking'; text: string }
  | { status: 'ready'; text: string; suggestion: Suggestion }
  | { status: 'failed'; text: string; message: string }
  | { status: 'skipped'; text: string; message: string };

/// Long enough that a lookup waits for the end of a word, not each letter:
/// "a kettle" then "kettle" should be one call, not two.
const FOLLOW_DEBOUNCE_MS = 900;
/// The server gives up at 30s; nobody holding a sheet open waits that long.
const FOLLOW_TIMEOUT_MS = 12_000;
/// A meaning, not a sentence. Longer text is not looked up.
const FOLLOW_MAX_WORDS = 6;

/// Identity won't do: one caller builds its spec inline in JSX, so the object
/// is new on every render even though the field being edited hasn't changed.
const keyOf = (spec: EditorSpec | null) =>
  spec ? `${spec.id ?? ''}|${spec.title}|${spec.inputs.map(i => i.key).join(',')}` : '';

const draftFor = (spec: EditorSpec, key: string): Draft => ({
  key,
  values: Object.fromEntries(spec.inputs.map(i => [i.key, i.value])),
});

// A sheet rather than inline inputs on the card. The card faces are
// absolutely-positioned, flipping, backface-hidden layers under a Pressable
// that flips on tap — a focused TextInput in there fights the keyboard for
// space and the flip for touches, and the card's fixed height can't grow to
// fit a longer sentence. A sheet sidesteps all three.
export default function FieldEditor({ spec, saving, onCancel, onSave }: FieldEditorProps) {
  // The sheet outlives the prop that opened it by exactly one exit animation.
  // A successful save clears `spec` from above; without a mirror to render
  // from, the sheet would blink out of existence on the save path while
  // gliding away on the cancel path — two different exits for the same act of
  // leaving, and the abrupt one on the more common route.
  const [live, setLive] = useState<EditorSpec | null>(spec);
  const specKey = keyOf(live);
  if (spec && keyOf(spec) !== specKey) setLive(spec);

  const [draft, setDraft] = useState<Draft>(() => spec ? draftFor(spec, keyOf(spec)) : { key: '', values: {} });
  const sheet = useRef<BottomSheetHandle>(null);

  // Re-seeded during render rather than in an effect, so the inputs are never
  // painted empty for a frame before the values arrive — which autoFocus made
  // visible as a cursor landing in a blank box that then filled itself in.
  if (live && draft.key !== specKey) setDraft(draftFor(live, specKey));

  // Closed from above rather than by a gesture: play the same exit.
  useEffect(() => { if (!spec && live) sheet.current?.close(); }, [spec, live]);

  // One ref per input, so the return key can walk the form.
  const inputRefs = useMemo(
    () => (live?.inputs ?? []).map(() => createRef<TextInput>()),
    [specKey],
  );

  // --- follow-up lookup ----------------------------------------------------
  // Debounced, and every lookup takes a ticket so a slow reply for "ket" can
  // never land on top of the one for "kettle" (docs/lessons.md §11). Replies
  // are cached for as long as the sheet is open: typing a word, changing it
  // and changing it back must not cost three calls against a daily quota.
  const followSpec = live?.follow;
  const followOriginal = followSpec
    ? (live!.inputs.find(i => i.key === followSpec.from)?.value ?? '').trim()
    : '';
  const followText = followSpec && draft.key === specKey
    ? (draft.values[followSpec.from] ?? '').trim()
    : '';
  const followWanted = !!followSpec && followText.length > 0 && followText !== followOriginal;
  const followSkip = !followWanted ? null
    : followText.split(/\s+/).length > FOLLOW_MAX_WORDS
      ? `That's too long to look up. ${followSpec!.copy.failedKeep}`
      : followSpec!.skip?.(followText) ?? null;

  const [follow, setFollow] = useState<FollowState>({ status: 'idle' });
  const [keepFollow, setKeepFollow] = useState(true);
  const [resolving, setResolving] = useState(false);
  const followSeq = useRef(0);
  const followTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const followCache = useRef(new Map<string, Suggestion>());
  const followPending = useRef<{ text: string; promise: Promise<Suggestion | null> } | null>(null);
  // Bumped when the learner cancels out of a save that is waiting on a lookup.
  const saveTicket = useRef(0);

  const lookup = (text: string): Promise<Suggestion | null> => {
    if (followPending.current?.text === text) return followPending.current.promise;
    const seq = ++followSeq.current;
    const cached = followCache.current.get(text);
    if (cached) {
      setFollow({ status: 'ready', text, suggestion: cached });
      return Promise.resolve(cached);
    }
    setFollow({ status: 'looking', text });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('That took too long.')), FOLLOW_TIMEOUT_MS);
    });
    const promise = Promise.race([followSpec!.fetch(text), timeout]).then(
      (suggestion) => {
        followCache.current.set(text, suggestion);
        if (seq === followSeq.current) {
          setFollow({ status: 'ready', text, suggestion });
          setKeepFollow(true);
        }
        return suggestion;
      },
      (err: unknown) => {
        // The reason, when there is one worth reading (a spent daily limit);
        // fetch() is expected to have made it human already.
        const message = err instanceof Error && err.message ? err.message : 'Something went wrong.';
        if (seq === followSeq.current) setFollow({ status: 'failed', text, message });
        return null;
      },
    ).finally(() => {
      clearTimeout(timer);
      if (followPending.current?.promise === promise) followPending.current = null;
    });
    followPending.current = { text, promise };
    return promise;
  };

  useEffect(() => {
    clearTimeout(followTimer.current);
    // Anything still in flight is about text that is no longer there. Without
    // this, its reply could land and show a word for the previous text.
    followSeq.current++;
    followPending.current = null;
    setKeepFollow(true);
    if (!followWanted) {
      setFollow({ status: 'idle' });
      return;
    }
    if (followSkip) {
      setFollow({ status: 'skipped', text: followText, message: followSkip });
      return;
    }
    const cached = followCache.current.get(followText);
    if (cached) {
      setFollow({ status: 'ready', text: followText, suggestion: cached });
      return;
    }
    // "Looking" shows at once, so the row answers the keystroke; the call
    // itself waits for a pause.
    setFollow({ status: 'looking', text: followText });
    followTimer.current = setTimeout(() => { lookup(followText); }, FOLLOW_DEBOUNCE_MS);
    return () => clearTimeout(followTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followText, followWanted, followSkip, specKey]);

  if (!live) return null;
  const values = draft.key === specKey ? draft.values : {};

  const trimmed = () =>
    Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()]));

  const edited = draft.key === specKey
    && live.inputs.some(i => (values[i.key] ?? '') !== i.value);

  const handleSave = async () => {
    if (saving || resolving) return;
    if (!followWanted || followSkip) { onSave(trimmed(), null); return; }

    // Saving mid-lookup waits for it rather than saving a meaning whose word
    // has not caught up — the whole point is that the two arrive together.
    let suggestion = follow.status === 'ready' && follow.text === followText ? follow.suggestion : null;
    if (!suggestion && !(follow.status === 'failed' && follow.text === followText)) {
      const ticket = ++saveTicket.current;
      clearTimeout(followTimer.current);
      setResolving(true);
      suggestion = await lookup(followText);
      if (ticket !== saveTicket.current) return; // cancelled while waiting
      setResolving(false);
      // A failure is now on screen, saying the word stays. Let it be read;
      // the next tap on Save saves the meaning alone.
      if (!suggestion) return;
    }
    onSave(trimmed(), suggestion && keepFollow ? suggestion.fields : null);
  };

  // The single gate every exit passes through — scrim tap, drag-down, Android
  // back, VoiceOver escape and the Cancel button — so which one you reach for
  // never changes what happens to your edits.
  const requestClose = () => {
    if (saving) { sheet.current?.settle(); return; }
    // Waiting on a lookup is not a commitment: leaving abandons the save.
    if (resolving) { saveTicket.current++; setResolving(false); }
    if (!edited) { sheet.current?.close(); return; }
    sheet.current?.settle();
    Alert.alert(
      'Discard changes?',
      "What you typed here won't be saved.",
      [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          // Discard means discard: reopening must not bring the text back, and
          // with it a paid lookup the learner never asked for. (A sheet the OS
          // closes keeps its draft — docs/lessons.md §10 — but this is not that.)
          onPress: () => { setDraft({ key: '', values: {} }); sheet.current?.close(); },
        },
      ],
    );
  };

  const setValue = (key: string, text: string) =>
    setDraft(d => ({ ...d, values: { ...d.values, [key]: text } }));

  return (
    <BottomSheet
      ref={sheet}
      onRequestClose={requestClose}
      // `spec` is already null when the parent was the one that closed us, so
      // a completed save doesn't also report itself as a cancel.
      onClosed={() => {
        setLive(null);
        followCache.current.clear();
        if (spec) onCancel();
      }}
      maxHeight="86%"
      header={
        <>
          <Text style={styles.title}>{live.title}</Text>
          {!!live.subtitle && <Text style={styles.subtitle}>{live.subtitle}</Text>}
        </>
      }
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        // A downward drag over the fields lowers the keyboard instead of doing
        // nothing, which is the same direction the sheet's own dismiss uses.
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {live.inputs.map((input, i) => {
          const isLast = i === live.inputs.length - 1;
          return (
          <View key={input.key} style={styles.inputBlock}>
            {!!input.label && <Text style={styles.inputLabel}>{input.label}</Text>}
            <TextInput
              ref={inputRefs[i]}
              autoFocus={i === 0}
              multiline={input.multiline}
              value={values[input.key] ?? ''}
              onChangeText={t => setValue(input.key, t)}
              placeholder={input.placeholder}
              placeholderTextColor={colors.inkFaint}
              maxLength={input.maxLength}
              // A multiline field keeps its newline; single-line fields hand
              // you to the next one, and the last one saves — so the keyboard
              // covering the buttons no longer means there's no way to commit.
              returnKeyType={input.multiline ? undefined : isLast ? 'done' : 'next'}
              submitBehavior={input.multiline ? 'newline' : isLast ? 'blurAndSubmit' : 'submit'}
              onSubmitEditing={input.multiline ? undefined : () => {
                if (isLast) handleSave();
                else inputRefs[i + 1]?.current?.focus();
              }}
              style={[
                styles.input,
                input.multiline && styles.inputMultiline,
                !!input.fontFamily && { fontFamily: input.fontFamily },
              ]}
              textAlignVertical={input.multiline ? 'top' : 'center'}
            />
          </View>
          );
        })}

        {!!followSpec && follow.status === 'looking' && (
          <View style={styles.regenRow} accessibilityLiveRegion="polite">
            <ActivityIndicator size="small" color={colors.inkLight} style={styles.followSpinner} />
            <View style={styles.regenText}>
              <Text style={styles.regenLabel}>{followSpec.copy.looking}</Text>
            </View>
          </View>
        )}

        {!!followSpec && follow.status === 'ready' && follow.text === followText && (
          <TouchableOpacity
            style={styles.regenRow}
            onPress={() => setKeepFollow(k => !k)}
            activeOpacity={0.75}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: keepFollow }}
            accessibilityLabel={keepFollow
              ? `${followSpec.copy.heading} ${follow.suggestion.title}`
              : `${followSpec.copy.kept} Double-tap to change it to ${follow.suggestion.title}`}
          >
            <View style={[styles.checkbox, keepFollow && styles.checkboxOn]}>
              {keepFollow && <Check size={13} color={colors.white} strokeWidth={3} />}
            </View>
            <View style={styles.regenText}>
              <Text style={styles.regenHint}>{followSpec.copy.heading}</Text>
              <Text style={[styles.followWord, !!followSpec.fontFamily && { fontFamily: followSpec.fontFamily }]}>
                {follow.suggestion.title}
              </Text>
              {!!follow.suggestion.detail && (
                <Text style={styles.followDetail}>{follow.suggestion.detail}</Text>
              )}
              <Text style={styles.regenHint}>
                {keepFollow ? followSpec.note : followSpec.copy.kept}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {!!followSpec && follow.status === 'failed' && follow.text === followText && (
          <View style={styles.regenRow} accessibilityLiveRegion="polite">
            <View style={styles.regenText}>
              <Text style={styles.regenLabel}>{followSpec.copy.failed}</Text>
              <Text style={styles.regenHint}>
                {follow.message} {followSpec.copy.failedKeep}
              </Text>
              <TouchableOpacity
                onPress={() => { lookup(followText); }}
                hitSlop={{ top: 10, bottom: 10, left: 0, right: 16 }}
                accessibilityRole="button"
              >
                <Text style={styles.followRetry}>Try again</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!!followSpec && follow.status === 'skipped' && follow.text === followText && (
          <View style={styles.regenRow} accessibilityLiveRegion="polite">
            <View style={styles.regenText}>
              <Text style={styles.regenHint}>{follow.message}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={requestClose} disabled={saving}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving || resolving}>
          {saving || resolving
            ? <ActivityIndicator size="small" color={colors.white} />
            : <Text style={styles.saveText}>Save</Text>}
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontFamily: fonts.display, color: colors.inkDark },
  subtitle: { fontSize: 13, fontFamily: fonts.text, color: colors.inkLight, lineHeight: 19, marginTop: 2 },

  inputBlock: { marginTop: spacing.md, gap: spacing.xs },
  inputLabel: {
    fontSize: 10, fontFamily: fonts.monoBold, color: colors.inkLight, letterSpacing: 1.4,
  },
  input: {
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.sky,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    fontSize: 16,
    fontFamily: fonts.text,
    lineHeight: 22,
    color: colors.inkMid,
  },
  inputMultiline: { minHeight: 110, lineHeight: 24 },

  regenRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.ms,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.sand,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: radii.xs,
    borderWidth: 1.5, borderColor: colors.inkLight,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
  },
  checkboxOn: { backgroundColor: colors.terra, borderColor: colors.terra },
  regenText: { flex: 1, gap: 2 },
  regenLabel: { fontSize: 14, fontFamily: fonts.display, color: colors.inkDark },
  regenHint: { fontSize: 12, fontFamily: fonts.text, color: colors.inkLight, lineHeight: 17 },
  followSpinner: { width: 22, height: 22 },
  followWord: { fontSize: 22, fontFamily: fonts.display, color: colors.inkDark, marginTop: 2 },
  scrollContent: { paddingBottom: spacing.md },
  followRetry: { fontSize: 13, fontFamily: fonts.display, color: colors.terra, marginTop: spacing.xs },
  followDetail: { fontSize: 13, fontFamily: fonts.mono, color: colors.inkMid, marginBottom: 2 },

  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  cancelBtn: {
    flex: 1, alignItems: 'center', paddingVertical: spacing.ms + 2,
    borderRadius: radii.full, borderWidth: 1.5, borderColor: colors.border,
  },
  cancelText: { fontSize: 15, fontFamily: fonts.display, color: colors.inkMid },
  saveBtn: {
    flex: 2, alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.ms + 2,
    borderRadius: radii.full, backgroundColor: colors.terra,
  },
  saveText: { fontSize: 15, fontFamily: fonts.display, color: colors.white },
});
