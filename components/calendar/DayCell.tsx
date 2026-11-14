import { memo, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import Thumb from './Thumb';
import FlipSticker from './FlipSticker';
import { Sticker } from '@/lib/types';
import { colors, fonts, stickerShadow } from '@/constants/theme';
import { haptic } from '@/lib/haptics';

// Quiet grid (owner, Nov 14: "too much colour, too messy"; spacing from the
// reference footage). No boxes and no dots in the grid: a small neutral date,
// then the sticker with air around it. The row's top hairline is drawn by the
// month page. Today is the one accent (rose badge); a tapped day gets a thin
// ink ring round its number.
// 24pt with 4pt side padding: a two-digit date keeps clear red around it, and with
// larger iOS text the badge widens into a pill instead of clipping the digits.
export const NUM_D = 24;
const NUM_TOP = 7;
const NUM_GAP = 4;
const BOTTOM = 8;
/** Cell height for a sticker box of `stk` pt: date + gap + sticker + bottom air. */
export const cellHeightFor = (stk: number) => NUM_TOP + NUM_D + NUM_GAP + stk + BOTTOM;

const A11Y_DAY_FORMAT = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long' });

type Props = {
  dayKey: string;
  day: number;
  date: Date;
  stk: number;
  cellH: number;
  findCount: number;
  firstFind: Sticker | null;
  url: string | null;
  reviewed: number;
  isToday: boolean;
  isFuture: boolean;
  isSelected: boolean;
  /** False on the sliding neighbour pages: dates only, no stickers (clear, then cascade). */
  live: boolean;
  /** Hold the sticker back until its signed URL is in, so it flips in with its image. */
  imageReady: boolean;
  /** Where this cell sits in the diagonal flip-in wave (calendarFlipDelay). */
  flipDelayMs: number;
  reduced: boolean;
  onSelect: (key: string) => void;
};

function DayCell({
  dayKey, day, date, stk, cellH, findCount, firstFind, url, reviewed,
  isToday, isFuture, isSelected, live, imageReady, flipDelayMs, reduced, onSelect,
}: Props) {
  const dateLabel = useMemo(() => A11Y_DAY_FORMAT.format(date), [date]);
  const parts = [dateLabel];
  if (isToday) parts.push('today');
  parts.push(findCount ? `${findCount} sticker${findCount === 1 ? '' : 's'}` : 'nothing found');
  if (reviewed) parts.push(`${reviewed} reviewed`);

  const showSticker = findCount > 0 && firstFind && live;
  const showAdd = isToday && findCount === 0 && live;

  return (
    <View style={[styles.cell, { height: cellH }]}>
      {/* The cell's own action: select the day. The "+" below is a sibling, not a
          child, so it stays a separate accessible control (skills.md #9). */}
      <Pressable
        testID={`calendar-day-${dayKey}`}
        style={styles.fill}
        onPress={() => onSelect(dayKey)}
        accessibilityRole="button"
        accessibilityLabel={parts.join(', ')}
        accessibilityState={{ selected: isSelected }}
      >
        {/* Today keeps its badge whether or not it is selected (owner, Nov 14: no box on
            today). Selection is also exposed to VoiceOver through accessibilityState. */}
        <View style={[styles.numWrap, isToday ? styles.numToday : isSelected && styles.numSelected]}>
          <Text
            style={[styles.num, isToday ? styles.numTodayText : isFuture && styles.numFuture]}
            maxFontSizeMultiplier={1.15}
          >
            {day}
          </Text>
        </View>
        {showSticker && imageReady ? (
          <View style={[styles.stickerBox, { width: stk, height: stk }]}>
            <FlipSticker delayMs={flipDelayMs} reduced={reduced} size={stk}>
              <View style={styles.shadow}>
                <Thumb sticker={firstFind} size={stk} url={url} />
              </View>
            </FlipSticker>
          </View>
        ) : null}
      </Pressable>
      {showAdd && (
        <View style={styles.addRow} pointerEvents="box-none">
          <Pressable
            testID="calendar-today-add"
            onPress={() => { haptic.tap(); router.push('/scan'); }}
            hitSlop={{ top: 4, bottom: 4, left: 3, right: 3 }}
            style={[styles.add, { width: stk, height: stk, borderRadius: stk / 2 }]}
            accessibilityRole="button"
            accessibilityLabel="Add today's sticker"
          >
            <Plus size={Math.round(stk * 0.45)} strokeWidth={2} color={colors.terra} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default memo(DayCell);

const styles = StyleSheet.create({
  cell: { flex: 1 },
  fill: { flex: 1, alignItems: 'center', gap: NUM_GAP, paddingTop: NUM_TOP },
  numWrap: { minWidth: NUM_D, height: NUM_D, paddingHorizontal: 4, borderRadius: NUM_D / 2, alignItems: 'center', justifyContent: 'center' },
  numToday: { backgroundColor: colors.terra },
  // Ink ring, not a fill: the selection reads without adding a colour block.
  numSelected: { borderWidth: 1.5, borderColor: colors.inkMid },
  num: { fontSize: 12, lineHeight: 16, fontFamily: fonts.mono, color: colors.inkMid },
  numTodayText: { color: colors.white },
  // Neutral and quieter than past days, still 4.5:1 on cream.
  numFuture: { color: colors.inkQuiet },
  stickerBox: { alignItems: 'center', justifyContent: 'center' },
  shadow: { ...stickerShadow, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  addRow: { position: 'absolute', top: NUM_TOP + NUM_D + NUM_GAP, left: 0, right: 0, alignItems: 'center' },
  add: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.terra },
});
