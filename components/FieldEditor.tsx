import { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Check } from 'lucide-react-native';
import { colors, radii, spacing, shadows, fonts } from '@/constants/theme';

export interface EditableInput {
  key: string;
  label?: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
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

// A sheet rather than inline inputs on the card. The card faces are
// absolutely-positioned, flipping, backface-hidden layers under a Pressable
// that flips on tap — a focused TextInput in there fights the keyboard for
// space and the flip for touches, and the card's fixed height can't grow to
// fit a longer sentence. A sheet sidesteps all three.
export default function FieldEditor({ spec, saving, onCancel, onSave }: FieldEditorProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [regenerate, setRegenerate] = useState(false);

  // Re-seeded when a different field is opened, not on every render, so
  // typing isn't overwritten by the prop it came from.
  const specKey = spec ? spec.title + spec.inputs.map(i => i.key).join(',') : null;
  useEffect(() => {
    if (!spec) return;
    setValues(Object.fromEntries(spec.inputs.map(i => [i.key, i.value])));
    setRegenerate(false);
  }, [specKey]);

  if (!spec) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>{spec.title}</Text>
            {!!spec.subtitle && <Text style={styles.subtitle}>{spec.subtitle}</Text>}

            {spec.inputs.map((input, i) => (
              <View key={input.key} style={styles.inputBlock}>
                {!!input.label && <Text style={styles.inputLabel}>{input.label}</Text>}
                <TextInput
                  autoFocus={i === 0}
                  multiline={input.multiline}
                  value={values[input.key] ?? ''}
                  onChangeText={t => setValues(v => ({ ...v, [input.key]: t }))}
                  placeholder={input.placeholder}
                  placeholderTextColor={colors.inkFaint}
                  style={[styles.input, input.multiline && styles.inputMultiline]}
                  textAlignVertical={input.multiline ? 'top' : 'center'}
                />
              </View>
            ))}

            {!!spec.regenerate && (
              <TouchableOpacity
                style={styles.regenRow}
                onPress={() => setRegenerate(r => !r)}
                activeOpacity={0.75}
              >
                <View style={[styles.checkbox, regenerate && styles.checkboxOn]}>
                  {regenerate && <Check size={13} color={colors.white} strokeWidth={3} />}
                </View>
                <View style={styles.regenText}>
                  <Text style={styles.regenLabel}>{spec.regenerate.label}</Text>
                  <Text style={styles.regenHint}>{spec.regenerate.hint}</Text>
                </View>
              </TouchableOpacity>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={saving}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={() => onSave(
                Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()])),
                regenerate
              )}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" color={colors.white} />
                : <Text style={styles.saveText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(43, 42, 40, 0.45)' },
  sheet: {
    maxHeight: '86%',
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.ms,
    paddingBottom: spacing.xl,
    ...shadows.card,
  },
  grabber: {
    alignSelf: 'center',
    width: 40, height: 4,
    borderRadius: radii.full,
    backgroundColor: colors.border,
    marginBottom: spacing.ms,
  },
  title: { fontSize: 20, fontFamily: fonts.cozy, color: colors.inkDark },
  subtitle: { fontSize: 13, color: colors.inkLight, lineHeight: 19, marginTop: 2 },

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
  regenLabel: { fontSize: 14, fontFamily: fonts.cozy, color: colors.inkDark },
  regenHint: { fontSize: 12, color: colors.inkLight, lineHeight: 17 },

  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  cancelBtn: {
    flex: 1, alignItems: 'center', paddingVertical: spacing.ms + 2,
    borderRadius: radii.full, borderWidth: 1.5, borderColor: colors.border,
  },
  cancelText: { fontSize: 15, fontFamily: fonts.cozy, color: colors.inkMid },
  saveBtn: {
    flex: 2, alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.ms + 2,
    borderRadius: radii.full, backgroundColor: colors.terra,
  },
  saveText: { fontSize: 15, fontFamily: fonts.cozy, color: colors.white },
});
