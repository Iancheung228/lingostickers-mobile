import { useRef, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, radii, spacing, fonts, wordFontFor } from '@/constants/theme';
import { Language } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { getFunctionErrorMessage } from '@/lib/functionError';

/**
 * Type a word, phrase or idiom (English or the target language) and get a
 * full card from create-card, with no photo. Preview first, save on Add —
 * the same two steps as a scan.
 */
export default function TypeWordSheet({
  visible, language, userId, onClose, onAdded,
}: {
  visible: boolean;
  language: Language;
  userId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving'>('idle');
  const [card, setCard] = useState<any>(null);
  const [error, setError] = useState('');
  // Only the latest lookup counts if the learner edits and resubmits.
  const ticket = useRef(0);

  const reset = () => { ticket.current++; setText(''); setCard(null); setError(''); setStatus('idle'); };
  const close = () => { reset(); onClose(); };

  const lookup = async () => {
    const word = text.trim();
    if (!word || status !== 'idle') return;
    const seq = ++ticket.current;
    setStatus('loading'); setError(''); setCard(null);
    try {
      const { data, error: err } = await supabase.functions.invoke('create-card', { body: { text: word, language } });
      if (err) throw new Error(await getFunctionErrorMessage(err));
      if (data?.error) throw new Error(String(data.error));
      if (seq !== ticket.current) return;
      setCard(data);
    } catch (e: any) {
      if (seq !== ticket.current) return;
      setError(e?.message ?? 'Something went wrong.');
    }
    if (seq === ticket.current) setStatus('idle');
  };

  const add = async () => {
    if (!card || status !== 'idle') return;
    setStatus('saving');
    const { error: insertError } = await supabase.from('stickers').insert({
      user_id: userId,
      language,
      source: 'text',
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
      image_path: null,
      discovered_at: new Date().toISOString(),
    });
    if (insertError) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(insertError.message);
      setStatus('idle');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    reset();
    onAdded();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">Type a word</Text>
          <TouchableOpacity onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={styles.link}>Cancel</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>A word, phrase or idiom, in English or the language you&apos;re learning.</Text>
        <TextInput
          testID="type-word-input"
          style={styles.input}
          value={text}
          onChangeText={(t) => { setText(t); if (card) setCard(null); }}
          placeholder="e.g. chat"
          placeholderTextColor={colors.inkLight}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={lookup}
          editable={status === 'idle'}
          maxLength={120}
          accessibilityLabel="Word to look up"
        />
        {status === 'loading' && (
          <View style={styles.row} accessibilityLiveRegion="polite">
            <ActivityIndicator size="small" color={colors.terra} />
            <Text style={styles.hint}>Writing your card…</Text>
          </View>
        )}
        {!!error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
        {card && (
          <View style={styles.card} testID="type-word-preview">
            <Text style={[styles.word, { fontFamily: wordFontFor(language) }]}>{String(card.word ?? '')}</Text>
            {!!card.reading && <Text style={styles.hint}>{String(card.reading)}</Text>}
            <Text style={styles.translation}>{String(card.translation ?? '')}</Text>
            {!!card.sentence && <Text style={styles.sentence}>{String(card.sentence)}</Text>}
            {!!card.sentence_translation && <Text style={styles.hint}>{String(card.sentence_translation)}</Text>}
          </View>
        )}
        <TouchableOpacity
          testID={card ? 'type-word-add' : 'type-word-lookup'}
          style={[styles.primary, (status !== 'idle' || (!card && !text.trim())) && styles.primaryOff]}
          onPress={card ? add : lookup}
          disabled={status !== 'idle' || (!card && !text.trim())}
          accessibilityRole="button"
          accessibilityLabel={card ? 'Add card' : 'Look up word'}
        >
          <Text style={styles.primaryText}>{card ? 'Add card' : 'Look up'}</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.cream, padding: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontFamily: fonts.display, color: colors.inkDark },
  link: { fontSize: 15, fontFamily: fonts.display, color: colors.terra },
  hint: { fontSize: 13, fontFamily: fonts.display, color: colors.inkLight },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radii.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontSize: 18,
    color: colors.inkDark, backgroundColor: colors.white,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  error: { fontSize: 14, color: colors.terra, fontFamily: fonts.display },
  card: {
    backgroundColor: colors.white, borderRadius: 16, padding: spacing.lg, gap: spacing.xs,
    borderWidth: 1, borderColor: colors.border,
  },
  word: { fontSize: 28, color: colors.inkDark },
  translation: { fontSize: 17, fontFamily: fonts.display, color: colors.inkMid },
  sentence: { fontSize: 16, color: colors.inkDark, marginTop: spacing.sm },
  primary: { backgroundColor: colors.terra, borderRadius: radii.full, paddingVertical: spacing.md, alignItems: 'center' },
  primaryOff: { opacity: 0.4 },
  primaryText: { color: colors.white, fontSize: 16, fontFamily: fonts.display },
});
