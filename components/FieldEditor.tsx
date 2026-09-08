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
}

export interface EditorSpec {
  title: string;
  subtitle?: string;
  inputs: EditableInput[];
  /// An optional opt-in shown under the inputs — used by the meaning field to
  /// offer re-deriving everything downstream of it.
  regenerate?: { label: string; hint: string };
}

interface FieldEditorProps {
  /// Null when closed. Carrying the whole spec rather than an open flag means
  /// the sheet can never reopen onto the previous field's draft.
  spec: EditorSpec | null;
  saving?: boolean;
  onCancel: () => void;
  onSave: (values: Record<string, string>, regenerate: boolean) => void;
}

interface Draft {
  /// Which spec this draft belongs to. Comparing it against the live spec is
  /// what re-seeds the form when a different field is opened.
  key: string;
  values: Record<string, string>;
  regenerate: boolean;
}

/// Identity won't do: one caller builds its spec inline in JSX, so the object
/// is new on every render even though the field being edited hasn't changed.
const keyOf = (spec: EditorSpec | null) =>
  spec ? spec.title + spec.inputs.map(i => i.key).join(',') : '';

const draftFor = (spec: EditorSpec, key: string): Draft => ({
  key,
  values: Object.fromEntries(spec.inputs.map(i => [i.key, i.value])),
  regenerate: false,
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

  const [draft, setDraft] = useState<Draft>(() => spec ? draftFor(spec, keyOf(spec)) : { key: '', values: {}, regenerate: false });
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

  if (!live) return null;
  const values = draft.key === specKey ? draft.values : {};

  const trimmed = () =>
    Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()]));

  const edited = draft.key === specKey
    && (draft.regenerate || live.inputs.some(i => (values[i.key] ?? '') !== i.value));

  const handleSave = () => {
    if (saving) return;
    onSave(trimmed(), draft.regenerate);
  };

  // The single gate every exit passes through — scrim tap, drag-down, Android
  // back, VoiceOver escape and the Cancel button — so which one you reach for
  // never changes what happens to your edits.
  const requestClose = () => {
    if (saving) { sheet.current?.settle(); return; }
    if (!edited) { sheet.current?.close(); return; }
    sheet.current?.settle();
    Alert.alert(
      'Discard changes?',
      "What you typed here won't be saved.",
      [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => sheet.current?.close() },
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
      onClosed={() => { setLive(null); if (spec) onCancel(); }}
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

        {!!live.regenerate && (
          <TouchableOpacity
            style={styles.regenRow}
            onPress={() => setDraft(d => ({ ...d, regenerate: !d.regenerate }))}
            activeOpacity={0.75}
          >
            <View style={[styles.checkbox, draft.regenerate && styles.checkboxOn]}>
              {draft.regenerate && <Check size={13} color={colors.white} strokeWidth={3} />}
            </View>
            <View style={styles.regenText}>
              <Text style={styles.regenLabel}>{live.regenerate.label}</Text>
              <Text style={styles.regenHint}>{live.regenerate.hint}</Text>
            </View>
          </TouchableOpacity>
        )}
      </ScrollView>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={requestClose} disabled={saving}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving
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
