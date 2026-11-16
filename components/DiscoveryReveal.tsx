import { useEffect, useRef, useState } from 'react';
import WrongWordSheet from '@/components/WrongWordSheet';
import { MAX_HINT_CHARS, cleanHintInput, wrongWordLabel, type Correction } from '@/lib/wordFix';
import { useMotion } from '@/lib/motion';
import { Modal, View, Text, Image, TouchableOpacity, TextInput, StyleSheet, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { X, Info, Check } from 'lucide-react-native';
import { StickerDraft } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { speak, stopSpeaking } from '@/lib/speech';
import { spacing, fonts, radii } from '@/constants/theme';
import BottomSheet, { type BottomSheetHandle } from '@/components/BottomSheet';
import Button from '@/components/ui/Button';
import InlineError from '@/components/ui/InlineError';
import { useToast } from '@/components/ToastProvider';
import { friendlyError } from '@/lib/friendlyError';
import { CardBack, contentFromDraft } from '@/components/CardView';
import { useCoachMark } from '@/lib/coachMarks';
import SceneWords from '@/components/SceneWords';
import { SceneChip } from '@/lib/sceneCards';
import { useTheme, useThemedStyles, type Theme } from '@/hooks/useTheme';
import BatchProgress from '@/components/BatchProgress';
import type { BatchProgress as BatchProgressData } from '@/lib/batchQueue';

interface DiscoveryRevealProps {
  draft: StickerDraft | null;
  onAdd: () => void;
  /// Shown above the Add button when saving failed. The draft stays.
  saveError?: string | null;
  onDiscard: () => void;
  // Reopens the box/lasso step on the same source photo, in case the cutout
  // didn't come out right — an alternative to discarding and starting over.
  onRetryExtraction: () => void;
  // Batch create shows each finished card through this same sheet. Retry makes
  // no sense there (the photo's selection is gone), Discard becomes "Skip this
  // card" (final: it removes the card's files), and every other way out — the
  // scrim, a drag, Android back — means "finish later": the sheet closes and the
  // cards stay queued, so a stray gesture never throws away work that already
  // cost an AI call (lesson 10).
  batch?: { label: string; progress: BatchProgressData; isLast: boolean; onSkip: () => void; onDismiss: () => void };
  // Fixes a wrong headword by re-asking about the same cutout: a typed meaning
  // (tapping the English), a tapped alternative, or "What is it?" text. Always
  // a whole new card, never just the word swapped (the old sentence would still
  // be about the old word). Throws on failure.
  onCorrect: (correction: Correction) => Promise<void>;
  /// False when this draft can't be re-asked (no stored close-up, or no .png
  /// cutout); the "Not a …?" control is then not drawn.
  canCorrect: boolean;
  onEditSentence: (newSentence: string) => Promise<void>;
  saving: boolean;
  retranslating: boolean;
  retranslatingSentence: boolean;
  /// The scan's scene photo (the small copy the vision model saw), for scene
  /// prompts. Null hides them.
  sceneBase64: string | null;
  sceneSelected: SceneChip[];
  /// Words the scene chips must not offer (batch: sibling cards from one photo).
  sceneAvoid?: string[];
  onSceneSelected: (chips: SceneChip[]) => void;
}

export default function DiscoveryReveal({ draft, onAdd, saveError, onDiscard, onRetryExtraction, batch, onCorrect, canCorrect, onEditSentence, saving, retranslating, retranslatingSentence, sceneBase64, sceneSelected, sceneAvoid, onSceneSelected }: DiscoveryRevealProps) {
  const { colors, type } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { reduced } = useMotion();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const sheetRef = useRef<BottomSheetHandle>(null);
  const toast = useToast();
  const scrollRef = useRef<ScrollView>(null);
  // Set when scene chips arrive; the next content-size change (the chips
  // having laid out) scrolls them into view instead of leaving them under
  // the footer.
  const revealSceneRef = useRef(false);
  const skipRef = useRef(false);
  const teach = useCoachMark('reveal-prompt', !!draft);
  const [editingWord, setEditingWord] = useState(false);
  const [wordInput, setWordInput] = useState('');
  const [editingSentence, setEditingSentence] = useState(false);
  const [sentenceInput, setSentenceInput] = useState('');
  const [wrongOpen, setWrongOpen] = useState(false);

  useEffect(() => {
    // Dry run: show the cutout the device just made, straight off local disk.
    // It was never uploaded, so there is nothing to sign — this is the whole
    // point of being able to evaluate the new pipeline without a deploy.
    if (draft?.localCutoutUri) {
      setImageUrl(draft.localCutoutUri);
      return;
    }
    // Cards can follow one another through this same instance (batch create), so
    // the previous card's image must not linger while the next one's signed URL
    // is fetched, nor win a race against it.
    setImageUrl(null);
    if (!draft?.imagePath) return;
    let current = true;
    supabase.storage.from('sticker-images')
      .createSignedUrl(draft.imagePath, 3600)
      .then(({ data }) => { if (current && data) setImageUrl(data.signedUrl); });
    return () => { current = false; };
  }, [draft?.imagePath, draft?.localCutoutUri]);

  // A fresh discovery — drop any leftover edit state from the previous one.
  useEffect(() => {
    setEditingWord(false);
    setEditingSentence(false);
    setWrongOpen(false);
    // Batch: the next card arrives in this same sheet, so start it at the top.
    scrollRef.current?.scrollTo({ y: 0, animated: false });
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
    const hint = cleanHintInput(trimmed);
    if (!hint) {
      toast.show({ kind: 'error', message: `Keep it under ${MAX_HINT_CHARS} characters.` });
      return;
    }
    onCorrect({ hint }).catch(async (err: any) => {
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
  // Batch: the Skip button and every other exit both slide the sheet away;
  // skipRef (declared with the other hooks, above the early return) says which
  // of the two it was when onClosed fires.
  const handleClosed = () => {
    if (!batch) { onDiscard(); return; }
    if (skipRef.current) { skipRef.current = false; batch.onSkip(); } else batch.onDismiss();
  };
  const count = sceneSelected.length + 1;
  const addLabel = batch
    ? `${sceneSelected.length ? `Add ${count} cards` : 'Add'} & ${batch.isLast ? 'finish' : 'next'}`
    : sceneSelected.length ? `Add ${count} cards` : 'Add to Collection';

  return (
    <BottomSheet ref={sheetRef} onRequestClose={requestClose} onClosed={handleClosed} maxHeight="92%">
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
        {!!batch && (
          <View style={styles.batchHead}>
            <BatchProgress progress={batch.progress} phase="review" />
            <Text style={styles.batchLabel} testID="reveal-batch-label" accessibilityRole="header">{`Card ${batch.label}`}</Text>
          </View>
        )}

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
            <ActivityIndicator style={styles.image} color={colors.terraInk} />
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
          fading={{ word: retranslating, sentence: retranslating || retranslatingSentence }}
          underHeadword={canCorrect ? (
            <Pressable
              testID="reveal-wrong-word"
              onPress={() => setWrongOpen(true)}
              disabled={saving || retranslating}
              style={({ pressed }) => [styles.wrongWord, pressed && styles.wrongWordPressed]}
              accessibilityRole="button"
              accessibilityLabel={`${wrongWordLabel(draft.translation)} Choose a different word`}
            >
              <Text style={styles.wrongWordText} maxFontSizeMultiplier={type.small.maxFontSizeMultiplier}>
                {wrongWordLabel(draft.translation)}
              </Text>
            </Pressable>
          ) : null}
        />

        {teach.visible && (
          <Text style={styles.teach} maxFontSizeMultiplier={type.small.maxFontSizeMultiplier}>
            You’ll see this photo and be asked the word.
          </Text>
        )}

        {!!sceneBase64 && (
          <SceneWords
            key={draft.imagePath}
            sceneBase64={sceneBase64}
            language={draft.language}
            mainWord={draft.word}
            avoid={sceneAvoid}
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
          {!batch && (
            <Button
              kind="tertiary"
              label={sceneBase64 ? 'Retry' : 'Retry Extraction'}
              testID="reveal-retry"
              disabled={saving}
              onPress={onRetryExtraction}
            />
          )}
          <Button
            kind="tertiary"
            label={batch ? 'Skip this card' : 'Discard'}
            testID="reveal-discard"
            accessibilityLabel={batch ? 'Skip this card' : 'Discard this discovery'}
            disabled={saving}
            onPress={() => { if (batch) skipRef.current = true; requestClose(); }}
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
                  maxLength={MAX_HINT_CHARS}
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

      {wrongOpen && (
        <WrongWordSheet
          alternatives={draft.alternatives ?? []}
          onCorrect={onCorrect}
          onClosed={() => setWrongOpen(false)}
        />
      )}
    </BottomSheet>
  );
}

const makeStyles = ({ colors, type, stickerShadow, shadows }: Theme) => StyleSheet.create({
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
  // A text button, but drawn as one: 44pt tall, left-aligned under the meaning.
  // No hitSlop — the sentence below it is itself tappable (lesson 9).
  wrongWord: {
    alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center',
    paddingHorizontal: 6, marginLeft: -6, borderRadius: radii.sm,
  },
  wrongWordPressed: { backgroundColor: colors.sand },
  wrongWordText: { ...type.small, color: colors.terraInk, textDecorationLine: 'underline' },
  teach: { ...type.small, textAlign: 'center', marginTop: spacing.md },
  actions: { paddingTop: spacing.sm, gap: spacing.sm },
  secondaryActions: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  discard: {},
  batchHead: { alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  batchLabel: { ...type.small, textAlign: 'center' },
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
