import { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/lib/supabase';
import { Sticker } from '@/lib/types';
import DayStack from '@/components/DayStack';
import { colors, shadows, radii, spacing, fonts } from '@/constants/theme';

const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTH_YEAR_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const DAY_LABEL_FORMAT = new Intl.DateTimeFormat('en-US', { weekday: 'short' });

// Local-time date key (not UTC) so a sticker captured at 11pm doesn't get
// bucketed into the next day — mirrors the same simplification lib/chapters.ts
// already makes for date-range formatting.
function dateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CalendarScreen() {
  const { user } = useAuth();
  const { profile, refetch: refetchProfile } = useProfile(user?.id);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewedMonth, setViewedMonth] = useState(() => new Date());

  // Sticker-graphic size hint only — the cell box itself is sized by CSS
  // (percentage width + aspectRatio, same as the weekday header row) so it
  // can never drift out of sync with the header and wrap early. A JS-computed
  // pixel width applied per-cell previously caused exactly that: rounding
  // pushed 7 cells just past the row's real width, so flexWrap silently
  // dropped the 7th cell (Sunday) to the next line every week.
  const { width: screenWidth } = useWindowDimensions();
  const monthStackSize = (screenWidth - spacing.md * 4) / 7 - 8;

  const fetchStickers = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('stickers')
      .select('*')
      .eq('user_id', user.id)
      .order('discovered_at', { ascending: false });
    if (!error && data) setStickers(data as Sticker[]);
    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => { fetchStickers(); refetchProfile(); }, [fetchStickers, refetchProfile]));

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

  const today = useMemo(() => new Date(), []);
  const todayKey = dateKey(today.toISOString());

  // Rolling 7-day strip ending today.
  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push(d);
    }
    return days;
  }, [today]);

  // Viewed month's grid, Monday-start — browsable via prev/next, independent
  // of "today" (which only matters for highlighting the current day).
  const monthCells = useMemo(() => {
    const year = viewedMonth.getFullYear();
    const month = viewedMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // 0=Mon
    const cells: Array<{ day: number; key: string } | null> = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({ day, key: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` });
    }
    return cells;
  }, [viewedMonth]);

  const capturedInViewedMonth = useMemo(() => {
    const year = viewedMonth.getFullYear();
    const month = viewedMonth.getMonth();
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    return stickers.filter(s => dateKey(s.discovered_at).startsWith(prefix)).length;
  }, [stickers, viewedMonth]);

  const isCurrentMonth = viewedMonth.getFullYear() === today.getFullYear() && viewedMonth.getMonth() === today.getMonth();

  const goToPrevMonth = () => setViewedMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const goToNextMonth = () => setViewedMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📅 Cozy Stamp Calendar</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.terra} size="large" />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollBody}>
          {/* This week strip */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>This Week</Text>
              <Text style={styles.cardMeta}>{stickers.length} total</Text>
            </View>
            <View style={styles.weekRow}>
              {weekDays.map((d) => {
                const key = dateKey(d.toISOString());
                const dayStickers = stickersByDate.get(key) ?? [];
                const isToday = key === todayKey;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.weekCell, isToday && styles.weekCellToday]}
                    onPress={() => router.push(`/day/${key}`)}
                    disabled={dayStickers.length === 0}
                    activeOpacity={0.8}
                  >
                    {dayStickers.length > 0 ? (
                      <DayStack
                        stickers={dayStickers}
                        size={38}
                        displayStyle={profile?.wall_display_style}
                        borderStyle={profile?.cutout_border_style}
                      />
                    ) : (
                      <Text style={[styles.weekDayNum, isToday && styles.weekDayNumToday]}>{d.getDate()}</Text>
                    )}
                    <Text style={styles.weekDayLabel}>{DAY_LABEL_FORMAT.format(d)[0]}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Full month grid */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.monthNavGroup}>
                <TouchableOpacity onPress={goToPrevMonth} hitSlop={8} style={styles.monthNavBtn}>
                  <ChevronLeft size={16} color={colors.inkMid} />
                </TouchableOpacity>
                <Text style={styles.cardTitle}>{MONTH_YEAR_FORMAT.format(viewedMonth)}</Text>
                <TouchableOpacity
                  onPress={goToNextMonth}
                  hitSlop={8}
                  style={styles.monthNavBtn}
                  disabled={isCurrentMonth}
                >
                  <ChevronRight size={16} color={isCurrentMonth ? colors.borderLight : colors.inkMid} />
                </TouchableOpacity>
              </View>
              <Text style={styles.cardMeta}>{capturedInViewedMonth} captured</Text>
            </View>
            <View style={styles.weekdayHeaderRow}>
              {WEEKDAY_LABELS.map((label, i) => (
                <View key={i} style={styles.weekdayHeaderCell}>
                  <Text style={styles.weekdayHeaderText}>{label}</Text>
                </View>
              ))}
            </View>
            <View style={styles.monthGrid}>
              {monthCells.map((cell, i) => {
                if (!cell) return <View key={i} style={styles.monthCell} />;
                const dayStickers = stickersByDate.get(cell.key) ?? [];
                const isToday = cell.key === todayKey;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.monthCell, isToday && styles.monthCellToday]}
                    onPress={() => router.push(`/day/${cell.key}`)}
                    disabled={dayStickers.length === 0}
                    activeOpacity={0.8}
                  >
                    {dayStickers.length > 0 ? (
                      <DayStack
                        stickers={dayStickers}
                        size={monthStackSize}
                        displayStyle={profile?.wall_display_style}
                        borderStyle={profile?.cutout_border_style}
                      />
                    ) : (
                      <Text style={[styles.monthDayNum, isToday && styles.weekDayNumToday]}>{cell.day}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {stickers.length === 0 && (
            <Text style={styles.emptyHint}>
              🌸 No captures yet — scan an object to start filling in your calendar!
            </Text>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sky },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: { fontSize: 15, fontFamily: fonts.cozy, color: colors.inkDark },
  loader: { flex: 1 },

  scrollBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: spacing.md,
    ...shadows.card,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm + 4 },
  cardTitle: { fontSize: 13, fontFamily: fonts.cozy, color: colors.inkDark },
  cardMeta: { fontSize: 10, fontWeight: '700', color: colors.inkFaint },
  monthNavGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  monthNavBtn: { padding: 2 },

  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weekCell: {
    width: 46,
    height: 62,
    borderRadius: radii.md,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  weekCellToday: { borderWidth: 1.5, borderColor: colors.inkDark },
  weekDayNum: { fontSize: 14, fontFamily: fonts.mono, color: colors.inkMid },
  weekDayNumToday: { color: colors.inkDark, fontWeight: '800' },
  weekDayLabel: { fontSize: 9, fontWeight: '700', color: colors.inkFaint, textTransform: 'uppercase' },

  weekdayHeaderRow: { flexDirection: 'row', marginBottom: spacing.sm + 4 },
  weekdayHeaderCell: { width: `${100 / 7}%`, alignItems: 'center' },
  weekdayHeaderText: { fontSize: 10, fontWeight: '800', color: colors.inkFaint, textTransform: 'uppercase' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  monthCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  monthCellToday: { borderWidth: 1.5, borderColor: colors.inkDark, borderRadius: radii.md },
  monthDayNum: { fontSize: 13, fontFamily: fonts.mono, color: colors.inkMid },

  emptyHint: { textAlign: 'center', color: colors.inkFaint, fontSize: 12, marginTop: spacing.lg, paddingHorizontal: spacing.lg },
});
