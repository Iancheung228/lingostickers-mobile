import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Plus } from 'lucide-react-native';
import { colors, shadows, radii, spacing, fonts } from '@/constants/theme';

interface CreateBoardCardProps {
  onCreate: (name: string) => Promise<{ error: Error | null }>;
}

// The last page in the Wall tab's board carousel — swiping past every real
// board lands here, so making a new one is just "keep swiping" rather than
// a separate screen or modal.
export default function CreateBoardCard({ onCreate }: CreateBoardCardProps) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

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
    setName('');
  };

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Plus size={22} color={colors.inkDark} />
        </View>
        <Text style={styles.title}>New Board</Text>
        <Text style={styles.subtitle}>Give it a name, then pick stickers to pin on it.</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Tokyo Trip"
          placeholderTextColor={colors.inkFaint}
          style={styles.input}
          onSubmitEditing={handleCreate}
          returnKeyType="done"
        />
        <TouchableOpacity
          style={[styles.createButton, (!name.trim() || saving) && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={!name.trim() || saving}
        >
          {saving
            ? <ActivityIndicator size="small" color={colors.card} />
            : <Text style={styles.createButtonText}>Create Board</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  card: {
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: spacing.xl,
    ...shadows.card,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: radii.full,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { fontSize: 18, fontFamily: fonts.cozy, color: colors.inkDark, marginBottom: 6 },
  subtitle: { fontSize: 13, color: colors.inkFaint, textAlign: 'center', lineHeight: 20, marginBottom: spacing.lg },
  input: {
    alignSelf: 'stretch',
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
  createButton: {
    alignSelf: 'stretch',
    backgroundColor: colors.terra,
    borderRadius: radii.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  createButtonDisabled: { backgroundColor: colors.terraLight },
  createButtonText: { color: colors.card, fontSize: 15, fontWeight: '700' },
});
