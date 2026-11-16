import { useEffect, useRef, useState } from 'react';
import { useMotion } from '@/lib/motion';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Image, Keyboard,
} from 'react-native';
import { fonts, radii, spacing } from '@/constants/theme';
import { Language } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/friendlyError';
import { haptic } from '@/lib/haptics';
import { speak } from '@/lib/speech';
import { CardBack, type CardContent } from '@/components/CardView';
import Button from '@/components/ui/Button';
import InlineError from '@/components/ui/InlineError';
import { useTheme, useThemedStyles, type Theme } from '@/hooks/useTheme';

/** A cutout the scan already made and uploaded, carried into a typed card. */
export interface CarriedCutout { imagePath: string; thumbPath: string | null }

// A second tap inside this window is the same tap (a double-tap, or Return after
// the button). A lookup is a billed AI call, so the lock is a leading debounce on
// the submit, not a trailing one on the keystrokes: nothing fires while typing.
const SUBMIT_LOCK_MS = 700;

/**
 * Type a word, phrase or idiom (English or the target language) and get a
 * full card from create-card. Preview first, save on Add, the same two steps as
 * a scan. After a failed scan it opens with the scan's cutout carried over, so
 * the sticker is kept and only the word is typed.
 */
export default function TypeWordSheet({
  visible, language, userId, cutout, onClose, onAdded,
}: {
  visible: boolean;
  language: Language;
  userId: string;
  cutout?: CarriedCutout | null;
  onClose: () => void;
  onAdded: (id?: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { reduced } = useMotion();
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving'>('idle');
  const [card, setCard] = useState<any>(null);
  const [error, setError] = useState('');
  const [cutoutUrl, setCutoutUrl] = useState<string | null>(null);
  // Only the latest lookup counts if the learner edits and resubmits (lesson 11).
  const ticket = useRef(0);
  const lastSubmit = useRef(0);

  useEffect(() => {
    let live = true;
    setCutoutUrl(null);
    if (!visible || !cutout) return;
    supabase.storage.from('sticker-images').createSignedUrl(cutout.imagePath, 3600)
      .then(({ data }) => { if (live && data) setCutoutUrl(data.signedUrl); });
    return () => { live = false; };
  }, [visible, cutout?.imagePath]);

  const reset = () => { ticket.current++; setText(''); setCard(null); setError(''); setStatus('idle'); };
  // Closing keeps what was typed (lesson 10: the OS swipe can't be vetoed, so
  // it must not cost anything); only a successful add clears it.
  const close = () => { ticket.current++; setStatus('idle'); onClose(); };

  const lookup = async () => {
    const word = text.trim();
    const now = Date.now();
    if (!word || status !== 'idle' || now - lastSubmit.current < SUBMIT_LOCK_MS) return;
    lastSubmit.current = now;
    const seq = ++ticket.current;
    setStatus('loading'); setError(''); setCard(null);
    try {
      const { data, error: err } = await supabase.functions.invoke('create-card', { body: { text: word, language } });
      if (err) throw err;
      if (data?.error) throw new Error(String(data.error));
      if (seq !== ticket.current) return;
      setCard(data);
      Keyboard.dismiss();
    } catch (e: any) {
      const message = await friendlyError(e, "Couldn't look that up. Try again.");
      if (seq !== ticket.current) return;
      setError(message);
      haptic.error();
    }
    if (seq === ticket.current) setStatus('idle');
  };

  const add = async () => {
    if (!card || status !== 'idle') return;
    setStatus('saving');
    const { data: inserted, error: insertError } = await supabase.from('stickers').insert({
      user_id: userId,
      language,
      ...(cutout ? {} : { source: 'text' }),
      word: String(card.word ?? text.trim()),
      translation: String(card.translation ?? ''),
      reading: String(card.reading ?? ''),
      part_of_speech: card.part_of_speech ?? null,
      forms: card.forms ?? null,
      sentence: String(card.sentence ?? ''),
      sentence_translation: String(card.sentence_translation ?? ''),
      sentence_insight: card.sentence_insight ?? null,
      sentence_gloss: card.gloss ?? null,
      grammar_key: card.grammar_key ?? null,
      category: card.category ?? 'Other',
      image_path: cutout?.imagePath ?? null,
      thumb_path: cutout?.thumbPath ?? null,
      discovered_at: new Date().toISOString(),
    }).select('id').single();
    if (insertError) {
      haptic.error();
      setError(await friendlyError(new Error(insertError.message), "Couldn't save. Try again."));
      setStatus('idle');
      return;
    }
    haptic.success();
    reset();
    onAdded(inserted?.id);
  };

  const content: CardContent | null = card ? {
    language,
    word: String(card.word ?? ''),
    reading: String(card.reading ?? ''),
    translation: String(card.translation ?? ''),
    part_of_speech: card.part_of_speech ?? null,
    sentence: String(card.sentence ?? ''),
    sentence_translation: String(card.sentence_translation ?? ''),
    sentence_gloss: card.gloss ?? null,
    sentence_insight: card.sentence_insight ?? null,
    forms: card.forms ?? null,
  } : null;

  const lookupDisabled = !card && !text.trim();

  return (
    <Modal visible={visible} animationType={reduced ? 'none' : 'slide'} presentationStyle="pageSheet" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.3}>Type a word</Text>
          <TouchableOpacity onPress={close} style={styles.cancelHit} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {cutout && (
            <View style={styles.cutoutWell}>
              {cutoutUrl
                ? <Image source={{ uri: cutoutUrl }} style={styles.cutout} resizeMode="contain" />
                : <ActivityIndicator color={colors.terraInk} />}
              <Text style={styles.cutoutNote}>Your sticker is saved. Type its word to finish the card.</Text>
            </View>
          )}
          <Text style={styles.label}>A word, phrase or idiom, in English or the language you&apos;re learning.</Text>
          <TextInput
            testID="type-word-input"
            style={styles.input}
            value={text}
            onChangeText={(t) => { setText(t); if (card) setCard(null); if (error) setError(''); }}
            placeholder="e.g. chat"
            placeholderTextColor={colors.inkLight}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            textContentType="none"
            returnKeyType="search"
            enablesReturnKeyAutomatically
            onSubmitEditing={lookup}
            editable={status === 'idle'}
            maxLength={120}
            accessibilityLabel="Word to look up"
          />
          {status === 'loading' && (
            <View style={styles.row} accessibilityLiveRegion="polite">
              <ActivityIndicator size="small" color={colors.terraInk} />
              <Text style={styles.note}>Writing your card…</Text>
            </View>
          )}
          {!!error && <InlineError message={error} onRetry={card ? add : lookup} />}
          {content && (
            <View style={styles.card} testID="type-word-preview">
              <CardBack card={content} variant="reveal" onSpeak={() => speak(content.word, language)} />
            </View>
          )}
        <Button
            testID={card ? 'type-word-add' : 'type-word-lookup'}
            label={card ? 'Add card' : 'Look up'}
            accessibilityLabel={card ? 'Add card' : 'Look up word'}
            onPress={card ? add : lookup}
            disabled={lookupDisabled}
            loading={status !== 'idle'}
          />
        </ScrollView>

      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = ({ colors, type, e1 }: Theme) => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.cream, padding: spacing.md, paddingTop: spacing.md, gap: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 },
  title: { ...type.h2 },
  cancelHit: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' },
  cancel: { fontSize: 17, fontFamily: fonts.display, color: colors.inkDark },
  body: { gap: spacing.ms, paddingBottom: spacing.md },
  label: { ...type.small },
  note: { ...type.small },
  input: {
    borderWidth: 1, borderColor: colors.ctl, borderRadius: radii.md, minHeight: 48,
    paddingHorizontal: spacing.md, fontSize: 18, fontFamily: fonts.text,
    color: colors.inkDark, backgroundColor: colors.card,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  card: { backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.lg, ...e1 },
  cutoutWell: { alignItems: 'center', gap: spacing.sm, backgroundColor: colors.sand, borderRadius: radii.md, padding: spacing.md },
  cutout: { width: 120, height: 120 },
  cutoutNote: { ...type.small, textAlign: 'center' },
});
