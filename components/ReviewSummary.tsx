import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Check, ChevronRight } from 'lucide-react-native';
import Button from '@/components/ui/Button';
import StudyCard from '@/components/StudyCard';
import { ToastLayer } from '@/components/ToastProvider';
import { haptic } from '@/lib/haptics';
import { useMotion } from '@/lib/motion';
import type { Sticker } from '@/lib/types';
import { colors, e2, fonts, headwordStyle, radii, spacing, type, MIN_TAP } from '@/constants/theme';

interface ReviewSummaryProps {
  /// Null while no session has finished — the modal is driven entirely by
  /// this, so the parent never has to hold a separate "is it open" flag.
  stats: { graded: number; again: number; unsynced?: number } | null;
  /// The learner closed the session before the queue emptied.
  early: boolean;
  /// "Next card in 10m", or null.
  nextDue: string | null;
  /// Words whose last grade this session was Again.
  revisit: Sticker[];
  onDone: () => void;
  onUpdate?: (id: string, patch: Partial<Sticker>) => void;
}

// The wind-down at the end of a study session. Deliberately small: the point
// is to mark that the queue is finished, not to grade the session — a screen
// full of accuracy percentages turns "I did my reviews" into something to
// feel bad about.
export default function ReviewSummary({ stats, early, nextDue, revisit, onDone, onUpdate }: ReviewSummaryProps) {
  const { reduced } = useMotion();
  const pop = useRef(new Animated.Value(0)).current;
  const [opened, setOpened] = useState<Sticker | null>(null);
  // Where the card sits, so the Undo toast can ride just above it, never under the tab bar.
  const [box, setBox] = useState<{ h: number; cardTop: number } | null>(null);
  const shown = !!stats;

  useEffect(() => {
    if (!shown) return;
    haptic.success();
    pop.setValue(0);
    Animated.timing(pop, { toValue: 1, duration: reduced ? 120 : 200, useNativeDriver: true }).start();
  }, [shown]);

  if (!stats) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDone}>
      {/* A card floating on a dimmed backdrop is read as "tap outside to
          close" everywhere else on a phone, and there is nothing here to lose
          by leaving — the session is already over and every grade is written.
          The scrim is a sibling behind the card, not its parent: an accessible
          button hides everything inside it from VoiceOver, which left the
          title, the counts and Done unreachable. */}
      <View style={styles.overlay} onLayout={e => setBox(b => ({ h: e.nativeEvent.layout.height, cardTop: b?.cardTop ?? 0 }))}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onDone}
          accessibilityRole="button"
          accessibilityLabel="Close the session summary"
        />
        <Animated.View
          onLayout={e => { const y = e.nativeEvent.layout.y; setBox(b => (b && b.cardTop === y ? b : { h: b?.h ?? 0, cardTop: y })); }}
          style={[styles.card, { opacity: pop, transform: [{ scale: reduced ? 1 : pop.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }]}
        >
          <View style={styles.badge}>
            <Check size={26} strokeWidth={2.5} color={colors.white} />
          </View>

          <Text style={styles.title} maxFontSizeMultiplier={type.h2.maxFontSizeMultiplier}>
            {early ? 'Stopped early' : 'Session done'}
          </Text>
          <Text style={styles.subtitle} maxFontSizeMultiplier={type.small.maxFontSizeMultiplier}>
            {stats.graded} card{stats.graded === 1 ? '' : 's'} reviewed
          </Text>
          {!!nextDue && (
            <Text style={styles.next} maxFontSizeMultiplier={type.small.maxFontSizeMultiplier}>{nextDue}</Text>
          )}
          {!!stats.unsynced && (
            <Text style={styles.warn} maxFontSizeMultiplier={type.small.maxFontSizeMultiplier}>
              {stats.unsynced === 1 ? "1 review couldn't be saved." : `${stats.unsynced} reviews couldn't be saved.`}
            </Text>
          )}

          {revisit.length > 0 && (
            <View style={styles.revisit}>
              <Text style={styles.revisitHead} maxFontSizeMultiplier={type.small.maxFontSizeMultiplier}>To revisit</Text>
              <ScrollView style={styles.revisitList} showsVerticalScrollIndicator={false}>
                {revisit.map(card => (
                  <Pressable
                    key={card.id}
                    style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.sand }]}
                    onPress={() => { haptic.select(); setOpened(card); }}
                    accessibilityRole="button"
                    accessibilityLabel={`${card.word}, ${card.translation}. Open card`}
                  >
                    <Text style={[headwordStyle(card.language, 18), styles.rowWord]} numberOfLines={1}>{card.word}</Text>
                    <Text style={styles.rowMeaning} numberOfLines={1} maxFontSizeMultiplier={type.small.maxFontSizeMultiplier}>
                      {card.translation}
                    </Text>
                    <ChevronRight size={16} strokeWidth={2} color={colors.inkLight} />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          <Button label="Done" onPress={onDone} style={styles.done} />
        </Animated.View>

        <ToastLayer bottom={box && box.h && box.cardTop ? box.h - box.cardTop + 12 : undefined} />
      </View>

      <StudyCard
        sticker={opened}
        mode="browse"
        embedded
        onClose={() => setOpened(null)}
        onUpdate={(id, patch) => { setOpened(o => (o && o.id === id ? { ...o, ...patch } : o)); onUpdate?.(id, patch); }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    paddingHorizontal: 20,
    paddingTop: spacing.lg,
    paddingBottom: 20,
    ...e2,
  },
  badge: {
    width: 56, height: 56, borderRadius: radii.full,
    backgroundColor: colors.terra,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { ...type.h2 },
  subtitle: { ...type.small, marginTop: 2 },
  next: { ...type.body, color: colors.inkMid, marginTop: spacing.sm },
  warn: { ...type.small, color: colors.error, marginTop: spacing.xs },

  revisit: { alignSelf: 'stretch', marginTop: spacing.md },
  revisitHead: { ...type.small, fontFamily: fonts.display, marginBottom: spacing.xs },
  revisitList: { maxHeight: 4 * MIN_TAP + 8 },
  row: {
    minHeight: MIN_TAP, flexDirection: 'row', alignItems: 'center', gap: spacing.ms,
    borderRadius: radii.sm, paddingHorizontal: spacing.sm,
  },
  rowWord: { flexShrink: 0, maxWidth: '50%' },
  rowMeaning: { ...type.small, flex: 1 },

  done: { alignSelf: 'stretch', marginTop: spacing.lg },
});
