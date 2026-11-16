import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePendingDeletes } from '@/components/PendingDeleteProvider';
import { AppState, View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS } from 'react-native-reanimated';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useSignedUrls } from '@/hooks/useSignedUrls';
import { listImagePath, firstCutout } from '@/lib/thumbnails';
import Thumb from '@/components/calendar/Thumb';
import DayCell, { cellHeightFor } from '@/components/calendar/DayCell';
import YearView from '@/components/calendar/YearView';
import { buildTodayPlan, dateKeyOf, QUICK_SESSION_SIZE } from '@/lib/review';
import { newCardsIntroducedToday, useStudyPrefs } from '@/lib/studyPrefs';
import StudySessionHost from '@/components/StudySessionHost';
import { Sticker } from '@/lib/types';
import { fonts, radii, MIN_TAP } from '@/constants/theme';
import RoseBand, { BAND_RADIUS } from '@/components/RoseBand';
import InlineError from '@/components/ui/InlineError';
import { TAB_BAR_CLEARANCE } from '@/constants/tabBar';
import { haptic } from '@/lib/haptics';
import { calendarFlipDelay, dur, ease, spring, useMotion } from '@/lib/motion';
import { useTheme, useThemedStyles, type Theme } from '@/hooks/useTheme';

// Sunday-start week (the rest of the app doesn't otherwise commit to one).
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'long' });
const A11Y_DAY_FORMAT = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long' });
const DAY_FORMAT = new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric', month: 'long' });

// Quiet grid: no card, the month sits on the page with a 16pt gutter; the
// cell height is derived from the sticker size (components/calendar/DayCell.tsx).
const GUTTER = 16;
// Stickers take ~68% of a column (35pt at 390 wide), leaving air between them as in the reference.
const STICKER_FRACTION = 0.68;
const GRACE_MS = 3000;

type Mode = 'month' | 'year';

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

export default function CalendarScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
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
  const [mode, setMode] = useState<Mode>('month');
  const [yearShown, setYearShown] = useState(() => new Date().getFullYear());
  // Bumped on every month change; it re-keys the month's stickers so each
  // change starts a fresh flip cascade and cancels the old one by unmounting.
  // Selecting a day or a refetch never touches it.
  const [cascadeId, setCascadeId] = useState(0);
  // If a day's signed URL never arrives its sticker still shows (fallback)
  // after this grace; until then it waits, so it flips in with its image.
  const [urlGrace, setUrlGrace] = useState(false);
  // Re-read on focus and when the app returns to the foreground, so the "+" and
  // the future-day styling stay right after midnight.
  const [todayKey, setTodayKey] = useState(() => dateKeyOf(new Date()));
  const refreshToday = useCallback(() => setTodayKey(dateKeyOf(new Date())), []);
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => { if (st === 'active') refreshToday(); });
    return () => sub.remove();
  }, [refreshToday]);
  const [selectedKey, setSelectedKey] = useState(() => dateKeyOf(new Date()));
  const [reviewQueue, setReviewQueue] = useState<Sticker[] | null>(null);
  const prefs = useStudyPrefs();
  const { reduced } = useMotion();

  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const pageWidth = screenWidth - GUTTER * 2;
  const stk = Math.round((pageWidth / 7) * STICKER_FRACTION);
  const cellH = cellHeightFor(stk);

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

  useFocusEffect(useCallback(() => { fetchStickers(); refreshToday(); }, [fetchStickers, refreshToday]));

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => setUrlGrace(true), GRACE_MS);
    return () => clearTimeout(t);
  }, [loaded]);

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
  const dayIconUrls = useSignedUrls(useMemo(() => {
    // Only cutouts are drawn as day icons; the selected day's summary thumbnail
    // falls back to its first find when it has no cutout, so sign that too.
    const paths = Array.from(stickersByDate.values(), list => { const c = firstCutout(list); return c ? listImagePath(c) : null; });
    const sel = stickersByDate.get(selectedKey);
    if (sel && !firstCutout(sel)) paths.push(listImagePath(sel[0]));
    return paths;
  }, [stickersByDate, selectedKey]));

  // The CTA starts exactly the session Home would: after the new-card limit.
  const due = useMemo(
    () => buildTodayPlan(stickers, { newCardsPerDay: prefs.newCardsPerDay, introducedToday: newCardsIntroducedToday() }).queue,
    [stickers, prefs.newCardsPerDay],
  );

  const prevMonth = useMemo(() => new Date(viewedMonth.getFullYear(), viewedMonth.getMonth() - 1, 1), [viewedMonth]);
  const nextMonth = useMemo(() => new Date(viewedMonth.getFullYear(), viewedMonth.getMonth() + 1, 1), [viewedMonth]);
  const prevRows = useMemo(() => buildMonthRows(prevMonth), [prevMonth]);
  const currentRows = useMemo(() => buildMonthRows(viewedMonth), [viewedMonth]);
  const nextRows = useMemo(() => buildMonthRows(nextMonth), [nextMonth]);

  const dragX = useSharedValue(0);
  const isTransitioning = useSharedValue(false);

  // The selection follows the visible month: today if it is in that month,
  // else the latest day with a find, else the 1st. Silent (no haptic) and it
  // does not touch cascadeId, so it never replays the flip.
  const latest = useRef({ stickersByDate, todayKey, viewedMonth });
  latest.current = { stickersByDate, todayKey, viewedMonth };
  const followMonth = useCallback((month: Date) => {
    const { stickersByDate: byDate, todayKey: today } = latest.current;
    const y = month.getFullYear();
    const m = month.getMonth();
    if (today.startsWith(`${y}-${String(m + 1).padStart(2, '0')}-`)) { setSelectedKey(today); return; }
    for (let d = new Date(y, m + 1, 0).getDate(); d >= 1; d--) {
      const key = dateKeyOf(new Date(y, m, d));
      if (byDate.has(key)) { setSelectedKey(key); return; }
    }
    setSelectedKey(dateKeyOf(new Date(y, m, 1)));
  }, []);

  const commitSwipe = useCallback((direction: 1 | -1) => {
    const m = latest.current.viewedMonth;
    const next = new Date(m.getFullYear(), m.getMonth() + direction, 1);
    followMonth(next);
    setViewedMonth(next);
    setCascadeId(n => n + 1);
  }, [followMonth]);
  const pickMonth = useCallback((month: Date) => {
    haptic.select();
    const next = new Date(month.getFullYear(), month.getMonth(), 1);
    followMonth(next);
    setViewedMonth(next);
    setMode('month');
    setCascadeId(n => n + 1);
  }, [followMonth]);
  const setModeTo = useCallback((next: Mode) => {
    if (next === mode) return;
    haptic.select();
    if (next === 'year') setYearShown(viewedMonth.getFullYear());
    setMode(next);
  }, [mode, viewedMonth]);
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

  const selectDay = useCallback((key: string) => { haptic.select(); setSelectedKey(key); }, []);

  const renderMonthPage = (rows: MonthCell[][], pageKey: string, live: boolean) => {
    const firstCol = rows[0].findIndex(Boolean);
    return (
      <View style={{ width: pageWidth }} key={pageKey}>
        {rows.map((row, rowIdx) => (
          <View key={rowIdx} style={styles.gridRow}>
            <View style={styles.rowRule} pointerEvents="none" />
            {row.map((cell, i) => {
              if (!cell) return <View key={i} style={[styles.blankCell, { height: cellH }]} accessible={false} importantForAccessibility="no-hide-descendants" />;
              const finds = stickersByDate.get(cell.key) ?? [];
              const first = firstCutout(finds);
              const url = first ? dayIconUrls.get(listImagePath(first) ?? '') ?? null : null;
              return (
                <DayCell
                  key={`${live ? cascadeId : 'x'}-${cell.key}`}
                  dayKey={cell.key}
                  day={cell.day}
                  date={cell.date}
                  stk={stk}
                  cellH={cellH}
                  findCount={finds.length}
                  firstFind={first}
                  url={url}
                  reviewed={reviewsByDate.get(cell.key) ?? 0}
                  isToday={cell.key === todayKey}
                  isFuture={cell.key > todayKey}
                  isSelected={cell.key === selectedKey}
                  live={live}
                  imageReady={url !== null || urlGrace}
                  flipDelayMs={calendarFlipDelay(rowIdx, i, firstCol)}
                  reduced={reduced}
                  onSelect={selectDay}
                />
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  const selectedDate = useMemo(() => new Date(`${selectedKey}T00:00:00`), [selectedKey]);
  const selFinds = stickersByDate.get(selectedKey) ?? [];
  const selIcon = firstCutout(selFinds) ?? selFinds[0];
  const selReviewed = reviewsByDate.get(selectedKey) ?? 0;
  const summary = selFinds.length
    ? `${selFinds.length} found${selReviewed ? ` · ${selReviewed} reviewed` : ''}`
    : selReviewed ? `Reviewed ${selReviewed} card${selReviewed === 1 ? '' : 's'}` : 'Nothing found or reviewed';
  const monthHasAnything = useMemo(() => {
    const prefix = `${viewedMonth.getFullYear()}-${String(viewedMonth.getMonth() + 1).padStart(2, '0')}-`;
    for (const k of stickersByDate.keys()) if (k.startsWith(prefix)) return true;
    return false;
  }, [stickersByDate, viewedMonth]);

  const now = new Date(`${todayKey}T00:00:00`);
  const awayFromToday = mode === 'month'
    ? viewedMonth.getFullYear() !== now.getFullYear() || viewedMonth.getMonth() !== now.getMonth()
    : yearShown !== now.getFullYear();
  const goToday = () => {
    if (mode === 'year') { haptic.select(); setYearShown(now.getFullYear()); return; }
    pickMonth(now);
  };

  // Month | Year lives in the band's right-hand slot, so the page below is only
  // the title row, the weekday letters and the grid.
  const modeSwitch = (
    <View style={styles.segment} accessibilityRole="tablist">
      {(['month', 'year'] as const).map(m => (
        <Pressable
          key={m}
          testID={`calendar-mode-${m}`}
          onPress={() => setModeTo(m)}
          style={[styles.segmentItem, mode === m && styles.segmentItemOn]}
          hitSlop={{ top: 6, bottom: 6 }}
          accessibilityRole="tab"
          accessibilityLabel={m === 'month' ? 'Month view' : 'Year view'}
          accessibilityState={{ selected: mode === m }}
        >
          <Text style={[styles.segmentText, mode === m && styles.segmentTextOn]} maxFontSizeMultiplier={1.2}>
            {m === 'month' ? 'Month' : 'Year'}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  const titleRow = (title: ReactNode, prev: () => void, next: () => void, ids: [string, string], labels: [string, string]) => (
    <View style={styles.titleRow}>
      <Text style={styles.title} accessibilityRole="header" numberOfLines={1} maxFontSizeMultiplier={1.3}>{title}</Text>
      {awayFromToday && (
        <Pressable
          testID="calendar-today"
          onPress={goToday}
          style={styles.todayLink}
          accessibilityRole="button"
          accessibilityLabel={mode === 'month' ? 'Go to this month' : 'Go to this year'}
        >
          <Text style={styles.todayLinkText} maxFontSizeMultiplier={1.3}>Today</Text>
        </Pressable>
      )}
      <Pressable onPress={prev} style={styles.chevron} testID={ids[0]} accessibilityRole="button" accessibilityLabel={labels[0]}>
        <ChevronLeft size={22} strokeWidth={1.75} color={colors.inkMid} />
      </Pressable>
      <Pressable onPress={next} style={styles.chevron} testID={ids[1]} accessibilityRole="button" accessibilityLabel={labels[1]}>
        <ChevronRight size={22} strokeWidth={1.75} color={colors.inkMid} />
      </Pressable>
    </View>
  );

  return (
    <View style={styles.container}>
      <RoseBand title="Calendar" right={modeSwitch} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingTop: BAND_RADIUS + 10, paddingBottom: insets.bottom + TAB_BAR_CLEARANCE + 16 }}
        showsVerticalScrollIndicator={false}
      >
        {loadError && (
          <View style={styles.loadError}>
            <InlineError message="Couldn't load your calendar." onRetry={fetchStickers} />
          </View>
        )}
        <View style={styles.page}>
          {/* Month mode stays mounted (hidden) while Year is up, so flipping back with the
              toggle doesn't replay the cascade; only a real month change re-keys the cells. */}
          <View style={mode === 'month' ? undefined : styles.hidden}>
            {titleRow(
              <>{MONTH_FORMAT.format(viewedMonth)} <Text style={styles.titleYear}>{viewedMonth.getFullYear()}</Text></>,
              () => slideTo(-1), () => slideTo(1),
              ['calendar-prev-month', 'calendar-next-month'], ['Previous month', 'Next month'],
            )}

            <View style={styles.weekdayRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {WEEKDAY_LABELS.map((label, i) => (
                <View key={i} style={styles.weekdayCell}>
                  <Text style={styles.weekdayText} maxFontSizeMultiplier={1.15}>{label}</Text>
                </View>
              ))}
            </View>

            <GestureDetector gesture={monthSwipeGesture}>
              <View style={[styles.monthViewport, { width: pageWidth, height: cellH * currentRows.length }]}>
                <Animated.View style={[styles.monthTrack, { width: pageWidth * 3 }, trackStyle]}>
                  {renderMonthPage(prevRows, 'prev', false)}
                  {renderMonthPage(currentRows, 'cur', true)}
                  {renderMonthPage(nextRows, 'next', false)}
                </Animated.View>
              </View>
            </GestureDetector>
            <View style={styles.rule} />
          </View>
          {mode === 'year' && (
            <>
              {titleRow(
                String(yearShown),
                () => { haptic.select(); setYearShown(y => y - 1); },
                () => { haptic.select(); setYearShown(y => y + 1); },
                ['calendar-prev-year', 'calendar-next-year'], ['Previous year', 'Next year'],
              )}
              <YearView
                year={yearShown}
                stickersByDate={stickersByDate}
                iconUrls={dayIconUrls}
                todayKey={todayKey}
                urlGrace={urlGrace}
                shownMonth={viewedMonth}
                width={pageWidth}
                onPickMonth={pickMonth}
              />
            </>
          )}
          {mode === 'month' && loaded && !loadError && !monthHasAnything && (
            <Text style={styles.emptyMonth} maxFontSizeMultiplier={2}>No stickers this month. Scan one.</Text>
          )}

          {/* ── The selected day, and the review shortcut, on one quiet row ── */}
          <View style={styles.footer}>
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
                <View style={styles.summaryStk}>
                  <Thumb sticker={selIcon} size={34} url={dayIconUrls.get(listImagePath(selIcon) ?? '') ?? null} />
                </View>
              )}
              <View style={styles.summaryText}>
                <Text style={styles.summaryTitle} numberOfLines={1} maxFontSizeMultiplier={1.5}>{DAY_FORMAT.format(selectedDate)}</Text>
                <Text style={styles.summarySub} numberOfLines={1} maxFontSizeMultiplier={2}>{summary}</Text>
              </View>
              {selFinds.length > 0 && <ChevronRight size={18} strokeWidth={1.75} color={colors.inkQuiet} />}
            </Pressable>
            {due.length > 0 && (
              <Pressable
                testID="calendar-review-cta"
                onPress={() => { haptic.press(); setReviewQueue(due.slice(0, QUICK_SESSION_SIZE)); }}
                style={({ pressed }) => [styles.review, pressed && styles.reviewPressed]}
                accessibilityRole="button"
                accessibilityLabel="Review"
              >
                <RotateCcw size={15} strokeWidth={2} color={colors.inkMid} />
                <Text style={styles.reviewText} maxFontSizeMultiplier={1.3}>Review</Text>
              </Pressable>
            )}
          </View>
        </View>
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

const makeStyles = ({ colors, type, stickerShadow }: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sky },
  scroll: { flex: 1, marginTop: -BAND_RADIUS },
  loadError: { marginHorizontal: GUTTER, marginBottom: 8 },

  // No card: the grid sits on the page, structured only by hairlines.
  page: { marginHorizontal: GUTTER },
  titleRow: { flexDirection: 'row', alignItems: 'center', height: MIN_TAP, marginBottom: 6 },
  title: { flex: 1, fontSize: 26, lineHeight: 32, fontFamily: fonts.display, color: colors.charcoal, letterSpacing: -0.3 },
  titleYear: { color: colors.inkQuiet },
  todayLink: { height: MIN_TAP, paddingHorizontal: 10, justifyContent: 'center' },
  todayLinkText: { fontSize: 15, lineHeight: 20, fontFamily: fonts.display, color: colors.terraInk },
  chevron: { width: 40, height: MIN_TAP, alignItems: 'center', justifyContent: 'center' },

  weekdayRow: { flexDirection: 'row', height: 22, alignItems: 'center' },
  weekdayCell: { flex: 1, alignItems: 'center' },
  weekdayText: { fontSize: 10, lineHeight: 14, fontFamily: fonts.mono, color: colors.inkQuiet, letterSpacing: 0.8 },

  monthViewport: { overflow: 'hidden', alignSelf: 'center' },
  monthTrack: { flexDirection: 'row' },
  gridRow: { flexDirection: 'row' },
  rule: { height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.rule },
  rowRule: { position: 'absolute', top: 0, left: 0, right: 0, height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.rule },
  blankCell: { flex: 1 },
  hidden: { display: 'none' },

  // On the band: white pill on a translucent track, maroon text (the band's ink).
  segment: { flexDirection: 'row', padding: 2, borderRadius: radii.full, backgroundColor: colors.bandTrack },
  segmentItem: { minWidth: 60, height: 30, paddingHorizontal: 12, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  segmentItemOn: { backgroundColor: colors.raised },
  segmentText: { fontSize: 14, lineHeight: 18, fontFamily: fonts.display, color: colors.maroon },
  segmentTextOn: { color: colors.charcoal },

  emptyMonth: { ...type.small, color: colors.inkQuiet, textAlign: 'center', marginTop: 12 },

  footer: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  summary: { flex: 1, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryStk: { ...stickerShadow, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  summaryText: { flex: 1 },
  summaryTitle: { fontSize: 17, lineHeight: 22, fontFamily: fonts.display, color: colors.charcoal },
  summarySub: { ...type.small, color: colors.inkQuiet },
  review: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14,
    borderRadius: radii.full, borderWidth: 1, borderColor: colors.ctl,
  },
  reviewPressed: { backgroundColor: colors.border },
  reviewText: { fontSize: 15, lineHeight: 20, fontFamily: fonts.display, color: colors.inkMid },
});
