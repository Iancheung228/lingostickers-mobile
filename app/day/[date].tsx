import { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Sticker } from '@/lib/types';
import { useSignedUrls } from '@/hooks/useSignedUrls';
import StickerCard from '@/components/StickerCard';
import StudyCard from '@/components/StudyCard';
import SettingsButton from '@/components/SettingsButton';
import { colors, shadows, radii, spacing, fonts } from '@/constants/theme';

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

export default function DayScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const { user } = useAuth();
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedSticker, setSelectedSticker] = useState<Sticker | null>(null);

  const fetchStickers = useCallback(async () => {
    // Returning without lowering `loading` would leave this screen spinning
    // forever on a malformed link — the one path that can reach it without a
    // date in hand.
    if (!user || !date) { setLoading(false); return; }
    // date is a local-time "YYYY-MM-DD" key — bound the query to that local
    // day's start/end so it matches how the calendar bucketed stickers.
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const { data, error } = await supabase
      .from('stickers')
      .select('*')
      .eq('user_id', user.id)
      .gte('discovered_at', dayStart.toISOString())
      .lt('discovered_at', dayEnd.toISOString())
      .order('discovered_at', { ascending: false });
    if (error) {
      setLoadError(true);
    } else if (data) {
      setLoadError(false);
      setStickers(data as Sticker[]);
    }
    setLoading(false);
  }, [user, date]);

  useFocusEffect(useCallback(() => { fetchStickers(); }, [fetchStickers]));

  const patchSticker = useCallback((id: string, patch: Partial<Sticker>) => {
    setStickers(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
    setSelectedSticker(prev => prev && prev.id === id ? { ...prev, ...patch } : prev);
  }, []);

  // The same optimistic toggle the collection grid uses. This grid draws the
  // identical card, and a heart that appears on one screen and not the other
  // reads as the button having gone missing rather than as a deliberate
  // difference between two views of the same sticker.
  const handleToggleFavorite = useCallback(async (id: string) => {
    const target = stickers.find(s => s.id === id);
    if (!target) return;
    const next = !target.is_favorite;
    patchSticker(id, { is_favorite: next });
    const { error } = await supabase.from('stickers').update({ is_favorite: next }).eq('id', id);
    if (error) patchSticker(id, { is_favorite: !next });
  }, [stickers, patchSticker]);

  // One batched sign request for the whole day's grid — see
  // hooks/useSignedUrls.ts.
  const urls = useSignedUrls(useMemo(
    () => stickers.flatMap(s => [s.image_path, s.voice_note_path]),
    [stickers]
  ));

  const formattedDate = useMemo(() => {
    if (!date) return '';
    return DATE_FORMAT.format(new Date(`${date}T00:00:00`));
  }, [date]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={18} color={colors.inkMid} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>{formattedDate}</Text>
          <Text style={styles.subtitle}>
            {loadError ? "couldn't load this day" : `${stickers.length} captured`}
          </Text>
        </View>
        <SettingsButton />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.terra} size="large" />
      ) : loadError ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorTitle}>Couldn&apos;t load this day</Text>
          <Text style={styles.errorBody}>
            Nothing has been lost. Check your connection and try again.
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={fetchStickers}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Try loading this day again"
          >
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={stickers}
          keyExtractor={s => s.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          // Reachable by deleting the last sticker of a day from the card
          // that opens out of this very grid: the list emptied and the screen
          // went blank under a header still offering to go back, with nothing
          // saying what had happened.
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.errorTitle}>Nothing left on this day</Text>
              <Text style={styles.errorBody}>
                Every sticker found on this date has been deleted.
              </Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => router.back()}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Back to the calendar"
              >
                <Text style={styles.retryText}>Back to calendar</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              <StickerCard
                sticker={item}
                onPress={() => setSelectedSticker(item)}
                onToggleFavorite={handleToggleFavorite}
                imageUrl={urls.get(item.image_path) ?? null}
                voiceUrl={item.voice_note_path ? urls.get(item.voice_note_path) ?? null : null}
              />
            </View>
          )}
        />
      )}

      <StudyCard
        sticker={selectedSticker}
        onClose={() => setSelectedSticker(null)}
        onDeleted={() => { setSelectedSticker(null); fetchStickers(); }}
        onUpdate={patchSticker}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sky },
  headerText: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  title: { fontSize: 15, fontFamily: fonts.display, color: colors.inkDark },
  subtitle: { fontSize: 10, fontFamily: fonts.mono, color: colors.inkFaint, marginTop: 1 },
  loader: { flex: 1 },
  // Not `errorWrap`: that one is a whole-screen replacement and uses flex:1,
  // which collapses to nothing inside a list's content container.
  emptyWrap: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    gap: spacing.ms,
  },
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.ms,
  },
  errorTitle: { fontSize: 17, fontFamily: fonts.display, color: colors.inkDark, textAlign: 'center' },
  errorBody: { fontSize: 14, fontFamily: fonts.text, color: colors.inkLight, textAlign: 'center', lineHeight: 20 },
  retryBtn: {
    marginTop: spacing.xs,
    backgroundColor: colors.terra,
    borderRadius: radii.lg,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    ...shadows.button,
  },
  retryText: { color: colors.white, fontSize: 14, fontFamily: fonts.display, letterSpacing: 0.3 },
  grid: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl, paddingTop: spacing.sm },
  row: { gap: spacing.sm, marginBottom: spacing.sm },
  cardWrapper: { flex: 1 },
});
