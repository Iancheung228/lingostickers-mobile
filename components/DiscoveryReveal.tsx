import { useEffect, useState } from 'react';
import { Modal, View, Text, Image, TouchableOpacity, TextInput, StyleSheet, SafeAreaView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { X, Bookmark, Pencil, Volume2 } from 'lucide-react-native';
import { StickerDraft } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { speak, stopSpeaking } from '@/lib/speech';
import { colors, radii, spacing, fonts, shadows } from '@/constants/theme';

interface DiscoveryRevealProps {
  draft: StickerDraft | null;
  onAdd: () => void;
  onDiscard: () => void;
  onEditWord: (newWord: string) => Promise<void>;
  onEditSentence: (newSentence: string) => Promise<void>;
  saving: boolean;
  retranslating: boolean;
  retranslatingSentence: boolean;
}

export default function DiscoveryReveal({ draft, onAdd, onDiscard, onEditWord, onEditSentence, saving, retranslating, retranslatingSentence }: DiscoveryRevealProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [editingWord, setEditingWord] = useState(false);
  const [wordInput, setWordInput] = useState('');
  const [editingSentence, setEditingSentence] = useState(false);
  const [sentenceInput, setSentenceInput] = useState('');

  useEffect(() => {
    if (!draft?.imagePath) return;
    supabase.storage.from('sticker-images')
      .createSignedUrl(draft.imagePath, 3600)
      .then(({ data }) => { if (data) setImageUrl(data.signedUrl); });
  }, [draft?.imagePath]);

  // A fresh discovery — drop any leftover edit state from the previous one.
  useEffect(() => {
    setEditingWord(false);
    setEditingSentence(false);
  }, [draft?.imagePath]);

  // Stop any in-flight pronunciation when the discovery changes or the modal closes.
  useEffect(() => stopSpeaking, [draft?.imagePath]);

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

  const beginEditingSentence = () => {
    setSentenceInput(draft.sentenceTranslation);
    setEditingSentence(true);
  };

  const confirmEditingSentence = () => {
    const trimmed = sentenceInput.trim();
    setEditingSentence(false);
    if (!trimmed || trimmed.toLowerCase() === draft.sentenceTranslation.toLowerCase()) return;
    onEditSentence(trimmed).catch((err: any) => {
      Alert.alert('Translation failed', err?.message ?? 'Could not update the sentence. Please try again.');
    });
  };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>New Discovery</Text>
          <TouchableOpacity onPress={onDiscard} style={styles.closeButton} disabled={saving}>
            <X size={24} color={colors.inkDark} />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <Text style={styles.discoveredLabel}>NEW DISCOVERY FOUND</Text>

          <View style={styles.stickerFrame}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
            ) : (
              <ActivityIndicator style={styles.image} color={colors.terra} />
            )}
          </View>

          <View style={styles.wordRow}>
            <Text style={[styles.word, retranslating && styles.fadedWhileTranslating]}>{draft.word}</Text>
            <TouchableOpacity
              onPress={() => speak(draft.word, draft.language)}
              style={styles.speakButton}
              hitSlop={10}
            >
              <Volume2 size={20} color={colors.terra} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.reading, retranslating && styles.fadedWhileTranslating]}>{draft.reading}</Text>

          <TouchableOpacity
            style={styles.translationRow}
            onPress={beginEditingWord}
            disabled={retranslating || editingWord}
            hitSlop={8}
          >
            {retranslating ? (
              <ActivityIndicator size="small" color={colors.terra} />
            ) : (
              <>
                <Text style={styles.translation}>{draft.translation?.toUpperCase() ?? ''}</Text>
                <Pencil size={12} color={colors.terra} />
              </>
            )}
          </TouchableOpacity>

          {!!draft.sentence && (
            <Text style={[styles.sentence, retranslatingSentence && styles.fadedWhileTranslating]}>
              {draft.sentence}
            </Text>
          )}

          <TouchableOpacity
            style={styles.sentenceTranslationRow}
            onPress={beginEditingSentence}
            disabled={retranslatingSentence || editingSentence}
            hitSlop={8}
          >
            {retranslatingSentence ? (
              <ActivityIndicator size="small" color={colors.terra} />
            ) : (
              <>
                <Text style={styles.sentenceTranslation}>{draft.sentenceTranslation}</Text>
                <Pencil size={11} color={colors.terra} />
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.addButton} onPress={onAdd} disabled={saving}>
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Bookmark size={20} color={colors.white} />
                <Text style={styles.addButtonText}>Add to Collection</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.discardButton} onPress={onDiscard} disabled={saving}>
            <Text style={styles.discardButtonText}>Discard</Text>
          </TouchableOpacity>
        </View>

        {(editingWord || editingSentence) && (
          <KeyboardAvoidingView
            style={styles.floatingEditWrap}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            pointerEvents="box-none"
          >
            <View style={styles.floatingEditBar}>
              {editingWord ? (
                <TextInput
                  style={styles.floatingEditInput}
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
                <TextInput
                  style={styles.floatingEditInput}
                  value={sentenceInput}
                  onChangeText={setSentenceInput}
                  autoFocus
                  autoCapitalize="sentences"
                  returnKeyType="done"
                  onSubmitEditing={confirmEditingSentence}
                  onBlur={() => setEditingSentence(false)}
                />
              )}
            </View>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sky },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.inkDark },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  discoveredLabel: {
    fontSize: 10,
    letterSpacing: 3,
    color: colors.inkFaint,
    fontWeight: '700',
    marginBottom: 24,
  },
  stickerFrame: {
    width: 240,
    height: 240,
    marginBottom: 28,
  },
  image: { width: '100%', height: '100%' },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 6,
  },
  speakButton: { padding: 4 },
  word: { fontSize: 40, fontWeight: '800', color: colors.inkDark, textAlign: 'center' },
  reading: { fontSize: 18, color: colors.inkMid, fontStyle: 'italic', marginBottom: 10, textAlign: 'center' },
  fadedWhileTranslating: { opacity: 0.35 },
  translationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  translation: { fontSize: 13, color: colors.terra, fontWeight: '800', letterSpacing: 3, textAlign: 'center' },
  sentence: {
    fontSize: 15,
    color: colors.inkDark,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 20,
    paddingHorizontal: 8,
  },
  sentenceTranslationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  sentenceTranslation: {
    fontSize: 12,
    color: colors.inkFaint,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  actions: { paddingHorizontal: 32, paddingBottom: 32, gap: 12 },
  floatingEditWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  floatingEditBar: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    ...shadows.card,
  },
  floatingEditInput: {
    fontSize: 17,
    color: colors.inkDark,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.terra,
    backgroundColor: colors.sky,
  },
  addButton: {
    backgroundColor: colors.terra,
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: colors.terra,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  addButtonText: { color: colors.white, fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  discardButton: { alignItems: 'center', paddingVertical: 12 },
  discardButtonText: { color: colors.inkFaint, fontSize: 14, fontWeight: '600' },
});
