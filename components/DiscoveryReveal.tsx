import { useEffect, useRef, useState } from 'react';
import { useMotion } from '@/lib/motion';
import { Modal, View, Text, Image, TouchableOpacity, TextInput, StyleSheet, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { X, Info, Check } from 'lucide-react-native';
import { StickerDraft } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { speak, stopSpeaking } from '@/lib/speech';
import { colors, spacing, shadows, fonts, type, radii, stickerShadow } from '@/constants/theme';
import BottomSheet, { type BottomSheetHandle } from '@/components/BottomSheet';
import Button from '@/components/ui/Button';
import InlineError from '@/components/ui/InlineError';
import { useToast } from '@/components/ToastProvider';
import { friendlyError } from '@/lib/friendlyError';
import { CardBack, contentFromDraft } from '@/components/CardView';
import { useCoachMark } from '@/lib/coachMarks';
import SceneWords from '@/components/SceneWords';
import { SceneChip } from '@/lib/sceneCards';

interface DiscoveryRevealProps {
  draft: StickerDraft | null;
  onAdd: () => void;
  /// Shown above the Add button when saving failed. The draft stays.
  saveError?: string | null;
  onDiscard: () => void;
  // Reopens the box/lasso step on the same source photo, in case the cutout
  // didn't come out right — an alternative to discarding and starting over.
  onRetryExtraction: () => void;
  onEditWord: (newWord: string) => Promise<void>;
  onEditSentence: (newSentence: string) => Promise<void>;
  saving: boolean;
  retranslating: boolean;
  retranslatingSentence: boolean;
  /// The scan's scene photo (the small copy the vision model saw), for scene
  /// prompts. Null hides them.
  sceneBase64: string | null;
  sceneSelected: SceneChip[];
  onSceneSelected: (chips: SceneChip[]) => void;
}

export default function DiscoveryReveal({ draft, onAdd, saveError, onDiscard, onRetryExtraction, onEditWord, onEditSentence, saving, retranslating, retranslatingSentence, sceneBase64, sceneSelected, onSceneSelected }: DiscoveryRevealProps) {
  const { reduced } = useMotion();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const sheetRef = useRef<BottomSheetHandle>(null);
  const toast = useToast();
  const scrollRef = useRef<ScrollView>(null);
  // Set when scene chips arrive; the next content-size change (the chips
  // having laid out) scrolls them into view instead of leaving them under
  // the footer.
  const revealSceneRef = useRef(false);
  const teach = useCoachMark('reveal-prompt', !!draft);
  const [editingWord, setEditingWord] = useState(false);
  const [wordInput, setWordInput] = useState('');
  const [editingSentence, setEditingSentence] = useState(false);
  const [sentenceInput, setSentenceInput] = useState('');

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
    // Idempotent: the bar's tick and the scrim behind it can both resolve the
    // same edit, and a second call would fire a second translation request.
    if (!editingWord) return;
    const trimmed = wordInput.trim();
    setEditingWord(false);
    if (!trimmed || trimmed.toLowerCase() === draft.translation.toLowerCase()) return;
    onEditWord(trimmed).catch(async (err: any) => {
      toast.show({ kind: 'error', message: await friendlyError(err, "Couldn't update the meaning. Try again.") });
    });
  };

  const beginEditingSentence = () => {
    setSentenceInput(draft.sentenceTranslation);
    setEditingSentence(true);
  };

  const confirmEditingSentence = () => {
    if (!editingSentence) return;
    const trimmed = sentenceInput.trim();
    setEditingSentence(false);
    if (!trimmed || trimmed.toLowerCase() === draft.sentenceTranslation.toLowerCase()) return;
    onEditSentence(trimmed).catch(async (err: any) => {
      toast.show({ kind: 'error', message: await friendlyError(err, "Couldn't update the sentence. Try again.") });
    });
  };

  // What the bar's two buttons and the scrim behind it all route through, so
  // "finish this edit" means one thing no matter which of them you reach for.
  const confirmEdit = () => { confirmEditingWord(); confirmEditingSentence(); };
  const cancelEdit = () => { setEditingWord(false); setEditingSentence(false); };

  // Every way out (scrim, drag, Android back, VoiceOver escape, the Discard
  // button) is "Discard". There is no confirm (B-core 3): the parent holds the
  // draft in memory and offers an Undo toast. A save in flight can't be left.
  const requestClose = () => {
    if (saving) { sheetRef.current?.settle(); return; }
    sheetRef.current?.close();
  };
  const count = sceneSelected.length + 1;
  const addLabel = sceneSelected.length ? `Add ${count} cards` : 'Add to Collection';

  return (
    <BottomSheet ref={sheetRef} onRequestClose={requestClose} onClosed={onDiscard} maxHeight="92%">
      <ScrollView
        ref={scrollRef}
        onContentSizeChange={() => {
          if (!revealSceneRef.current) return;
          revealSceneRef.current = false;
          scrollRef.current?.scrollToEnd({ animated: !reduced });
        }}
        style={styles.bodyScroll}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!!draft.bgIssue && (
          <View style={styles.bgIssueBanner}>
            <Info size={14} color={colors.gold} />
            <Text style={styles.bgIssueText}>{draft.bgIssue.message}</Text>
          </View>
        )}

        <View style={styles.stickerWell}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
          ) : (
            <ActivityIndicator style={styles.image} color={colors.terra} />
          )}
        </View>

        {/* The one overline on this screen: it classifies the content. */}
        <Text style={styles.found} maxFontSizeMultiplier={type.overline.maxFontSizeMultiplier}>Found</Text>

        {/* The same answer face the study card and the card detail draw. */}
        <CardBack
          card={contentFromDraft(draft)}
          variant="reveal"
          onSpeak={() => speak(draft.word, draft.language)}
          onEdit={(target) => {
            if (target === 'meaning') beginEditingWord();
            else if (target === 'sentence') beginEditingSentence();
          }}
          editable={['meaning', 'sentence']}
          moreOpen={false}
          fading={{ word: retranslating, sentence: retranslatingSentence }}
        />

        {teach.visible && (
          <Text style={styles.teach} maxFontSizeMultiplier={type.small.maxFontSizeMultiplier}>
            You’ll see this photo and be asked the word.
          </Text>
        )}

        {!!sceneBase64 && (
          <SceneWords
            sceneBase64={sceneBase64}
            language={draft.language}
            mainWord={draft.word}
            selected={sceneSelected}
            onChangeSelected={onSceneSelected}
            disabled={saving}
            onAnswered={() => {
              revealSceneRef.current = true;
              setTimeout(() => scrollRef.current?.scrollToEnd({ animated: !reduced }), 60);
            }}
          />
        )}
      </ScrollView>

      <View style={styles.actions}>
        {!!saveError && <InlineError message={saveError} />}
        <Button
          label={addLabel}
          accessibilityLabel={addLabel}
          testID="reveal-add"
          loading={saving}
          onPress={() => { teach.dismiss(); onAdd(); }}
        />
        <View style={styles.secondaryActions}>
          <Button
            kind="tertiary"
            label={sceneBase64 ? 'Retry' : 'Retry Extraction'}
            testID="reveal-retry"
            disabled={saving}
            onPress={onRetryExtraction}
          />
          <Button
            kind="tertiary"
            label="Discard"
            testID="reveal-discard"
            accessibilityLabel="Discard this discovery"
            disabled={saving}
            onPress={requestClose}
            style={styles.discard}
          />
        </View>
      </View>

      {/* The edit bar. Nothing resolves an edit except the tick, the cross and
          tapping away (blur is not "done", lesson 10). It is its own Modal so it
          can sit above the keyboard over the whole screen, not inside the sheet. */}
      <Modal visible={editingWord || editingSentence} transparent animationType="fade" onRequestClose={cancelEdit}>
        <View style={StyleSheet.absoluteFill}>
          <Pressable
            style={styles.editScrim}
            onPress={confirmEdit}
            accessibilityRole="button"
            accessibilityLabel="Finish editing"
          />
          <KeyboardAvoidingView
            style={styles.floatingEditWrap}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            pointerEvents="box-none"
          >
            <View style={styles.floatingEditBar}>
              <TouchableOpacity
                style={styles.editBarBtn}
                onPress={cancelEdit}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Cancel this edit"
              >
                <X size={18} color={colors.inkLight} />
              </TouchableOpacity>

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
                />
              )}

              <TouchableOpacity
                style={[styles.editBarBtn, styles.editBarConfirm]}
                onPress={confirmEdit}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Apply this edit"
              >
                <Check size={18} color={colors.white} strokeWidth={3} />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  bodyScroll: { flexShrink: 1 },
  body: { paddingBottom: spacing.md },
  bgIssueBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: colors.goldTint, borderRadius: radii.sm,
    paddingVertical: 8, paddingHorizontal: 12, marginBottom: spacing.ms,
  },
  bgIssueText: { flex: 1, ...type.small, color: colors.gold },
  stickerWell: {
    height: 150, borderRadius: radii.md, backgroundColor: colors.sand,
    alignItems: 'center', justifyContent: 'center', padding: spacing.md,
  },
  image: { width: '100%', height: '100%', ...stickerShadow },
  found: { ...type.overline, marginTop: spacing.md, marginBottom: spacing.xs },
  teach: { ...type.small, textAlign: 'center', marginTop: spacing.md },
  actions: { paddingTop: spacing.sm, gap: spacing.sm },
  secondaryActions: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  discard: {},
  editScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.scrim },
  floatingEditWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  floatingEditBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16,
    backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.borderLight,
    ...shadows.card,
  },
  editBarBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.ctl,
  },
  editBarConfirm: { backgroundColor: colors.terra, borderColor: colors.terra },
  floatingEditInput: {
    flex: 1, fontSize: 17, fontFamily: fonts.text, color: colors.inkDark,
    textAlign: 'center', minHeight: 48, paddingHorizontal: 18,
    borderRadius: radii.md, borderWidth: 2, borderColor: colors.terra, backgroundColor: colors.sky,
  },
});
