import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing, runOnJS } from 'react-native-reanimated';
import { Settings } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useSignedUrls } from '@/hooks/useSignedUrls';
import { Sticker } from '@/lib/types';
import { colors, spacing, fonts } from '@/constants/theme';
import { TAB_BAR_CLEARANCE } from '@/constants/tabBar';

// Sunday-start week, matching the minimal-journal reference layout (the
// rest of the app doesn't otherwise commit to a week-start convention).
const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'long' });

// Local-time date key (not UTC) so a sticker captured at 11pm doesn't get
// bucketed into the next day.
function dateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
  const [viewedMonth, setViewedMonth] = useState(() => new Date());

  const { width: screenWidth } = useWindowDimensions();
  const pageWidth = screenWidth - spacing.lg * 2;

  const fetchStickers = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('stickers')
      .select('*')
      .eq('user_id', user.id)
      .order('discovered_at', { ascending: false });
    if (!error && data) setStickers(data as Sticker[]);
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

  const renderHeaderPage = (monthDate: Date) => (
    <View style={[styles.headerPage, { width: pageWidth }]}>
      <Text style={styles.yearText}>{monthDate.getFullYear()}</Text>
      <Text style={styles.monthText}>{MONTH_FORMAT.format(monthDate)}</Text>
    </View>
  );

  const renderMonthPage = (rows: MonthCell[][]) => (
    <View style={{ width: pageWidth }}>
      {rows.map((row, rowIdx) => (
        <View key={rowIdx} style={styles.gridRow}>
          {row.map((cell, i) => {
            if (!cell) return <View key={i} style={styles.dayCell} />;
            const dayStickers = stickersByDate.get(cell.key) ?? [];
            const isToday = cell.key === todayKey;
            return (
              <TouchableOpacity
                key={i}
                style={styles.dayCell}
                onPress={() => router.push(`/day/${cell.key}`)}
                disabled={dayStickers.length === 0}
                activeOpacity={0.7}
              >
                {dayStickers.length > 0 ? (
                  <DayIcon
                    sticker={dayStickers[0]}
                    size={pageWidth / 7 - 18}
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.push('/profile')} style={styles.iconBtn} hitSlop={10}>
          <Settings size={20} color={colors.charcoal} />
        </TouchableOpacity>
      </View>

      <View style={[styles.headerViewport, { width: pageWidth }]}>
        <Animated.View style={[styles.headerTrack, { width: pageWidth * 3 }, trackStyle]}>
          {renderHeaderPage(prevMonth)}
          {renderHeaderPage(viewedMonth)}
          {renderHeaderPage(nextMonth)}
        </Animated.View>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label, i) => (
          <View key={i} style={styles.weekdayCell}>
            <Text style={styles.weekdayText}>{label}</Text>
          </View>
        ))}
      </View>

      <GestureDetector gesture={monthSwipeGesture}>
        <View style={[styles.monthViewport, { width: pageWidth }]}>
          <Animated.View style={[styles.monthTrack, { width: pageWidth * 3 }, trackStyle]}>
            {renderMonthPage(prevRows)}
            {renderMonthPage(currentRows)}
            {renderMonthPage(nextRows)}
          </Animated.View>
        </View>
      </GestureDetector>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sky, paddingBottom: TAB_BAR_CLEARANCE },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  iconBtn: { padding: spacing.xs },

  headerViewport: { overflow: 'hidden', alignSelf: 'center', paddingTop: spacing.lg, paddingBottom: spacing.xl },
  headerTrack: { flexDirection: 'row' },
  headerPage: { alignItems: 'center' },
  yearText: { fontSize: 15, fontFamily: fonts.mono, color: colors.inkLight },
  monthText: { fontSize: 26, fontFamily: fonts.monoBold, color: colors.charcoal, marginTop: 2 },

  weekdayRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  weekdayCell: { flex: 1, alignItems: 'center' },
  weekdayText: { fontSize: 12, fontFamily: fonts.mono, color: colors.inkFaint },

  monthViewport: { overflow: 'hidden', alignSelf: 'center' },
  monthTrack: { flexDirection: 'row' },
  gridRow: { flexDirection: 'row', marginBottom: spacing.lg },
  dayCell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayNumber: { fontSize: 15, fontFamily: fonts.mono, color: colors.charcoal },
  dayNumberToday: { color: colors.rust, fontFamily: fonts.monoBold },

  dayIcon: { alignItems: 'center', justifyContent: 'center' },
  dayIconImage: { width: '100%', height: '100%' },
});
