import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import InlineError from '@/components/ui/InlineError';
import { friendlyErrorSync } from '@/lib/friendlyError';
import { haptic } from '@/lib/haptics';
import BottomSheet, { BottomSheetHandle } from '@/components/BottomSheet';
import { radii, spacing, fonts } from '@/constants/theme';
import { useTheme, useThemedStyles, type Theme } from '@/hooks/useTheme';

interface NewBoardSheetProps {
  visible: boolean;
  onCancel: () => void;
  onCreate: (name: string) => Promise<{ error: Error | null }>;
}

// Naming a board is a sheet now, not the carousel's trailing page. 
export default function NewBoardSheet({ visible, onCancel, onCreate }: NewBoardSheetProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sheet = useRef<BottomSheetHandle>(null);

  // Cleared on each open rather than on close, so a cancelled draft never
  // reappears the next time the sheet is summoned.
  useEffect(() => { if (visible) { setName(''); setSaving(false); setError(null); } }, [visible]);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    const { error: createError } = await onCreate(trimmed);
    setSaving(false);
    if (createError) {
      haptic.error();
      setError(friendlyErrorSync(createError, "Couldn't create the board. Try again."));
      return;
    }
    haptic.success();
    sheet.current?.close();
  };

  // Same gate as the field editor: every exit — scrim tap, drag-down, back
  // button, Cancel — asks first if there's a name typed that would be lost.
  const requestClose = () => {
    if (saving) { sheet.current?.settle(); return; }
    if (!name.trim()) { sheet.current?.close(); return; }
    sheet.current?.settle();
    Alert.alert(
      'Discard this board?',
      "The name you typed won't be saved.",
      [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => sheet.current?.close() },
      ],
    );
  };

  if (!visible) return null;

  return (
    <BottomSheet
      ref={sheet}
      onRequestClose={requestClose}
      onClosed={onCancel}
      header={
        <>
          <Text style={styles.title}>New board</Text>
          <Text style={styles.subtitle}>Give it a name — you&apos;ll pick stickers next.</Text>
        </>
      }
    >
      <TextInput
        autoFocus
        value={name}
        onChangeText={(t) => { setName(t); if (error) setError(null); }}
        maxLength={40}
        placeholder="e.g. Tokyo Trip"
        placeholderTextColor={colors.inkLight}
        style={styles.input}
        onSubmitEditing={handleCreate}
        returnKeyType="done"
      />

      {error && <InlineError message={error} testID="new-board-error" />}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={requestClose} disabled={saving}>
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
    </BottomSheet>
  );
}

const makeStyles = ({ colors }: Theme) => StyleSheet.create({
  title: { fontSize: 20, fontFamily: fonts.display, color: colors.inkDark },
  subtitle: { fontSize: 13, fontFamily: fonts.text, color: colors.inkLight, lineHeight: 19, marginTop: 2 },
  input: { marginTop: spacing.md, marginBottom: spacing.sm, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.sky, borderWidth: 1, borderColor: colors.ctl, fontSize: 16, fontFamily: fonts.text, color: colors.inkMid, },
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
