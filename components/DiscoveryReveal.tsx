import { useEffect, useState } from 'react';
import { Modal, View, Text, Image, TouchableOpacity, TextInput, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import { X, Bookmark, Pencil, Volume2, Lightbulb, Info, RotateCcw } from 'lucide-react-native';
import { StickerDraft } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { speak, stopSpeaking } from '@/lib/speech';
import { colors, spacing, shadows, fonts, wordFontFor, sentenceFontFor } from '@/constants/theme';

interface DiscoveryRevealProps {
  draft: StickerDraft | null;
  onAdd: () => void;
  onDiscard: () => void;
  // Reopens the box/lasso step on the same source photo, in case the cutout
  // didn't come out right — an alternative to discarding and starting over.
  onRetryExtraction: () => void;
  onEditWord: (newWord: string) => Promise<void>;
  onEditSentence: (newSentence: string) => Promise<void>;
  saving: boolean;
  retranslating: boolean;
  retranslatingSentence: boolean;
}

export default function DiscoveryReveal({ draft, onAdd, onDiscard, onRetryExtraction, onEditWord, onEditSentence, saving, retranslating, retranslatingSentence }: DiscoveryRevealProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [editingWord, setEditingWord] = useState(false);
  const [wordInput, setWordInput] = useState('');
  const [editingSentence, setEditingSentence] = useState(false);
  const [sentenceInput, setSentenceInput] = useState('');

  // The sticker was a flat 240×240, which is most of a short phone's body
  // before a single word has been laid out. Capped against both axes so it
  // gives way to the text rather than pushing it off screen.
  const { width: winW, height: winH } = useWindowDimensions();
  const stickerSize = Math.min(240, winW * 0.58, winH * 0.27);

  useEffect(() => {
    // Dry run: show the cutout the device just made, straight off local disk.
    // It was never uploaded, so there is nothing to sign — this is the whole
    // point of being able to evaluate the new pipeline without a deploy.
    if (draft?.localCutoutUri) {
      setImageUrl(draft.localCutoutUri);
      return;
    }
    if (!draft?.imagePath) return;
    supabase.storage.from('sticker-images')
      .createSignedUrl(draft.imagePath, 3600)
      .then(({ data }) => { if (data) setImageUrl(data.signedUrl); });
  }, [draft?.imagePath, draft?.localCutoutUri]);

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

  // onRequestClose is the Android back gesture. Routed to onDiscard, which
  // confirms first — this screen holds a result that cost ~10-20s and a real
  // API call to produce, so back must not silently bin it.
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onDiscard}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>New Discovery</Text>
          <TouchableOpacity
            onPress={onDiscard}
            style={styles.closeButton}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Discard this discovery"
          >
            <X size={24} color={colors.inkDark} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.bodyScroll}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Informational, not an error — shown inline rather than as a
              blocking Alert, which used to fire right as the ghost-cutout
              reveal animation started and interrupt it. */}
          {!!draft.bgIssue && (
            <View style={styles.bgIssueBanner}>
              <Info size={14} color={colors.sageDark} />
              <Text style={styles.bgIssueText}>{draft.bgIssue.message}</Text>
            </View>
          )}

          <View style={[styles.stickerFrame, { width: stickerSize, height: stickerSize }]}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
            ) : (
              <ActivityIndicator style={styles.image} color={colors.terra} />
            )}
          </View>

          <View style={styles.wordRow}>
            <Text
              style={[styles.word, { fontFamily: wordFontFor(draft.language) }, retranslating && styles.fadedWhileTranslating]}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.55}
            >
              {draft.word}
            </Text>
            <TouchableOpacity
              onPress={() => speak(draft.word, draft.language)}
              style={styles.speakButton}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Hear ${draft.word} pronounced`}
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
            <Text style={[styles.sentence, { fontFamily: sentenceFontFor(draft.language) }, retranslatingSentence && styles.fadedWhileTranslating]}>
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

          {!!draft.sentenceInsight && !retranslatingSentence && (
            <View style={styles.insightRow}>
              <Lightbulb size={12} color={colors.sageDark} />
              <Text style={styles.insightText}>{draft.sentenceInsight}</Text>
            </View>
          )}
        </ScrollView>

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

          <View style={styles.secondaryActions}>
            <TouchableOpacity style={styles.retryButton} onPress={onRetryExtraction} disabled={saving}>
              <RotateCcw size={13} color={colors.terra} />
              <Text style={styles.retryButtonText}>Retry Extraction</Text>
            </TouchableOpacity>
          </View>

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
                  style={[styles.floatingEditInput, { fontFamily: wordFontFor(draft.language) }]}
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
                  style={[styles.floatingEditInput, { fontFamily: wordFontFor(draft.language) }]}
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
  headerTitle: { fontSize: 18, fontFamily: fonts.display, color: colors.inkDark },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyScroll: { flex: 1 },
  // flexGrow + centered, on the *content container*: a short discovery still
  // sits centred exactly as before, while a long one (a word that wraps, a
  // three-line sentence, an insight) grows the content past the viewport and
  // scrolls. As a plain flex:1 View this centred and then overflowed out of
  // both ends at once — RN doesn't clip — so the label collided with the
  // header while the sentence disappeared under the Add button.
  body: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  bgIssueBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: colors.sageLight,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 20,
    maxWidth: 300,
  },
  bgIssueText: { flex: 1, fontSize: 12, fontFamily: fonts.display, color: colors.sageDark, lineHeight: 16},
  stickerFrame: { marginBottom: 24 },
  image: { width: '100%', height: '100%' },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: 8,
    marginBottom: 6,
  },
  speakButton: { padding: 4 },
  // flexShrink lets a long word give ground to the speaker button instead of
  // shoving it to the screen edge; adjustsFontSizeToFit (see the Text) then
  // scales it down rather than wrapping the layout apart.
  // fontFamily from the render site — target-language headword.
  word: { flexShrink: 1, fontSize: 40, color: colors.inkDark, textAlign: 'center' },
  // Always a Latin romanization, never target script — the mono data role.
  reading: { fontSize: 18, fontFamily: fonts.mono, color: colors.inkMid, marginBottom: 10, textAlign: 'center' },
  fadedWhileTranslating: { opacity: 0.35 },
  translationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  translation: { fontSize: 13, fontFamily: fonts.monoBold, color: colors.terra, letterSpacing: 3, textAlign: 'center' },
  // fontFamily from the render site — target-language sentence.
  sentence: {
    fontSize: 15,
    color: colors.inkDark,
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
  sentenceTranslation: { fontSize: 12, fontFamily: fonts.text, color: colors.inkFaint, textAlign: 'center' },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    maxWidth: 280,
  },
  insightText: { flex: 1, fontSize: 12, fontFamily: fonts.text, color: colors.sageDark, lineHeight: 16 },
  actions: {
    paddingHorizontal: 32,
    paddingTop: spacing.ms,
    paddingBottom: spacing.lg,
    gap: 12,
    // Opaque and bordered so the scrolling content above reads as passing
    // behind a footer rather than bleeding into the buttons.
    backgroundColor: colors.sky,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
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
  // fontFamily from the render site — you are editing target-language text.
  floatingEditInput: {
    fontSize: 17,
    color: colors.inkDark,
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
  addButtonText: { color: colors.white, fontSize: 16, fontFamily: fonts.display, letterSpacing: 1 },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  retryButtonText: { color: colors.terra, fontSize: 13, fontFamily: fonts.display,},
  discardButton: { alignItems: 'center', paddingVertical: 12 },
  discardButtonText: { color: colors.inkFaint, fontSize: 14, fontFamily: fonts.display,},
});
