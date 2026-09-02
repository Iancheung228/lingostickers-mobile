import { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { colors, radii, spacing, shadows, fonts } from '@/constants/theme';

interface NewBoardSheetProps {
  visible: boolean;
  onCancel: () => void;
  onCreate: (name: string) => Promise<{ error: Error | null }>;
}

// Naming a board is a sheet now, not the carousel's trailing page. The rail
// below the canvas already shows every board plus a permanent "+", so the
// carousel no longer has to reserve a slide just to be reachable — and
// swiping past your last board no longer dead-ends on an empty form.
export default function NewBoardSheet({ visible, onCancel, onCreate }: NewBoardSheetProps) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  // Cleared on each open rather than on close, so a cancelled draft never
  // reappears the next time the sheet is summoned.
  useEffect(() => { if (visible) { setName(''); setSaving(false); } }, [visible]);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    const { error } = await onCreate(trimmed);
    setSaving(false);
    if (error) {
      Alert.alert("Couldn't create board", error.message);
      return;
    }
    onCancel();
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.title}>New board</Text>
          <Text style={styles.subtitle}>Give it a name — you&apos;ll pick stickers next.</Text>

          <TextInput
            autoFocus
            value={name}
            onChangeText={setName}
            placeholder="e.g. Tokyo Trip"
            placeholderTextColor={colors.inkFaint}
            style={styles.input}
            onSubmitEditing={handleCreate}
            returnKeyType="done"
          />

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={saving}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createBtn, (!name.trim() || saving) && styles.createBtnDisabled]}
              onPress={handleCreate}
              disabled={!name.trim() || saving}
            >
              {saving
                ? <ActivityIndicator size="small" color={colors.white} />
                : <Text style={styles.createText}>Create board</Text>}
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
  title: { fontSize: 20, fontFamily: fonts.display, color: colors.inkDark },
  subtitle: { fontSize: 13, fontFamily: fonts.text, color: colors.inkLight, lineHeight: 19, marginTop: 2 },
  input: { marginTop: spacing.md, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.sky, borderWidth: 1.5, borderColor: colors.borderLight, fontSize: 16, fontFamily: fonts.text, color: colors.inkMid, },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  cancelBtn: {
    flex: 1, alignItems: 'center', paddingVertical: spacing.ms + 2,
    borderRadius: radii.full, borderWidth: 1.5, borderColor: colors.border,
  },
  cancelText: { fontSize: 15, fontFamily: fonts.display, color: colors.inkMid },
  createBtn: {
    flex: 2, alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.ms + 2,
    borderRadius: radii.full, backgroundColor: colors.terra,
  },
  createBtnDisabled: { backgroundColor: colors.terraLight },
  createText: { fontSize: 15, fontFamily: fonts.display, color: colors.white },
});
