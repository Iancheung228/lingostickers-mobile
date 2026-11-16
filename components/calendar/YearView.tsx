import { memo, useEffect, useMemo, useRef } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import StickerImageFallback from '@/components/StickerImageFallback';
import { listImagePath, firstCutout } from '@/lib/thumbnails';
import { dateKeyOf } from '@/lib/review';
import { Sticker } from '@/lib/types';
import { fonts } from '@/constants/theme';
import { dur, ease, useMotion } from '@/lib/motion';
import { useThemedStyles, type Theme } from '@/hooks/useTheme';

export type YearViewProps = {
  year: number;
  /** date key YYYY-MM-DD -> finds (first one is the day's icon) */
  stickersByDate: Map<string, Sticker[]>;
  /** signed URLs keyed by listImagePath(sticker) */
  iconUrls: Map<string, string>;
  todayKey: string;
  /** True once signed URLs have had their grace period: days still without one show the fallback, not the pending chip. */
  urlGrace?: boolean;
  /** month currently shown in Month mode -> a light neutral tile */
  shownMonth: Date;
  /** inner width available inside the card */
  width: number;
  /** called with the first day of the tapped month */
  onPickMonth: (month: Date) => void;
};

const COLS = 3;
const GAP = 6; // between mini months, both axes
const TILE_PAD = 4; // inside a mini month; also the highlight tile's inset
const WEEK_ROWS = 6; // fixed so every month in a row is the same height
const LABEL_H = 16;
const LABEL_GAP = 2;
const MAX_CELL = 16;

const MONTH_FMT = new Intl.DateTimeFormat('en-US', { month: 'short' });
const MONTH_LONG_FMT = new Intl.DateTimeFormat('en-US', { month: 'long' });

type DayFind = { sticker: Sticker; url: string | null };

type MiniMonthProps = {
  year: number;
  month: number; // 0-11
  /** index = day - 1; null when no find that day */
  finds: (DayFind | null)[];
  count: number;
  todayDay: number; // 0 when today is not in this month
  isCurrent: boolean; // the calendar's real current month (terra label)
  selected: boolean; // the month shown in Month mode
  tileW: number;
  cell: number;
  urlGrace: boolean;
  onPick: (month: Date) => void;
};

const MiniMonth = memo(function MiniMonth({
  year, month, finds, count, todayDay, isCurrent, selected, tileW, cell, urlGrace, onPick,
}: MiniMonthProps) {
  const styles = useThemedStyles(makeStyles);
  const first = new Date(year, month, 1);
  const lead = first.getDay();
  const daysIn = new Date(year, month + 1, 0).getDate();
  const mm = String(month + 1).padStart(2, '0');
  const label = `${MONTH_LONG_FMT.format(first)} ${year}, ${count === 0 ? 'no stickers' : count === 1 ? '1 sticker' : `${count} stickers`}`;
  const rows: (number | null)[][] = [];
  for (let r = 0; r < WEEK_ROWS; r++) {
    const row: (number | null)[] = [];
    for (let c = 0; c < 7; c++) {
      const d = r * 7 + c - lead + 1;
      row.push(d >= 1 && d <= daysIn ? d : null);
    }
    rows.push(row);
  }

  return (
    <Pressable
      testID={`calendar-year-month-${year}-${mm}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={() => onPick(new Date(year, month, 1))}
      style={({ pressed }) => [
        styles.mini,
        { width: tileW },
        selected && styles.miniSelected,
        pressed && styles.miniPressed,
      ]}
    >
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Text
          style={[styles.label, isCurrent && styles.labelCurrent]}
          maxFontSizeMultiplier={1.1}
          numberOfLines={1}
        >
          {MONTH_FMT.format(first)}
        </Text>
        {rows.map((row, r) => (
          <View key={r} style={styles.weekRow}>
            {row.map((d, c) => {
              if (d == null) return <View key={c} style={{ width: cell, height: cell }} />;
              const find = finds[d - 1];
              const isToday = d === todayDay;
              return (
                <View
                  key={c}
                  style={[
                    { width: cell, height: cell },
                    styles.cellCenter,
                    isToday && !find && styles.todayDisc,
                    isToday && !!find && styles.todayRing,
                  ]}
                >
                  {find ? (
                    find.url ? (
                      <Image
                        source={{ uri: find.url, cacheKey: listImagePath(find.sticker) ?? undefined }}
                        cachePolicy="memory-disk"
                        style={{ width: cell - 1, height: cell - 1 }}
                        contentFit="contain"
                      />
                    ) : find.sticker.image_path && !urlGrace ? (
                      // Waiting on a signed URL: a quiet chip, not a 20pt spinner.
                      <View style={[styles.pending, { width: cell - 4, height: cell - 4 }]} />
                    ) : (
                      <StickerImageFallback sticker={find.sticker} size={Math.round(cell * 0.6)} />
                    )
                  ) : (
                    <Text
                      style={[styles.num, isToday && styles.numToday]}
                      allowFontScaling={false}
                    >
                      {d}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </Pressable>
  );
});

export default function YearView({
  year, stickersByDate, iconUrls, todayKey, urlGrace = false, shownMonth, width, onPickMonth,
}: YearViewProps) {
  const styles = useThemedStyles(makeStyles);
  const motion = useMotion();
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withTiming(1, { duration: motion.fade(dur.slow), easing: ease });
    // Fade once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const tileW = Math.floor((width - GAP * (COLS - 1)) / COLS);
  const cell = Math.min(MAX_CELL, Math.floor((tileW - TILE_PAD * 2) / 7));

  // One pass over the year. A refetch or re-sign gives stickersByDate/iconUrls a
  // new identity every time, so each month keeps its previous {finds, count}
  // object whenever every day's sticker id, image path and url are unchanged;
  // that is what lets the memoised months skip re-rendering.
  const cache = useRef<{ year: number; months: { finds: (DayFind | null)[]; count: number }[] }>({ year, months: [] });
  const months = useMemo(() => {
    const prev = cache.current.year === year ? cache.current.months : [];
    const next = Array.from({ length: 12 }, (_, m) => {
      const daysIn = new Date(year, m + 1, 0).getDate();
      const finds: (DayFind | null)[] = [];
      let count = 0;
      for (let d = 1; d <= daysIn; d++) {
        const list = stickersByDate.get(dateKeyOf(new Date(year, m, d)));
        if (list && list.length > 0) {
          count += list.length;
          // Cutouts only: a day with no cutout still counts but draws its number.
          const icon = firstCutout(list);
          const path = icon && listImagePath(icon);
          finds.push(icon ? { sticker: icon, url: (path && iconUrls.get(path)) || null } : null);
        } else {
          finds.push(null);
        }
      }
      const old = prev[m];
      const same = old && old.count === count && old.finds.length === finds.length && finds.every((f, i) => {
        const o = old.finds[i];
        if (!f || !o) return f === o;
        return f.url === o.url && f.sticker.id === o.sticker.id && listImagePath(f.sticker) === listImagePath(o.sticker);
      });
      return same ? old : { finds, count };
    });
    cache.current = { year, months: next };
    return next;
  }, [year, stickersByDate, iconUrls]);

  const todayYear = Number(todayKey.slice(0, 4));
  const todayMonth = Number(todayKey.slice(5, 7)) - 1;
  const todayDay = Number(todayKey.slice(8, 10));
  const shownY = shownMonth.getFullYear();
  const shownM = shownMonth.getMonth();

  return (
    <Animated.View style={[{ width }, fadeStyle]}>
      {Array.from({ length: 4 }, (_, r) => (
        <View key={r} style={[styles.row, r > 0 && { marginTop: GAP }]}>
          {Array.from({ length: COLS }, (_, c) => {
            const m = r * COLS + c;
            const inToday = year === todayYear && m === todayMonth;
            return (
              <MiniMonth
                key={m}
                year={year}
                month={m}
                finds={months[m].finds}
                count={months[m].count}
                todayDay={inToday ? todayDay : 0}
                isCurrent={inToday}
                selected={year === shownY && m === shownM}
                tileW={tileW}
                cell={cell}
                urlGrace={urlGrace}
                onPick={onPickMonth}
              />
            );
          })}
        </View>
      ))}
    </Animated.View>
  );
}

const makeStyles = ({ colors }: Theme) => StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  mini: { borderRadius: 10, paddingHorizontal: TILE_PAD, paddingVertical: TILE_PAD },
  // Neutral tiles: the year view keeps the month grid's quiet palette.
  miniSelected: { backgroundColor: colors.border },
  miniPressed: { backgroundColor: colors.rule },
  label: {
    height: LABEL_H,
    marginBottom: LABEL_GAP,
    fontSize: 12,
    lineHeight: LABEL_H,
    fontFamily: fonts.display,
    color: colors.charcoal,
  },
  labelCurrent: { color: colors.terraInk },
  weekRow: { flexDirection: 'row' },
  cellCenter: { alignItems: 'center', justifyContent: 'center' },
  num: { fontSize: 7.5, lineHeight: 10, fontFamily: fonts.mono, color: colors.inkQuiet },
  numToday: { color: colors.white },
  todayDisc: { borderRadius: 999, backgroundColor: colors.terra },
  todayRing: { borderRadius: 999, borderWidth: 1, borderColor: colors.terra },
  pending: { borderRadius: 3, backgroundColor: colors.cardAlt },
});
