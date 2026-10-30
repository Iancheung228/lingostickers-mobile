import { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { colors, radii, spacing, fonts, wordFontFor } from '@/constants/theme';
import { Language } from '@/lib/types';
import { SCENE_PROMPTS, ScenePromptId, SceneChip, fetchSceneWords } from '@/lib/sceneCards';

/**
 * "More from this photo": ask the scan's photo another question and pick
 * extra words from the answer. A scan teaches one noun. This is where the
 * verbs, adjectives and idioms come from.
 *
 * Asking costs one short call (~2s, one photo prompt from the daily
 * allowance). Picking costs nothing until Add; the parent turns the chosen
 * chips into cards then.
 */
export default function SceneWords({
  sceneBase64, language, mainWord, selected, onChangeSelected, disabled, onAnswered,
}: {
  sceneBase64: string;
  language: Language;
  /// The scanned word, so a prompt never offers it back.
  mainWord: string;
  selected: SceneChip[];
  onChangeSelected: (chips: SceneChip[]) => void;
  disabled?: boolean;
  /// Something new is showing (chips, a message). The section sits at the
  /// bottom of a scroll view under a fixed footer, so the parent scrolls to it.
  onAnswered?: () => void;
}) {
  const [active, setActive] = useState<ScenePromptId | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'failed'>('idle');
  const [message, setMessage] = useState('');
  // Per prompt, so tapping back to one already asked shows its chips again
  // for free instead of asking (and paying) twice.
  const [answers, setAnswers] = useState<Partial<Record<ScenePromptId, SceneChip[]>>>({});
  // The learner can tap another prompt mid-request; only the latest counts.
  const ticket = useRef(0);

  const ask = async (id: ScenePromptId) => {
    Haptics.selectionAsync();
    setActive(id);
    if (answers[id]) { setStatus('done'); onAnswered?.(); return; }
    const seq = ++ticket.current;
    setStatus('loading');
    try {
      // Everything already on screen is "had", so prompts don't repeat words.
      const seen = Object.values(answers).flat().map((c) => c!.word);
      const chips = await fetchSceneWords(sceneBase64, id, language, [mainWord, ...seen]);
      if (seq !== ticket.current) return;
      setAnswers((a) => ({ ...a, [id]: chips }));
      setStatus('done');
      onAnswered?.();
    } catch (err: any) {
      if (seq !== ticket.current) return;
      setMessage(err?.message ?? 'Something went wrong.');
      setStatus('failed');
      onAnswered?.();
    }
  };

  const isSelected = (chip: SceneChip) => selected.some((c) => c.word === chip.word);
  const toggle = (chip: SceneChip) => {
    Haptics.selectionAsync();
    onChangeSelected(isSelected(chip) ? selected.filter((c) => c.word !== chip.word) : [...selected, chip]);
  };

  const chips = active ? answers[active] : undefined;

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>MORE FROM THIS PHOTO</Text>
      <View style={styles.prompts}>
        {SCENE_PROMPTS.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={[styles.prompt, active === p.id && styles.promptActive]}
            onPress={() => ask(p.id)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected: active === p.id }}
          >
            <Text style={[styles.promptText, active === p.id && styles.promptTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {status === 'loading' && (
        <View style={styles.statusRow} accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" color={colors.terra} />
          <Text style={styles.statusText}>Looking at your photo…</Text>
        </View>
      )}

      {status === 'failed' && (
        <View style={styles.statusRow} accessibilityLiveRegion="polite">
          <Text style={styles.statusText}>{message}</Text>
          {!!active && (
            <TouchableOpacity onPress={() => ask(active)} hitSlop={10}>
              <Text style={styles.retry}>Try again</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {status === 'done' && chips && chips.length === 0 && (
        <Text style={styles.statusText}>Nothing for that one in this photo. Try another question.</Text>
      )}

      {status === 'done' && !!chips?.length && (
        <>
          <Text style={styles.statusText}>Tap the words you want as cards.</Text>
          <View style={styles.chips}>
            {chips.map((chip) => {
              const on = isSelected(chip);
              return (
                <TouchableOpacity
                  key={chip.word}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => toggle(chip)}
                  disabled={disabled}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${chip.word}, ${chip.translation}`}
                >
                  {on && <Check size={13} color={colors.white} strokeWidth={3} />}
                  <View>
                    <Text style={[styles.chipWord, { fontFamily: wordFontFor(language) }, on && styles.chipTextOn]}>
                      {chip.word}
                    </Text>
                    <Text style={[styles.chipMeaning, on && styles.chipTextOn]}>{chip.translation}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', marginTop: spacing.lg, gap: spacing.sm },
  heading: { fontSize: 10, fontFamily: fonts.monoBold, color: colors.inkLight, letterSpacing: 1.4 },
  prompts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  prompt: {
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    borderRadius: radii.full, borderWidth: 1.5, borderColor: colors.border,
  },
  promptActive: { borderColor: colors.terra, backgroundColor: colors.sand },
  promptText: { fontSize: 13, fontFamily: fonts.display, color: colors.inkMid },
  promptTextActive: { color: colors.inkDark },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusText: { fontSize: 13, fontFamily: fonts.text, color: colors.inkLight, flexShrink: 1 },
  retry: { fontSize: 13, fontFamily: fonts.display, color: colors.terra },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    borderRadius: radii.md, backgroundColor: colors.sky,
    borderWidth: 1.5, borderColor: colors.borderLight,
  },
  chipOn: { backgroundColor: colors.terra, borderColor: colors.terra },
  chipWord: { fontSize: 16, color: colors.inkDark },
  chipMeaning: { fontSize: 11, fontFamily: fonts.text, color: colors.inkLight },
  chipTextOn: { color: colors.white },
});
