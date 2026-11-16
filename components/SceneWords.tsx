import { friendlyError } from '@/lib/friendlyError';
import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import InlineError from '@/components/ui/InlineError';
import { haptic } from '@/lib/haptics';
import { Check } from 'lucide-react-native';
import { radii, spacing, fonts, wordFontFor } from '@/constants/theme';
import { Language } from '@/lib/types';
import { SCENE_PROMPTS, ScenePromptId, SceneChip, fetchSceneWords } from '@/lib/sceneCards';
import { useTheme, useThemedStyles, type Theme } from '@/hooks/useTheme';

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
  sceneBase64, language, mainWord, avoid, selected, onChangeSelected, disabled, onAnswered,
}: {
  sceneBase64: string;
  language: Language;
  /// The scanned word, so a prompt never offers it back.
  mainWord: string;
  /// More words not to offer: other cards cut from this same photo, and the
  /// extras already chosen on them (batch create with several loops).
  avoid?: string[];
  selected: SceneChip[];
  onChangeSelected: (chips: SceneChip[]) => void;
  disabled?: boolean;
  /// Something new is showing (chips, a message). The section sits at the
  /// bottom of a scroll view under a fixed footer, so the parent scrolls to it.
  onAnswered?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [active, setActive] = useState<ScenePromptId | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'failed'>('idle');
  const [message, setMessage] = useState('');
  // Per prompt, so tapping back to one already asked shows its chips again
  // for free instead of asking (and paying) twice.
  const [answers, setAnswers] = useState<Partial<Record<ScenePromptId, SceneChip[]>>>({});
  // The learner can tap another prompt mid-request; only the latest counts.
  const ticket = useRef(0);

  const ask = async (id: ScenePromptId) => {
    haptic.select();
    setActive(id);
    if (answers[id]) { setStatus('done'); onAnswered?.(); return; }
    const seq = ++ticket.current;
    setStatus('loading');
    try {
      // Everything already on screen is "had", so prompts don't repeat words.
      const seen = Object.values(answers).flat().map((c) => c!.word);
      const chips = await fetchSceneWords(sceneBase64, id, language, [mainWord, ...(avoid ?? []), ...seen]);
      if (seq !== ticket.current) return;
      setAnswers((a) => ({ ...a, [id]: chips }));
      setStatus('done');
      onAnswered?.();
    } catch (err: any) {
      if (seq !== ticket.current) return;
      setMessage(await friendlyError(err, "Couldn't find more words. Try again."));
      setStatus('failed');
      onAnswered?.();
    }
  };

  const isSelected = (chip: SceneChip) => selected.some((c) => c.word === chip.word);
  const toggle = (chip: SceneChip) => {
    haptic.select();
    onChangeSelected(isSelected(chip) ? selected.filter((c) => c.word !== chip.word) : [...selected, chip]);
  };

  // Filtered at render too: a sibling card may have taken a word after this
  // answer came back.
  const taken = new Set(avoid ?? []);
  const chips = active ? answers[active]?.filter((c) => !taken.has(c.word) || isSelected(c)) : undefined;

  // Loading copy escalates (B-core 3). Add is never blocked by the extras.
  const [waited, setWaited] = useState(0);
  useEffect(() => {
    if (status !== 'loading') { setWaited(0); return; }
    const t0 = Date.now();
    const timer = setInterval(() => setWaited(Date.now() - t0), 1000);
    return () => clearInterval(timer);
  }, [status]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading} accessibilityRole="header" maxFontSizeMultiplier={1.5}>Also in this photo</Text>
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
            <Text style={[styles.promptText, active === p.id && styles.promptTextActive]} maxFontSizeMultiplier={1.5}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {status === 'loading' && (
        <View style={styles.statusRow} accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" color={colors.terraInk} />
          <Text style={styles.statusText}>
            {waited > 15000 ? 'Taking a while. You can add the card now.'
              : waited > 5000 ? 'Still looking…'
              : 'Looking at your photo…'}
          </Text>
        </View>
      )}

      {status === 'failed' && !!active && (
        <InlineError message={message} onRetry={() => ask(active)} />
      )}

      {status === 'done' && chips && chips.length === 0 && (
        <Text style={styles.statusText}>Nothing for that one in this photo. Try another question.</Text>
      )}

      {status === 'done' && !!chips?.length && (
        <Text style={styles.statusText}>Tap the words you want as cards.</Text>
      )}
      {status === 'done' && !!chips?.length && (
        <View style={styles.list}>
          {chips.map((chip, i) => {
            const on = isSelected(chip);
            return (
              <TouchableOpacity
                key={chip.word}
                style={[styles.chipRow, i > 0 && styles.chipRowDivider]}
                onPress={() => toggle(chip)}
                disabled={disabled}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${chip.word}, ${chip.translation}`}
              >
                <View style={[styles.check, on && styles.checkOn]}>
                  {on && <Check size={13} color={colors.white} strokeWidth={3} />}
                </View>
                <Text style={[styles.chipWord, { fontFamily: wordFontFor(language) }]} maxFontSizeMultiplier={1.3}>{chip.word}</Text>
                <Text style={styles.chipMeaning} numberOfLines={2} maxFontSizeMultiplier={1.5}>{chip.translation}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const makeStyles = ({ type, colors, e1 }: Theme) => StyleSheet.create({
  wrap: { alignSelf: 'stretch', marginTop: spacing.md, gap: spacing.ms },
  heading: { ...type.h2, fontSize: 18, lineHeight: 24 },
  prompts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  prompt: {
    minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.md,
    borderRadius: radii.full, borderWidth: 1, borderColor: colors.ctl, backgroundColor: colors.card,
  },
  promptActive: { borderColor: colors.terra, backgroundColor: colors.terra },
  promptText: { fontSize: 15, fontFamily: fonts.text, color: colors.inkMid },
  promptTextActive: { color: colors.white, fontFamily: fonts.display },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusText: { ...type.small, flexShrink: 1 },
  list: { backgroundColor: colors.card, borderRadius: radii.md, overflow: 'hidden', ...e1 },
  chipRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.ms,
    minHeight: 52, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  chipRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  check: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.ctl,
    alignItems: 'center', justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.terra, borderColor: colors.terra },
  chipWord: { fontSize: 18, color: colors.inkDark },
  chipMeaning: { flex: 1, ...type.small, textAlign: 'right' },
});
