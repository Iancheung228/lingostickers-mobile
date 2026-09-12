import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Lightbulb } from 'lucide-react-native';

import { glossFor } from '@/lib/gloss';
import { colors, fonts, sentenceFontFor, spacing } from '@/constants/theme';

/**
 * The interlinear breakdown under a sentence: each chunk of the target
 * language sitting above what it means here.
 *
 * The card has always shown a sentence and a translation with nothing joining
 * them. A French learner can usually work out which half is which; a learner
 * of Japanese or Cantonese cannot, because the script is unsegmented — they
 * are looking at 「机の上にコップがあります」 and an English sentence, with no
 * way to discover that 上に is "on" and が marks the subject. Without this the
 * sentence is decoration next to the word it is meant to teach.
 *
 * Renders nothing at all when the gloss is missing, malformed, or no longer
 * describes this sentence (`glossFor` re-checks the fit — a hand-edited
 * sentence leaves its old gloss behind). Falling silent is the right failure:
 * a breakdown that mislabels which characters mean what is worse than none,
 * because nothing in it tells the learner it is wrong.
 *
 * No touch targets, deliberately. This sits inside the study card's back
 * face, where the background is the flip gesture — see skills.md #9. A chunk
 * that looked tappable would be a false affordance, and one that actually was
 * would eat flips.
 */
export function SentenceGloss({ raw, sentence, language, style }: {
  /** The `sentence_gloss` column, straight off the row. */
  raw: unknown;
  /** The sentence it must describe — the fit is re-checked against this. */
  sentence: string;
  language: string;
  style?: StyleProp<ViewStyle>;
}) {
  const chunks = glossFor(raw, sentence);
  if (!chunks) return null;

  const targetFont = sentenceFontFor(language);

  return (
    <View style={[styles.gloss, style]}>
      <Text style={styles.glossLabel}>WORD BY WORD</Text>
      <View style={styles.chunks}>
        {chunks.map((chunk, i) => (
          // Each pair is one accessible element: read as two independent
          // strings, an interlinear gloss becomes an interleaved jumble, and
          // the pairing is the entire content.
          <View
            key={`${i}-${chunk.t}`}
            style={styles.chunk}
            accessible
            accessibilityLabel={`${chunk.t}, ${chunk.g}`}
          >
            <Text style={[styles.chunkTarget, { fontFamily: targetFont }]}>{chunk.t}</Text>
            <Text style={styles.chunkGloss}>{chunk.g}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * The one-line teaching note about the sentence's grammar.
 *
 * Shared rather than restyled per screen because it appears at both ends of a
 * card's life: once at discovery, and then on every review of the back face.
 * It used to render only at discovery, which meant the single sentence on the
 * card that explains *why* this sentence was written the way it was appeared
 * once, for a few seconds, and was never seen again.
 */
export function SentenceInsight({ text, style }: { text: string | null | undefined; style?: StyleProp<ViewStyle> }) {
  const trimmed = text?.trim();
  if (!trimmed) return null;
  return (
    <View style={[styles.insightRow, style]}>
      <Lightbulb size={12} color={colors.sageDark} />
      <Text style={styles.insightText}>{trimmed}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  gloss: {
    marginTop: spacing.ms,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  glossLabel: {
    fontSize: 9,
    fontFamily: fonts.monoBold,
    letterSpacing: 1,
    color: colors.inkFaint,
    marginBottom: spacing.sm,
  },
  chunks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // Column gap carries the whole reading: it is what says where one chunk
    // ends and the next begins, in place of the whitespace the target script
    // may not have. Wider than the row gap on purpose.
    columnGap: 14,
    rowGap: spacing.sm,
  },
  chunk: { alignItems: 'flex-start' },
  // fontFamily comes from the render site — target-language text.
  chunkTarget: { fontSize: 16, lineHeight: 21, color: colors.inkMid },
  chunkGloss: {
    fontSize: 10,
    lineHeight: 13,
    fontFamily: fonts.mono,
    color: colors.inkLight,
    marginTop: 1,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: spacing.ms,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  insightText: { flex: 1, fontSize: 12, fontFamily: fonts.text, color: colors.sageDark, lineHeight: 16 },
});
