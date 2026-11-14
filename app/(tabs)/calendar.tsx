import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePendingDeletes } from '@/components/PendingDeleteProvider';
import { View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing, runOnJS } from 'react-native-reanimated';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useSignedUrls } from '@/hooks/useSignedUrls';
import { listImagePath } from '@/lib/thumbnails';
import StickerImageFallback from '@/components/StickerImageFallback';
import { weekAhead, dueToday, dateKeyOf } from '@/lib/review';
import { limitNewCards } from '@/lib/studyQueue';
import { newCardsIntroducedToday, useStudyPrefs } from '@/lib/studyPrefs';
import StudySessionHost from '@/components/StudySessionHost';
import Button from '@/components/ui/Button';
import { Sticker } from '@/lib/types';
import { colors, e1, fonts, radii, type, stickerShadow, MIN_TAP } from '@/constants/theme';
import RoseBand from '@/components/RoseBand';
import { TAB_BAR_CLEARANCE } from '@/constants/tabBar';
import { haptic } from '@/lib/haptics';
import { dur, ease, spring, useMotion } from '@/lib/motion';

// Sunday-start week (the rest of the app doesn't otherwise commit to one).
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'long' });
const DAY_FORMAT = new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric', month: 'long' });
const A11Y_DAY_FORMAT = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long' });

// C-look 4 "Calendar cell": 52 tall, number in mono 13, a find shows a 20pt
// thumbnail below, a review shows a 6pt dot. The month card overlaps the 132pt
// band by 20.
const GUTTER = 20;
const CARD_PAD_H = 16;
const CELL_HEIGHT = 52;
const BAND_BOTTOM_PAD = 20 + 8; // overlap, plus a little rose under the card corners
const THUMB = 20;

const dateKey = (iso: string) => dateKeyOf(new Date(iso));

type MonthCell = { day: number; key: string; date: Date } | null;

function buildMonthRows(monthDate: Date): MonthCell[][] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay(); // 0=Sun
  const cells: MonthCell[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    cells.push({ day, key: dateKeyOf(date), date });
  }
  // Only the rows the month needs (4 to 6), so a short month isn't a card of white.
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: MonthCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

function Thumb({ sticker, size, url }: { sticker: Sticker; size: number; url: string | null }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {url ? (
        <Image
          source={{ uri: url, cacheKey: listImagePath(sticker) ?? undefined }}
          cachePolicy="memory-disk"
          style={{ width: '100%', height: '100%' }}
          contentFit="contain"
        />
      ) : (
        <StickerImageFallback sticker={sticker} size={Math.round(size * 0.55)} />
      )}
    </View>
  );
}

export default function CalendarScreen() {
  const { user } = useAuth();
  const [fetchedStickers, setStickers] = useState<Sticker[]>([]);
  // A card being deleted (undo window, or already gone) must not come back with
  // a refetch: every list filters through the provider's pendingDeleteIds.
  const { pendingDeleteIds } = usePendingDeletes();
  const stickers = useMemo(
    () => (pendingDeleteIds.size ? fetchedStickers.filter(s => !pendingDeleteIds.has(s.id)) : fetchedStickers),
    [fetchedStickers, pendingDeleteIds],
  );
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [viewedMonth, setViewedMonth] = useState(() => new Date());
  const [selectedKey, setSelectedKey] = useState(() => dateKeyOf(new Date()));
  const [reviewQueue, setReviewQueue] = useState<Sticker[] | null>(null);
  const prefs = useStudyPrefs();
  const { reduced } = useMotion();

  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const pageWidth = screenWidth - GUTTER * 2 - CARD_PAD_H * 2;

  const fetchStickers = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('stickers')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) {
      setLoadError(true);
    } else if (data) {
      setLoadError(false);
      setStickers(data as Sticker[]);
    }
    setLoaded(true);
  }, [user]);

  useFocusEffect(useCallback(() => { fetchStickers(); }, [fetchStickers]));

  // Finds by the day the card was made (an import of an old photo is still
  // today's find); reviews by the day of each card's last review. Only
  // last_reviewed_at is stored, so a card reviewed on two days shows under the
  // later one: the dot is "you reviewed something", never a count to trust.
  const stickersByDate = useMemo(() => {
    const map = new Map<string, Sticker[]>();
    for (const sticker of stickers) {
      const key = dateKey(sticker.created_at);
      const list = map.get(key) ?? [];
      list.push(sticker);
      map.set(key, list);
    }
    return map;
  }, [stickers]);
  const reviewsByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of stickers) {
      if (!s.last_reviewed_at) continue;
      const key = dateKey(s.last_reviewed_at);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [stickers]);

  // One batched sign request for every thumbnail (the first sticker of each
  // day) instead of one per cell: see hooks/useSignedUrls.ts.
  const dayIconUrls = useSignedUrls(useMemo(
    () => Array.from(stickersByDate.values(), list => listImagePath(list[0])),
    [stickersByDate],
  ));

  const todayKey = useMemo(() => dateKeyOf(new Date()), []);
  const forecast = useMemo(() => weekAhead(stickers), [stickers]);
  const dueInSevenDays = useMemo(() => forecast.reduce((sum, d) => sum + d.count, 0), [forecast]);
  // The CTA starts exactly the session Home would: after the new-card limit.
  const due = useMemo(
    () => limitNewCards(dueToday(stickers), prefs.newCardsPerDay, newCardsIntroducedToday()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stickers, prefs.newCardsPerDay],
  );

  const prevMonth = useMemo(() => new Date(viewedMonth.getFullYear(), viewedMonth.getMonth() - 1, 1), [viewedMonth]);
  const nextMonth = useMemo(() => new Date(viewedMonth.getFullYear(), viewedMonth.getMonth() + 1, 1), [viewedMonth]);
  const prevRows = useMemo(() => buildMonthRows(prevMonth), [prevMonth]);
  const currentRows = useMemo(() => buildMonthRows(viewedMonth), [viewedMonth]);
  const nextRows = useMemo(() => buildMonthRows(nextMonth), [nextMonth]);

  const dragX = useSharedValue(0);
  const isTransitioning = useSharedValue(false);

  const commitSwipe = useCallback((direction: 1 | -1) => {
    setViewedMonth(m => new Date(m.getFullYear(), m.getMonth() + direction, 1));
  }, []);
  const tickHaptic = useCallback(() => haptic.select(), []);

  useEffect(() => {
    dragX.value = 0;
    isTransitioning.value = false;
  }, [viewedMonth, dragX, isTransitioning]);

  // Swipe (or the chevrons) changes month: a 200 ms slide, an instant swap under Reduce Motion.
  const slideTo = useCallback((direction: 1 | -1) => {
    if (isTransitioning.value) return;
    haptic.select();
    if (reduced) { commitSwipe(direction); return; }
    isTransitioning.value = true;
    dragX.value = withTiming(-direction * pageWidth, { duration: dur.base, easing: ease }, finished => {
      if (finished) runOnJS(commitSwipe)(direction);
    });
  }, [reduced, pageWidth, commitSwipe, dragX, isTransitioning]);

  const monthSwipeGesture = useMemo(() => {
    const COMMIT_DISTANCE = pageWidth * 0.3;
    const COMMIT_VELOCITY = 700;
    return Gesture.Pan()
      .activeOffsetX([-15, 15])
      .failOffsetY([-10, 10])
      .onUpdate(e => {
        if (isTransitioning.value || reduced) return;
        dragX.value = e.translationX;
      })
      .onEnd(e => {
        if (isTransitioning.value) return;
        const goingNext = e.translationX <= -COMMIT_DISTANCE || e.velocityX <= -COMMIT_VELOCITY;
        const goingPrev = e.translationX >= COMMIT_DISTANCE || e.velocityX >= COMMIT_VELOCITY;
        if (goingNext || goingPrev) {
          const direction = goingNext ? 1 : -1;
          runOnJS(tickHaptic)();
          if (reduced) { runOnJS(commitSwipe)(direction); return; }
          isTransitioning.value = true;
          dragX.value = withTiming(-direction * pageWidth, { duration: dur.base, easing: ease }, finished => {
            if (finished) runOnJS(commitSwipe)(direction);
          });
        } else {
          dragX.value = withSpring(0, spring);
        }
      });
  }, [pageWidth, reduced, commitSwipe, dragX, isTransitioning, tickHaptic]);

  const trackStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -pageWidth + dragX.value }] }));

  const selectDay = (key: string) => { haptic.select(); setSelectedKey(key); };

  const renderMonthPage = (rows: MonthCell[][], pageKey: string) => (
    <View style={{ width: pageWidth }} key={pageKey}>
      {rows.map((row, rowIdx) => (
        <View key={rowIdx} style={styles.gridRow}>
          {row.map((cell, i) => {
            if (!cell) return <View key={i} style={styles.dayCell} accessible={false} importantForAccessibility="no-hide-descendants" />;
            const finds = stickersByDate.get(cell.key) ?? [];
            const reviewed = reviewsByDate.get(cell.key) ?? 0;
            const isToday = cell.key === todayKey;
            const isSelected = cell.key === selectedKey;
            const parts = [A11Y_DAY_FORMAT.format(cell.date)];
            if (isToday) parts.push('today');
            parts.push(finds.length ? `${finds.length} sticker${finds.length === 1 ? '' : 's'}` : 'nothing found');
            if (reviewed) parts.push(`${reviewed} reviewed`);
            return (
              <Pressable
                key={i}
                testID={`calendar-day-${cell.key}`}
                style={styles.dayCell}
                onPress={() => selectDay(cell.key)}
                accessibilityRole="button"
                accessibilityLabel={parts.join(', ')}
                accessibilityState={{ selected: isSelected }}
              >
                {isSelected && <View style={styles.selectedBox} pointerEvents="none" />}
                <View style={[styles.numWrap, isToday && styles.numToday]}>
                  <Text style={[styles.dayNumber, isToday && styles.dayNumberToday]} maxFontSizeMultiplier={1.15}>{cell.day}</Text>
                </View>
                {finds.length > 0 ? (
                  <View style={styles.thumbWrap}>
                    <Thumb sticker={finds[0]} size={THUMB} url={dayIconUrls.get(listImagePath(finds[0]) ?? '') ?? null} />
                  </View>
                ) : reviewed > 0 ? (
                  <View style={styles.dot} />
                ) : null}
                {finds.length > 0 && reviewed > 0 && <View style={[styles.dot, styles.dotCorner]} />}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );

  const selectedDate = useMemo(() => new Date(`${selectedKey}T00:00:00`), [selectedKey]);
  const selFinds = stickersByDate.get(selectedKey) ?? [];
  const selReviewed = reviewsByDate.get(selectedKey) ?? 0;
  const summary = selFinds.length
    ? `${selFinds.length} found${selReviewed ? ` · ${selReviewed} reviewed` : ''}`
    : selReviewed ? `Reviewed ${selReviewed} card${selReviewed === 1 ? '' : 's'}` : 'Nothing found or reviewed';
  const monthHasAnything = useMemo(() => {
    const prefix = `${viewedMonth.getFullYear()}-${String(viewedMonth.getMonth() + 1).padStart(2, '0')}-`;
    for (const k of stickersByDate.keys()) if (k.startsWith(prefix)) return true;
    return false;
  }, [stickersByDate, viewedMonth]);

  return (
    <View style={styles.container}>
      <RoseBand
        title="Calendar"
        bottomPad={BAND_BOTTOM_PAD}
        subtitle={loadError ? (
          <Pressable onPress={fetchStickers} style={styles.retry} accessibilityRole="button" accessibilityLabel="Try loading your calendar again">
            <Text style={[styles.horizon, styles.horizonError]}>Couldn&apos;t load. Tap to retry</Text>
          </Pressable>
        ) : (
          <Text style={styles.horizon} maxFontSizeMultiplier={2}>
            {dueInSevenDays > 0 ? `Due this week: ${dueInSevenDays}` : 'Nothing due this week'}
          </Text>
        )}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + TAB_BAR_CLEARANCE + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── The month card, lifted into the band ── */}
        <View style={styles.gridCard}>
          <View style={styles.monthNav}>
            <Pressable
              onPress={() => slideTo(-1)}
              style={styles.chevron}
              testID="calendar-prev-month"
              accessibilityRole="button"
              accessibilityLabel="Previous month"
            >
              <ChevronLeft size={24} strokeWidth={1.75} color={colors.inkDark} />
            </Pressable>
            <Text style={styles.monthLabel} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
              {MONTH_FORMAT.format(viewedMonth)} {viewedMonth.getFullYear()}
            </Text>
            <Pressable
              onPress={() => slideTo(1)}
              style={styles.chevron}
              testID="calendar-next-month"
              accessibilityRole="button"
              accessibilityLabel="Next month"
            >
              <ChevronRight size={24} strokeWidth={1.75} color={colors.inkDark} />
            </Pressable>
          </View>

          <View style={styles.weekdayRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {WEEKDAY_LABELS.map((label, i) => (
              <View key={i} style={styles.weekdayCell}>
                <Text style={styles.weekdayText} maxFontSizeMultiplier={1.15}>{label}</Text>
              </View>
            ))}
          </View>

          <GestureDetector gesture={monthSwipeGesture}>
            <View style={[styles.monthViewport, { width: pageWidth, height: CELL_HEIGHT * currentRows.length }]}>
              <Animated.View style={[styles.monthTrack, { width: pageWidth * 3 }, trackStyle]}>
                {renderMonthPage(prevRows, 'prev')}
                {renderMonthPage(currentRows, 'cur')}
                {renderMonthPage(nextRows, 'next')}
              </Animated.View>
            </View>
          </GestureDetector>
          {loaded && !loadError && !monthHasAnything && (
            <Text style={styles.emptyMonth} maxFontSizeMultiplier={2}>No stickers this month. Scan one.</Text>
          )}
        </View>

        {/* ── The selected day: a summary row into the Day screen ── */}
        <Pressable
          testID="calendar-selected-day"
          style={styles.summary}
          disabled={selFinds.length === 0}
          onPress={() => { haptic.tap(); router.push(`/day/${selectedKey}`); }}
          accessibilityRole={selFinds.length ? 'button' : 'text'}
          accessibilityLabel={`${A11Y_DAY_FORMAT.format(selectedDate)}, ${summary}`}
          accessibilityHint={selFinds.length ? 'Opens this day' : undefined}
        >
          {selFinds.length > 0 && (
            <View style={styles.summaryThumb}>
              <View style={styles.summaryStk}>
                <Thumb sticker={selFinds[0]} size={32} url={dayIconUrls.get(listImagePath(selFinds[0]) ?? '') ?? null} />
              </View>
            </View>
          )}
          <View style={styles.summaryText}>
            <Text style={styles.summaryTitle} numberOfLines={1} maxFontSizeMultiplier={1.5}>{DAY_FORMAT.format(selectedDate)}</Text>
            <Text style={styles.summarySub} numberOfLines={1} maxFontSizeMultiplier={2}>{summary}</Text>
          </View>
          {selFinds.length > 0 && <ChevronRight size={20} strokeWidth={1.75} color={colors.inkLight} />}
        </Pressable>

        {due.length > 0 && (
          <Button
            label={`Review ${due.length} now`}
            testID="calendar-review-cta"
            icon={<RotateCcw size={20} strokeWidth={1.75} color={colors.white} />}
            onPress={() => { haptic.press(); setReviewQueue(due); }}
            style={styles.cta}
          />
        )}
      </ScrollView>

      <StudySessionHost
        queue={reviewQueue}
        onExit={() => setReviewQueue(null)}
        onUpdate={(id, patch) =>
          setStickers(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)))
        }
        onDeleted={fetchStickers}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sky },
  scroll: { flex: 1, marginTop: -20 },
  horizon: { ...type.small, color: colors.maroon },
  horizonError: { textDecorationLine: 'underline' },
  retry: { minHeight: 24, justifyContent: 'center' },

  gridCard: {
    marginHorizontal: GUTTER,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    paddingHorizontal: CARD_PAD_H,
    paddingTop: 8,
    paddingBottom: 14,
    ...e1,
  },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: MIN_TAP },
  chevron: { width: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { ...type.h2, color: colors.inkDark },

  weekdayRow: { flexDirection: 'row', height: 24, alignItems: 'center' },
  weekdayCell: { flex: 1, alignItems: 'center' },
  weekdayText: { fontSize: 12, lineHeight: 16, fontFamily: fonts.display, color: colors.inkLight },

  monthViewport: { overflow: 'hidden', alignSelf: 'center' },
  monthTrack: { flexDirection: 'row' },
  gridRow: { flexDirection: 'row' },
  dayCell: { flex: 1, height: CELL_HEIGHT, alignItems: 'center', gap: 1 },
  numWrap: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  numToday: { backgroundColor: colors.terra },
  dayNumber: { fontSize: 13, lineHeight: 22, fontFamily: fonts.mono, color: colors.inkMid },
  dayNumberToday: { color: colors.white },
  selectedBox: {
    ...StyleSheet.absoluteFillObject, borderRadius: 12, backgroundColor: colors.terraLight,
    borderWidth: 2, borderColor: colors.terra,
  },
  thumbWrap: { ...stickerShadow, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.terra, marginTop: 9 },
  dotCorner: { position: 'absolute', right: 6, bottom: 6, marginTop: 0 },

  emptyMonth: { ...type.small, textAlign: 'center', marginTop: 10 },

  summary: {
    marginHorizontal: GUTTER + 4, marginTop: 16, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  summaryThumb: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  summaryStk: { ...stickerShadow, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  summaryText: { flex: 1 },
  summaryTitle: { fontSize: 17, lineHeight: 22, fontFamily: fonts.display, color: colors.inkDark },
  summarySub: { ...type.small },
  cta: { marginHorizontal: GUTTER, marginTop: 16 },
});
