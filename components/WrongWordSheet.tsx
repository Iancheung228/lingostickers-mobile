import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import BottomSheet, { type BottomSheetHandle } from '@/components/BottomSheet';
import Button from '@/components/ui/Button';
import InlineError from '@/components/ui/InlineError';
import { friendlyError } from '@/lib/friendlyError';
import { fonts, radii, spacing, MIN_TAP } from '@/constants/theme';
import { useTheme, useThemedStyles, type Theme } from '@/hooks/useTheme';
import type { WordAlternative } from '@/lib/types';
import { MAX_HINT_CHARS, cleanHintInput, type Correction } from '@/lib/wordFix';

interface WrongWordSheetProps {
  /// Other words the cut-out could be (create-sticker's `alternatives`).
  alternatives: WordAlternative[];
  /// Re-asks the server about the same cutout. Throws on failure.
  onCorrect: (correction: Correction) => Promise<void>;
  /// The sheet is off screen; unmount it.
  onClosed: () => void;
}

// "Not a dog?" opens this. One question, two ways to answer it: tap what it
// probably is, or say what it is. Both end in a whole new card (word, reading,
// sentence and all) for the same cutout, so the word and the sentence under it
// can never disagree.
//
// Every exit is the sheet's own (scrim, drag, back, Cancel — lesson 8) and all
// of them go through requestClose. While a card is being made none of them
// leave: the request is already spent, and a card that arrives to a closed
// sheet is a card the learner never saw.
export default function WrongWordSheet({ alternatives, onCorrect, onClosed }: WrongWordSheetProps) {
  const { colors, type } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const sheetRef = useRef<BottomSheetHandle>(null);
  const [hint, setHint] = useState('');
  // Which control started the request: 'hint', or the chip's index.
  const [pending, setPending] = useState<'hint' | number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestClose = () => {
    if (pending != null) { sheetRef.current?.settle(); return; }
    sheetRef.current?.close();
  };

  const run = async (who: 'hint' | number, correction: Correction) => {
    if (pending != null) return;
    setPending(who);
    setError(null);
    try {
      await onCorrect(correction);
      sheetRef.current?.close();
    } catch (err) {
      setError(await friendlyError(err, "Couldn't change the word. Try again."));
    } finally {
      setPending(null);
    }
  };

  const cleaned = cleanHintInput(hint);
  const submitHint = () => { if (cleaned) run('hint', { hint: cleaned }); };
  const busy = pending != null;

  return (
    <BottomSheet
      ref={sheetRef}
      onRequestClose={requestClose}
      onClosed={onClosed}
      header={<Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={type.h2.maxFontSizeMultiplier}>What is it?</Text>}
    >
      {alternatives.length > 0 && (
        <View style={styles.block}>
          <Text style={styles.lead} maxFontSizeMultiplier={type.small.maxFontSizeMultiplier}>It could be one of these:</Text>
          <View style={styles.chips}>
            {alternatives.map((alt, i) => (
              <Pressable
                key={`${alt.word}-${i}`}
                testID={`wrong-word-alt-${i}`}
                disabled={busy}
                onPress={() => run(i, { chosen: alt })}
                style={({ pressed }) => [styles.chip, pressed && styles.chipPressed, busy && pending !== i && styles.chipDim]}
                accessibilityRole="button"
                accessibilityLabel={`${alt.word}, ${alt.translation}. Use this word`}
                accessibilityState={{ disabled: busy, busy: pending === i }}
              >
                {pending === i ? (
                  <ActivityIndicator color={colors.terraInk} />
                ) : (
                  <>
                    <Text style={styles.chipWord} numberOfLines={1} maxFontSizeMultiplier={type.body.maxFontSizeMultiplier}>{alt.word}</Text>
                    <Text style={styles.chipMeaning} numberOfLines={1} maxFontSizeMultiplier={type.small.maxFontSizeMultiplier}>{alt.translation}</Text>
                  </>
                )}
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View style={styles.block}>
        <Text style={styles.lead} maxFontSizeMultiplier={type.small.maxFontSizeMultiplier}>
          {alternatives.length ? 'Or tell us:' : 'Tell us what it is:'}
        </Text>
        <TextInput
          testID="wrong-word-input"
          style={styles.input}
          value={hint}
          onChangeText={setHint}
          placeholder="e.g. toy town"
          placeholderTextColor={colors.inkLight}
          maxLength={MAX_HINT_CHARS}
          editable={!busy}
          // A word or two, in either language: no suggestions, no autofill.
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          textContentType="none"
          returnKeyType="done"
          onSubmitEditing={submitHint}
          accessibilityLabel="What is it? English or the language you are learning"
        />
        <Text style={styles.help} maxFontSizeMultiplier={type.small.maxFontSizeMultiplier}>
          In English or the language you’re learning.
        </Text>
      </View>

      {!!error && <InlineError message={error} testID="wrong-word-error" />}

      <View style={styles.actions}>
        <Button
          label="Make this card"
          testID="wrong-word-submit"
          onPress={submitHint}
          disabled={!cleaned || busy}
          loading={pending === 'hint'}
        />
        <Button kind="tertiary" label="Cancel" testID="wrong-word-cancel" disabled={busy} onPress={requestClose} />
      </View>
    </BottomSheet>
  );
}

const makeStyles = ({ colors, type }: Theme) => StyleSheet.create({
  title: { ...type.h2, marginBottom: spacing.xs },
  block: { marginTop: spacing.md, gap: spacing.sm },
  lead: { ...type.small },
  // gap 8 and no hitSlop: neighbouring chips can never overlap (lesson 9).
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: MIN_TAP, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.ctl, backgroundColor: colors.card,
    maxWidth: '100%',
  },
  chipPressed: { backgroundColor: colors.terraLight },
  chipDim: { opacity: 0.5 },
  chipWord: { fontSize: 17, fontFamily: fonts.text, color: colors.inkDark },
  chipMeaning: { ...type.small },
  input: {
    minHeight: 48, paddingHorizontal: 16, borderRadius: radii.md, borderWidth: 2, borderColor: colors.ctl,
    backgroundColor: colors.sky, fontSize: 17, fontFamily: fonts.text, color: colors.inkDark,
  },
  help: { ...type.small },
  actions: { marginTop: spacing.md, gap: spacing.sm },
});
