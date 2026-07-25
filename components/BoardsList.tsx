import { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Modal, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Plus, Trash2, LayoutGrid, X } from 'lucide-react-native';
import { Board } from '@/lib/types';
import { colors, shadows, radii, spacing, fonts } from '@/constants/theme';

interface BoardsListProps {
  boards: Board[];
  loading: boolean;
  onCreateBoard: (name: string) => Promise<{ error: Error | null }>;
  onDeleteBoard: (id: string) => Promise<{ error: Error | null }>;
  onOpenBoard: (board: Board) => void;
}

export default function BoardsList({ boards, loading, onCreateBoard, onDeleteBoard, onOpenBoard }: BoardsListProps) {
  const [creating, setCreating] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    const name = nameDraft.trim();
    if (!name || saving) return;
    setSaving(true);
    const { error } = await onCreateBoard(name);
    setSaving(false);
    if (error) {
      Alert.alert("Couldn't create board", error.message);
      return;
    }
    setNameDraft('');
    setCreating(false);
  };

  const handleDelete = (board: Board) => {
    Alert.alert('Delete Board', `Remove "${board.name}"? Your stickers stay in your collection.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const { error } = await onDeleteBoard(board.id);
          if (error) Alert.alert("Couldn't delete", error.message);
        },
      },
    ]);
  };

  if (loading) {
    return <ActivityIndicator style={styles.loader} color={colors.terra} size="large" />;
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.newButton} onPress={() => setCreating(true)}>
        <Plus size={16} color={colors.inkDark} />
        <Text style={styles.newButtonText}>New Board</Text>
      </TouchableOpacity>

      {boards.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No boards yet</Text>
          <Text style={styles.emptySubtitle}>Create a board and pick which stickers to arrange on it.</Text>
        </View>
      ) : (
        <FlatList
          data={boards}
          keyExtractor={b => b.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => onOpenBoard(item)} activeOpacity={0.85}>
              <View style={styles.cardIcon}>
                <LayoutGrid size={18} color={colors.terraDark} />
              </View>
              <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
              <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={10} style={styles.deleteBtn}>
                <Trash2 size={16} color={colors.error} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={creating} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          {/* "position" (not "padding") so only this card nudges up by however
              much the keyboard actually overlaps it — the backdrop and the
              card's own centering don't get recomputed/jump around. */}
          <KeyboardAvoidingView style={styles.modalKeyboardWrap} behavior={Platform.OS === 'ios' ? 'position' : undefined}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Board</Text>
                <TouchableOpacity onPress={() => { setCreating(false); setNameDraft(''); }} hitSlop={8}>
                  <X size={20} color={colors.inkDark} />
                </TouchableOpacity>
              </View>
              <TextInput
                value={nameDraft}
                onChangeText={setNameDraft}
                placeholder="e.g. Tokyo Trip"
                placeholderTextColor={colors.inkFaint}
                style={styles.modalInput}
                autoFocus
                onSubmitEditing={handleCreate}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={[styles.modalCreateButton, (!nameDraft.trim() || saving) && styles.modalCreateButtonDisabled]}
                onPress={handleCreate}
                disabled={!nameDraft.trim() || saving}
              >
                {saving
                  ? <ActivityIndicator size="small" color={colors.card} />
                  : <Text style={styles.modalCreateText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { flex: 1 },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'center',
    height: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.full,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.skyNight,
    marginBottom: spacing.md,
  },
  newButtonText: { fontSize: 13, fontFamily: fonts.cozyMedium, color: colors.inkDark },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    ...shadows.card,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.sageLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardName: { flex: 1, fontSize: 15, fontFamily: fonts.cozy, color: colors.inkDark },
  deleteBtn: { padding: 4 },
  empty: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.xxl },
  emptyTitle: { fontSize: 18, fontFamily: fonts.cozy, color: colors.inkDark, marginBottom: 8 },
  emptySubtitle: { fontSize: 13, color: colors.inkFaint, textAlign: 'center', lineHeight: 20 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  modalKeyboardWrap: { alignSelf: 'stretch' },
  modalCard: {
    alignSelf: 'stretch',
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: spacing.lg,
    ...shadows.card,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: { fontSize: 16, fontFamily: fonts.cozy, color: colors.inkDark },
  modalInput: {
    backgroundColor: colors.sky,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.inkDark,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  modalCreateButton: {
    backgroundColor: colors.terra,
    borderRadius: radii.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCreateButtonDisabled: { backgroundColor: colors.terraLight },
  modalCreateText: { color: colors.card, fontSize: 15, fontWeight: '700' },
});
