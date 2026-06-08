import { useEffect, useState } from 'react';
import { Modal, View, Text, Image, TouchableOpacity, TextInput, StyleSheet, SafeAreaView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { X, Bookmark, Pencil } from 'lucide-react-native';
import { StickerDraft } from '@/lib/types';
import { supabase } from '@/lib/supabase';

interface DiscoveryRevealProps {
  draft: StickerDraft | null;
  onAdd: () => void;
  onDiscard: () => void;
  onEditWord: (newWord: string) => Promise<void>;
  saving: boolean;
  retranslating: boolean;
}

export default function DiscoveryReveal({ draft, onAdd, onDiscard, onEditWord, saving, retranslating }: DiscoveryRevealProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [editingWord, setEditingWord] = useState(false);
  const [wordInput, setWordInput] = useState('');

  useEffect(() => {
    if (!draft?.imagePath) return;
    supabase.storage.from('sticker-images')
      .createSignedUrl(draft.imagePath, 3600)
      .then(({ data }) => { if (data) setImageUrl(data.signedUrl); });
  }, [draft?.imagePath]);

  // A fresh discovery — drop any leftover edit state from the previous one.
  useEffect(() => {
    setEditingWord(false);
  }, [draft?.imagePath]);

  if (!draft) return null;

  const beginEditingWord = () => {
    setWordInput(draft.translation);
    setEditingWord(true);
  };

  const confirmEditingWord = () => {
    const trimmed = wordInput.trim();
    setEditingWord(false);
    if (!trimmed || trimmed.toLowerCase() === draft.translation.toLowerCase()) return;
    onEditWord(trimmed).catch((err: any) => {
      Alert.alert('Translation failed', err?.message ?? 'Could not update the translation. Please try again.');
    });
  };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>New Discovery</Text>
          <TouchableOpacity onPress={onDiscard} style={styles.closeButton} disabled={saving}>
            <X size={24} color="#1A1A2E" />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <Text style={styles.discoveredLabel}>NEW DISCOVERY FOUND</Text>

          <View style={styles.stickerFrame}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
            ) : (
              <ActivityIndicator style={styles.image} color="#A7D7C5" />
            )}
          </View>

          <Text style={[styles.frenchWord, retranslating && styles.fadedWhileTranslating]}>{draft.name}</Text>
          <Text style={[styles.pronunciation, retranslating && styles.fadedWhileTranslating]}>{draft.pronunciation}</Text>

          {editingWord ? (
            <TextInput
              style={styles.translationInput}
              value={wordInput}
              onChangeText={setWordInput}
              autoFocus
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={confirmEditingWord}
              onBlur={() => setEditingWord(false)}
            />
          ) : (
            <TouchableOpacity
              style={styles.translationRow}
              onPress={beginEditingWord}
              disabled={retranslating}
              hitSlop={8}
            >
              {retranslating ? (
                <ActivityIndicator size="small" color="#A7D7C5" />
              ) : (
                <>
                  <Text style={styles.translation}>{draft.translation?.toUpperCase() ?? ''}</Text>
                  <Pencil size={12} color="#A7D7C5" />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.addButton} onPress={onAdd} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Bookmark size={20} color="#fff" />
                <Text style={styles.addButtonText}>Add to Collection</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.discardButton} onPress={onDiscard} disabled={saving}>
            <Text style={styles.discardButtonText}>Discard</Text>
          </TouchableOpacity>
        </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F0E8' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A2E' },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  discoveredLabel: {
    fontSize: 10,
    letterSpacing: 3,
    color: '#9E9E9E',
    fontWeight: '700',
    marginBottom: 24,
  },
  stickerFrame: {
    width: 240,
    height: 240,
    marginBottom: 28,
  },
  image: { width: '100%', height: '100%' },
  frenchWord: { fontSize: 40, fontWeight: '800', color: '#1A1A2E', textAlign: 'center', marginBottom: 6 },
  pronunciation: { fontSize: 18, color: '#6B7280', fontStyle: 'italic', marginBottom: 10, textAlign: 'center' },
  fadedWhileTranslating: { opacity: 0.35 },
  translationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  translation: { fontSize: 13, color: '#A7D7C5', fontWeight: '800', letterSpacing: 3, textAlign: 'center' },
  translationInput: {
    fontSize: 20,
    color: '#1A1A2E',
    fontWeight: '700',
    textAlign: 'center',
    minWidth: 200,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#A7D7C5',
    backgroundColor: '#fff',
  },
  actions: { paddingHorizontal: 32, paddingBottom: 32, gap: 12 },
  addButton: {
    backgroundColor: '#A7D7C5',
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#A7D7C5',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  discardButton: { alignItems: 'center', paddingVertical: 12 },
  discardButtonText: { color: '#9E9E9E', fontSize: 14, fontWeight: '600' },
});
