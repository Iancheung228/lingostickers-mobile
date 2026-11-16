import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ChevronsUp, RotateCcw } from 'lucide-react-native';
import type { Sticker } from '@/lib/types';
import { Grade, intervalPreview, spokenDelay } from '@/lib/review';
import { fonts, radii, spacing, PRESS_SCALE } from '@/constants/theme';
import { dur, useMotion } from '@/lib/motion';
import { useTheme, useThemedStyles, type Theme } from '@/hooks/useTheme';
import type { Palette } from '@/constants/palettes';

// The grade row (C-look 1 "Grade row", A-card 4). Again is a tint with an icon
// and Good is the only solid fill, so the four never lean on hue alone: form,
// icon, position and label carry the meaning (Again and Good have the same
// luminance, dE 7 apart for a deuteranope).
//
// The accessibility labels are the ones the approved Maestro flows match:
// "Again — next review in 1 minute".

interface Tone {
  grade: Grade;
  label: string;
  bg: string;
  pressed: string;
  fg: string;
  sub: string;
  icon?: 'again' | 'easy';
  flex: number;
}

const tonesFor = (colors: Palette): Record<Grade, Tone> => ({
  again: { grade: 'again', label: 'Again', bg: colors.againTint, pressed: colors.errorPressed, fg: colors.errorInk, sub: colors.errorInk, icon: 'again', flex: 1.4 },
  hard:  { grade: 'hard',  label: 'Hard',  bg: colors.goldTint, pressed: colors.goldTintPressed, fg: colors.gold, sub: colors.gold, flex: 1 },
  good:  { grade: 'good',  label: 'Good',  bg: colors.success, pressed: colors.successPressed, fg: colors.white, sub: colors.white, flex: 1.4 },
  easy:  { grade: 'easy',  label: 'Easy',  bg: colors.successLight, pressed: colors.successTintPressed, fg: colors.successInk, sub: colors.successInk, icon: 'easy', flex: 1 },
});

const FOUR: Grade[] = ['again', 'hard', 'good', 'easy'];
const TWO: Grade[] = ['again', 'good'];
/// Dynamic Type at or past this stacks the row 2 x 2, Again and Good on top.
const STACK_AT = 1.3;

export default function GradeRow({ sticker, simple, disabled, onGrade, practice }: {
  sticker: Sticker;
  /// Practice: nothing is scheduled, so no interval is promised.
  practice?: boolean;
  /// Two buttons, Again and Good, in place of four.
  simple: boolean;
  disabled: boolean;
  onGrade: (grade: Grade) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const TONES = tonesFor(colors);
  const { fontScale } = useWindowDimensions();
  const stacked = !simple && fontScale >= STACK_AT;
  const grades = simple ? TWO : stacked ? (['again', 'good', 'hard', 'easy'] as Grade[]) : FOUR;

  return (
    <View style={[styles.row, stacked && styles.rowStacked]}>
      {grades.map(g => (
        <GradeButton
          key={g}
          tone={TONES[g]}
          sticker={sticker}
          big={simple}
          practice={!!practice}
          stacked={stacked}
          disabled={disabled}
          onPress={() => onGrade(g)}
        />
      ))}
    </View>
  );
}

function GradeButton({ tone, sticker, big, practice, stacked, disabled, onPress }: {
  tone: Tone; sticker: Sticker; big: boolean; practice: boolean; stacked: boolean; disabled: boolean; onPress: () => void;
}) {
  const { type } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { reduced } = useMotion();
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const pressedRef = useRef(false);
  const interval = intervalPreview(sticker, tone.grade);

  return (
    <Animated.View style={[anim, { flexGrow: stacked ? 0 : tone.flex, flexBasis: stacked ? '48%' : 0, flexShrink: 1 }, stacked && { flexGrow: 1 }, big && styles.big]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => { pressedRef.current = true; if (!reduced) scale.value = withTiming(PRESS_SCALE, { duration: 80 }); }}
        onPressOut={() => { pressedRef.current = false; scale.value = withTiming(1, { duration: dur.fast }); }}
        disabled={disabled}
        // Vertical slop only: the gap between buttons is 8, and horizontal slop
        // on both neighbours would overlap it (lesson #9).
        hitSlop={{ top: 4, bottom: 4 }}
        accessibilityRole="button"
        // Spoken as a sentence, because "Easy 3mo" read aloud is two unrelated
        // nouns. The interval is the whole point of the button.
        accessibilityLabel={practice ? tone.label : `${tone.label} — next review in ${spokenDelay(interval)}`}
        accessibilityState={{ disabled }}
        style={({ pressed }) => [
          styles.btn,
          big && styles.btnBig,
          { backgroundColor: pressed ? tone.pressed : tone.bg },
          disabled && styles.busy,
        ]}
      >
        <View style={styles.labelRow}>
          {tone.icon === 'again' && <RotateCcw size={16} strokeWidth={2} color={tone.fg} />}
          <Text style={[styles.label, { color: tone.fg }]} maxFontSizeMultiplier={type.button.maxFontSizeMultiplier} numberOfLines={1}>
            {tone.label}
          </Text>
          {tone.icon === 'easy' && <ChevronsUp size={16} strokeWidth={2} color={tone.fg} />}
        </View>
        {!practice && (
          <Text style={[styles.interval, { color: tone.sub }]} maxFontSizeMultiplier={type.data.maxFontSizeMultiplier}>
            {interval}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const makeStyles = (_t: Theme) => StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  rowStacked: { flexWrap: 'wrap' },
  big: { minWidth: 0 },
  btn: {
    minHeight: 60,
    minWidth: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  btnBig: { minHeight: 60 },
  // A grade write is one round-trip: without this the row looks live while it
  // is inert, and the second tap that gets no response reads as broken.
  busy: { opacity: 0.55 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  label: { fontFamily: fonts.display, fontSize: 17, lineHeight: 22 },
  interval: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 16 },
});
