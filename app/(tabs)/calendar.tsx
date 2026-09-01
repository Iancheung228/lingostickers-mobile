import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing, runOnJS } from 'react-native-reanimated';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useSignedUrls } from '@/hooks/useSignedUrls';
import { weekAhead, weekActivity, dueToday, dueCountsByDate, dateKeyOf, reviewMinutes, heaviestDay } from '@/lib/review';
import WeekActivityTracker from '@/components/WeekActivityTracker';
import StudySessionHost from '@/components/StudySessionHost';
import { Sticker } from '@/lib/types';
import { colors, spacing, fonts, radii, shadows } from '@/constants/theme';
import { TAB_BAR_CLEARANCE } from '@/constants/tabBar';

// Sunday-start week, matching the minimal-journal reference layout (the
// rest of the app doesn't otherwise commit to a week-start convention).
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'long' });

// ── Reference geometry ─────────────────────────────────────────────────────
// Measured off the design mockup, which is drawn at a 430pt frame, so these
// read one-to-one as dp. They're constants rather than spacing-scale rungs
// because the layout depends on them agreeing with each other — the band's
// padding has to leave room for exactly GRID_OVERLAP, and the tracker card's
// column centres have to land on the month grid's.

// Both cards and the band's content share one gutter, so the segmented
// control's right edge sits directly above the card corner below it.
const SCREEN_PAD = 20;
// The month card's own inset. With SCREEN_PAD this is what sets the day
// column width, and WeekAheadTracker's slightly wider inset is chosen to
// land its bars on these same centres.
const CARD_PAD_H = 13;
const CARD_RADIUS = 28;
// A day cell's pitch. The screen is laid out to fit without scrolling, so the
// six rows divide whatever height is left after the band, the tracker and the
// CTA have taken theirs — measured, not derived from the window, because that
// leftover depends on which of those are actually on screen. The bounds keep
// a tall phone from stretching the month into a wall of whitespace and a
// short one from squeezing the numerals together.
const ROW_HEIGHT_MAX = 59;
const ROW_HEIGHT_MIN = 38;
// The due-count ring, and the filled disc on today. Same size so the month
// reads as one column of markers rather than two — shrunk in step with the
// row when the row is short, since it hangs below the numeral inside it.
const MARKER_SIZE = 30;
const MARKER_MIN = 20;
// How far the month card lifts into the rose band above it. The band reserves
// this at its own bottom edge, plus the gap that stays visible either side.
const GRID_OVERLAP = 63;
const BAND_GAP = 27;
// A day that owes something but isn't the week's heaviest. Deliberately not a
// tint of the ring beside it: the muted ring is "there's work here", the full
// one is "this is the day", and a scale between them would invite reading a
// count off the colour.
const RING_MUTED = '#C49497';

// Local-time date key (not UTC) so a sticker captured at 11pm doesn't get
// bucketed into the next day. Shares lib/review.ts's key format so a day's
// finds and its due count can be looked up with the same string.
function dateKey(iso: string): string {
  return dateKeyOf(new Date(iso));
}

// What the month grid is showing. 'finds' is the collection's own history —
// the day's sticker cutouts, as before. 'reviews' is the schedule ahead.
type CalendarMode = 'finds' | 'reviews';

type MonthCell = { day: number; key: string } | null;

// Always padded to exactly 6 rows (42 cells) so neighboring months in the
// swipe carousel never cause a layout jump mid-drag.
function buildMonthRows(monthDate: Date): MonthCell[][] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay(); // 0=Sun
  const cells: MonthCell[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, key: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` });
  }
  while (cells.length < 42) cells.push(null);
  const rows: MonthCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

// Replaces the date number entirely on days with a capture — mirrors the
// reference's "icon instead of numeral" treatment, using the day's own
// sticker photo rather than a fixed illustration set.
function DayIcon({ sticker, size, url }: { sticker: Sticker; size: number; url: string | null }) {
  return (
    <View style={[styles.dayIcon, { width: size, height: size }]}>
      {url ? (
        <Image
          source={{ uri: url, cacheKey: sticker.image_path }}
          cachePolicy="memory-disk"
          style={styles.dayIconImage}
          contentFit="contain"
        />
      ) : (
        <ActivityIndicator size="small" color={colors.rust} />
      )}
    </View>
  );
}

export default function CalendarScreen() {
  const { user } = useAuth();
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [viewedMonth, setViewedMonth] = useState(() => new Date());
  const [mode, setMode] = useState<CalendarMode>('finds');
  const [reviewQueue, setReviewQueue] = useState<Sticker[] | null>(null);

  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const pageWidth = screenWidth - SCREEN_PAD * 2 - CARD_PAD_H * 2;

  // The month grid is the one block that gives: everything else on the screen
  // is fixed height, so the grid takes the slack and divides it into its six
  // rows. Measured off the viewport rather than computed from the window so
  // the CTA appearing or disappearing resizes the rows on its own.
  const [gridHeight, setGridHeight] = useState(0);
  const rowHeight = gridHeight > 0
    ? Math.min(ROW_HEIGHT_MAX, Math.max(ROW_HEIGHT_MIN, gridHeight / 6))
    : ROW_HEIGHT_MAX;
  const markerSize = Math.min(MARKER_SIZE, Math.max(MARKER_MIN, rowHeight - 19));
  const dayIconSize = Math.min(pageWidth / 7 - 10, rowHeight - 8);

  const fetchStickers = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('stickers')
      .select('*')
      .eq('user_id', user.id)
      .order('discovered_at', { ascending: false });
    if (error) {
      setLoadError(true);
    } else if (data) {
      setLoadError(false);
      setStickers(data as Sticker[]);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { fetchStickers(); }, [fetchStickers]));

  const stickersByDate = useMemo(() => {
    const map = new Map<string, Sticker[]>();
    for (const sticker of stickers) {
      const key = dateKey(sticker.discovered_at);
      const list = map.get(key) ?? [];
      list.push(sticker);
      map.set(key, list);
    }
    return map;
  }, [stickers]);

  // One batched sign request for every day-icon photo (only the first
  // sticker of each day is ever shown) instead of one per rendered cell —
  // see hooks/useSignedUrls.ts.
  const dayIconUrls = useSignedUrls(useMemo(
    () => Array.from(stickersByDate.values(), list => list[0].image_path),
    [stickersByDate]
  ));

  const today = useMemo(() => new Date(), []);
  // Recomputed only when the collection changes, not on every render: these
  // read the clock, and a chart that reshuffled mid-swipe would be worse than
  // one that's a few minutes stale.
  const forecast = useMemo(() => weekAhead(stickers), [stickers]);
  // The week behind, for the chart: what was found and what was reviewed each
  // day. The forecast above still feeds the band's horizon line and the grid's
  // heavy-day ring — the two windows point in opposite directions on purpose,
  // and only the backward one can be split by activity.
  const week = useMemo(() => weekActivity(stickers), [stickers]);
  const dueCounts = useMemo(() => dueCountsByDate(stickers), [stickers]);
  const due = useMemo(() => dueToday(stickers), [stickers]);
  const dueInSevenDays = useMemo(
    () => forecast.reduce((sum, d) => sum + d.count, 0),
    [forecast]
  );
  // The day the chart's caption names, rung in full colour in the grid so
  // both halves of the screen point at the same Thursday.
  const heavyKey = useMemo(() => {
    const heaviest = heaviestDay(forecast);
    return heaviest ? dateKeyOf(heaviest.date) : null;
  }, [forecast]);
  const todayKey = dateKey(today.toISOString());

  const prevMonth = useMemo(() => new Date(viewedMonth.getFullYear(), viewedMonth.getMonth() - 1, 1), [viewedMonth]);
  const nextMonth = useMemo(() => new Date(viewedMonth.getFullYear(), viewedMonth.getMonth() + 1, 1), [viewedMonth]);
  const prevRows = useMemo(() => buildMonthRows(prevMonth), [prevMonth]);
  const currentRows = useMemo(() => buildMonthRows(viewedMonth), [viewedMonth]);
  const nextRows = useMemo(() => buildMonthRows(nextMonth), [nextMonth]);

  const dragX = useSharedValue(0);
  const isTransitioning = useSharedValue(false);
  const hasTriggeredThresholdHaptic = useSharedValue(false);

  const commitSwipe = useCallback((direction: 1 | -1) => {
    setViewedMonth(m => new Date(m.getFullYear(), m.getMonth() + direction, 1));
  }, []);

  const triggerThresholdHaptic = useCallback(() => {
    Haptics.selectionAsync();
  }, []);

  const triggerCommitHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  useEffect(() => {
    dragX.value = 0;
    isTransitioning.value = false;
  }, [viewedMonth, dragX, isTransitioning]);

  const monthSwipeGesture = useMemo(() => {
    const COMMIT_DISTANCE = pageWidth * 0.3;
    const COMMIT_VELOCITY = 700;
    return Gesture.Pan()
      .activeOffsetX([-15, 15])
      .failOffsetY([-10, 10])
      .onStart(() => {
        hasTriggeredThresholdHaptic.value = false;
      })
      .onUpdate((e) => {
        if (isTransitioning.value) return;
        dragX.value = e.translationX;
        const pastThreshold = Math.abs(e.translationX) >= COMMIT_DISTANCE;
        if (pastThreshold && !hasTriggeredThresholdHaptic.value) {
          hasTriggeredThresholdHaptic.value = true;
          runOnJS(triggerThresholdHaptic)();
        } else if (!pastThreshold && hasTriggeredThresholdHaptic.value) {
          hasTriggeredThresholdHaptic.value = false;
        }
      })
      .onEnd((e) => {
        if (isTransitioning.value) return;
        const goingNext = e.translationX <= -COMMIT_DISTANCE || e.velocityX <= -COMMIT_VELOCITY;
        const goingPrev = e.translationX >= COMMIT_DISTANCE || e.velocityX >= COMMIT_VELOCITY;
        if (goingNext || goingPrev) {
          isTransitioning.value = true;
          runOnJS(triggerCommitHaptic)();
          const direction = goingNext ? 1 : -1;
          dragX.value = withTiming(-direction * pageWidth, { duration: 240, easing: Easing.out(Easing.cubic) }, (finished) => {
            if (finished) runOnJS(commitSwipe)(direction);
          });
        } else {
          dragX.value = withSpring(0, { damping: 30, stiffness: 260 });
        }
      });
  }, [pageWidth, commitSwipe, dragX, isTransitioning, hasTriggeredThresholdHaptic, triggerThresholdHaptic, triggerCommitHaptic]);

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -pageWidth + dragX.value }],
  }));

  const renderMonthPage = (rows: MonthCell[][]) => (
    <View style={{ width: pageWidth }}>
      {rows.map((row, rowIdx) => (
        <View key={rowIdx} style={styles.gridRow}>
          {row.map((cell, i) => {
            if (!cell) return <View key={i} style={[styles.dayCell, { height: rowHeight }]} />;
            const dayStickers = stickersByDate.get(cell.key) ?? [];
            const isToday = cell.key === todayKey;

            // Reviews mode: the numeral always shows, with a marker beneath
            // it. A counted circle is what the schedule owes that day —
            // filled on today, outlined ahead. The small hollow ring means
            // only "you found something here", which is why it is drawn
            // differently: it is a memory marker, not a review count, and
            // conflating the two would have the grid quietly reporting the
            // wrong metric. Past days therefore carry no review data — only
            // last_reviewed_at is stored, never one row per review, so what
            // you studied on the 12th is genuinely unrecoverable.
            if (mode === 'reviews') {
              const count = dueCounts.get(cell.key) ?? 0;
              const marked = count > 0 || dayStickers.length > 0;
              return (
                <View key={i} style={[styles.dayCell, { height: rowHeight }]}>
                  {isToday && <View style={styles.todayBox} pointerEvents="none" />}
                  <Text style={[styles.dayNumber, marked && styles.dayNumberMarked, isToday && styles.dayNumberToday]}>{cell.day}</Text>
                  {count > 0 ? (
                    <View
                      style={[
                        styles.dueRing,
                        { minWidth: markerSize, height: markerSize },
                        cell.key === heavyKey && styles.dueRingHeavy,
                        isToday && styles.dueRingToday,
                      ]}
                    >
                      <Text style={[styles.dueRingText, isToday && styles.dueRingTextToday]}>{count}</Text>
                    </View>
                  ) : dayStickers.length > 0 ? (
                    <View style={styles.findDot} />
                  ) : null}
                </View>
              );
            }

            return (
              <TouchableOpacity
                key={i}
                style={[styles.dayCell, styles.dayCellCentered, { height: rowHeight }]}
                onPress={() => router.push(`/day/${cell.key}`)}
                disabled={dayStickers.length === 0}
                activeOpacity={0.7}
              >
                {isToday && <View style={styles.todayBox} pointerEvents="none" />}
                {dayStickers.length > 0 ? (
                  <DayIcon
                    sticker={dayStickers[0]}
                    size={dayIconSize}
                    url={dayIconUrls.get(dayStickers[0].image_path) ?? null}
                  />
                ) : (
                  <Text style={[styles.dayNumber, isToday && styles.dayNumberToday]}>{cell.day}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );

  const commitMonth = (direction: 1 | -1) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setViewedMonth(m => new Date(m.getFullYear(), m.getMonth() + direction, 1));
  };

  return (
    <View style={styles.container}>
      {/* ── Rose band ── */}
      <View style={[styles.band, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.bandRow}>
          <View style={styles.bandTitleWrap}>
            <Text style={styles.title}>The long view</Text>
            {/* Doubles as the band's status line: an empty month grid is
                indistinguishable from a failed fetch otherwise. */}
            {loadError ? (
              <TouchableOpacity
                onPress={fetchStickers}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Try loading your calendar again"
              >
                <Text style={[styles.horizon, styles.horizonError]}>COULDN&apos;T LOAD · TAP TO RETRY</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.horizon}>
                {dueInSevenDays > 0 ? `${dueInSevenDays} DUE IN 7 DAYS` : 'NOTHING DUE THIS WEEK'}
              </Text>
            )}
          </View>

          {/* One toggle decides what the grid means, so the two readings of
              a day — what you found, what you owe — can't be confused. */}
          <View style={styles.segmented}>
            {(['finds', 'reviews'] as CalendarMode[]).map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.segment, mode === m && styles.segmentActive]}
                onPress={() => { Haptics.selectionAsync(); setMode(m); }}
              >
                <Text style={[styles.segmentText, mode === m && styles.segmentTextActive]}>
                  {m === 'finds' ? 'Finds' : 'Reviews'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Everything below the band is one non-scrolling column: the week
          ahead lifts into the rose, and the month card underneath it takes
          whatever height is left. */}
      <View style={[styles.body, { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }]}>
        <View style={styles.tracker}>
          <WeekActivityTracker week={week} active={mode} />
        </View>

        {/* ── Month grid card ── */}
        <View style={styles.gridCard}>
          <View style={styles.monthNav}>
            <TouchableOpacity
              onPress={() => commitMonth(-1)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Previous month"
            >
              <ChevronLeft size={16} color={colors.inkDark} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>
              {MONTH_FORMAT.format(viewedMonth).toUpperCase()} {viewedMonth.getFullYear()}
            </Text>
            <TouchableOpacity
              onPress={() => commitMonth(1)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Next month"
            >
              <ChevronRight size={16} color={colors.inkDark} />
            </TouchableOpacity>
          </View>

          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((label, i) => (
              <View key={i} style={styles.weekdayCell}>
                <Text style={styles.weekdayText}>{label}</Text>
              </View>
            ))}
          </View>

          <GestureDetector gesture={monthSwipeGesture}>
            <View
              style={[styles.monthViewport, { width: pageWidth }]}
              onLayout={e => setGridHeight(e.nativeEvent.layout.height)}
            >
              <Animated.View style={[styles.monthTrack, { width: pageWidth * 3 }, trackStyle]}>
                {renderMonthPage(prevRows)}
                {renderMonthPage(currentRows)}
                {renderMonthPage(nextRows)}
              </Animated.View>
            </View>
          </GestureDetector>
        </View>

        {due.length > 0 && (
          <TouchableOpacity
            style={styles.reviewCta}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setReviewQueue(due);
            }}
            activeOpacity={0.88}
          >
            <Clock size={18} color={colors.white} />
            <Text style={styles.reviewCtaText}>
              Review {due.length} now · {reviewMinutes(due.length)} min
            </Text>
          </TouchableOpacity>
        )}
      </View>

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
  // The overlap lives on this column's frame, not on the card inside it, so
  // the cards stay a later sibling than the band and paint on top of the rose
  // rather than under it. flex: 1 is also what makes the month grid elastic —
  // the column is exactly the leftover screen, and the grid card inside it
  // absorbs whatever the tracker and CTA don't use.
  body: { flex: 1, marginTop: -GRID_OVERLAP },

  // ── rose band ──
  band: {
    backgroundColor: colors.blush,
    borderBottomLeftRadius: CARD_RADIUS,
    borderBottomRightRadius: CARD_RADIUS,
    paddingHorizontal: SCREEN_PAD,
    // Deep enough for the grid card to lift into it and still leave BAND_GAP
    // of rose showing below the card's top corners — see scrollView's negative
    // margin, which pulls up by all but that gap.
    paddingBottom: GRID_OVERLAP + BAND_GAP,
  },
  // The month heading sits on the card it labels, so the band is left with
  // the screen's title, its one forward-looking line, and the mode toggle.
  // The count of what's due lives on the CTA at the bottom, which is the
  // thing you'd actually act on — a second copy of it up here was a headline
  // that did nothing.
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    marginBottom: 11,
  },
  monthLabel: { fontSize: 12, fontFamily: fonts.monoBold, color: colors.inkDark, letterSpacing: 1.8 },

  bandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  // Takes the slack and gives it back: the toggle beside it is a fixed size,
  // so the title is the side that's allowed to wrap or shrink.
  bandTitleWrap: { flex: 1 },
  // lineHeight is set generously on purpose. The band used to lead with a
  // 58pt numeral in a 50pt line box, which clipped the digits top and bottom;
  // a display serif has real ascenders and descenders and needs the room.
  title: {
    fontSize: 27,
    lineHeight: 34,
    fontFamily: fonts.cozy,
    color: colors.maroon,
    letterSpacing: -0.4,
  },
  // The week ahead in one line. The screen's other numbers are all
  // retrospective — this is the only forward-looking one, which is why it
  // rides with the title rather than sitting among the cards.
  horizon: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
    fontFamily: fonts.monoBold,
    color: colors.maroon,
    letterSpacing: 1.4,
  },
  // Same slot, same metrics — only the colour changes, so a failed load
  // reads as a state of this line rather than as new furniture appearing.
  horizonError: { color: colors.error, textDecorationLine: 'underline' },


  segmented: {
    flexDirection: 'row',
    backgroundColor: '#EFC4C4',
    borderRadius: radii.full,
    padding: 4,
  },
  segment: { paddingHorizontal: spacing.ms, paddingVertical: 9, borderRadius: radii.full },
  segmentActive: { backgroundColor: colors.white },
  segmentText: { fontSize: 12, fontFamily: fonts.cozy, color: colors.maroon },
  segmentTextActive: { color: colors.blushDeep },

  findDot: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: '#E0C3C6',
    marginTop: 8,
  },

  // ── month grid card ──
  gridCard: {
    flex: 1,
    marginHorizontal: SCREEN_PAD,
    backgroundColor: colors.card,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: CARD_PAD_H,
    paddingTop: 13,
    paddingBottom: 10,
    ...shadows.card,
  },

  // The week ahead is the card that now lifts into the band, so it carries no
  // top margin of its own — the column's negative one already placed it.
  tracker: { marginBottom: 14 },

  // A count in a ring for a day that owes something; today's is filled, the
  // way the reference marks the day you are standing on. minWidth rather than
  // width so a day owing ten or more grows into a pill instead of clipping.
  dueRing: {
    marginTop: 4,
    paddingHorizontal: 4,
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: RING_MUTED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dueRingHeavy: { borderColor: colors.blushDeep },
  dueRingToday: {
    backgroundColor: colors.blushDeep,
    borderColor: colors.blushDeep,
    shadowColor: colors.blushDeep,
    shadowOpacity: 0.35,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  dueRingText: { fontSize: 13, fontFamily: fonts.cozy, color: colors.blushDeep },
  dueRingTextToday: { color: colors.white },

  reviewCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.ms,
    marginHorizontal: SCREEN_PAD,
    marginTop: 12,
    paddingVertical: 17,
    borderRadius: radii.full,
    backgroundColor: colors.blushDeep,
    ...shadows.card,
  },
  reviewCtaText: { fontSize: 16, fontFamily: fonts.cozy, color: colors.white },

  weekdayRow: { flexDirection: 'row', marginBottom: 8 },
  weekdayCell: { flex: 1, alignItems: 'center' },
  weekdayText: { fontSize: 11, fontFamily: fonts.mono, color: colors.inkLight },

  monthViewport: { flex: 1, overflow: 'hidden', alignSelf: 'center' },
  monthTrack: { flexDirection: 'row' },
  gridRow: { flexDirection: 'row' },
  // Top-aligned, not centred: every cell's numeral has to sit on one line
  // across the row whether or not it carries a marker below it. Height is
  // applied at the call site — it's measured, not fixed.
  dayCell: { flex: 1, alignItems: 'center' },
  // Finds mode hangs nothing below the cell's first line, so its content sits
  // in the middle of the cell rather than under a marker slot it never uses.
  dayCellCentered: { justifyContent: 'center' },
  // Muted by default; a day only darkens once it actually carries something,
  // which is what gives the month its texture at a glance.
  dayNumber: { fontSize: 12, lineHeight: 16, fontFamily: fonts.mono, color: colors.inkLight },
  dayNumberMarked: { color: colors.inkDark, fontFamily: fonts.monoBold },
  dayNumberToday: { color: colors.blushDeep, fontFamily: fonts.monoBold },

  // Today, in both modes. It has to be the cell's *backdrop* rather than a
  // treatment of what's in the cell, because in Finds mode the day's sticker
  // photo replaces the numeral entirely — there is nothing left to recolour —
  // and in Reviews mode a day owing nothing draws no marker at all. Absolutely
  // positioned so it costs the row no width: insetting a flex: 1 cell would
  // hand its lost points to its six neighbours and walk the whole row off the
  // weekday header above it.
  todayBox: {
    position: 'absolute',
    left: 2,
    right: 2,
    top: 1,
    bottom: 1,
    borderRadius: radii.md,
    backgroundColor: '#FBF0F0',
    borderWidth: 1.5,
    borderColor: colors.blush,
  },

  dayIcon: { alignItems: 'center', justifyContent: 'center' },
  dayIconImage: { width: '100%', height: '100%' },
});
