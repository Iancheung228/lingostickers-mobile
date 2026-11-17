import { useCallback, useMemo, useState } from 'react';
import { usePendingDeletes } from '@/components/PendingDeleteProvider';
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Heart, MapPin } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Sticker } from '@/lib/types';
import { useSignedUrls } from '@/hooks/useSignedUrls';
import { listImagePath } from '@/lib/thumbnails';
import StickerImageFallback from '@/components/StickerImageFallback';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import RoseBand from '@/components/RoseBand';
import { useToast } from '@/components/ToastProvider';
import { haptic } from '@/lib/haptics';
import StudyCard from '@/components/StudyCard';
import StudySessionHost from '@/components/StudySessionHost';
import { fonts, radii, wordFontFor, MIN_TAP } from '@/constants/theme';
import { useTheme, useThemedStyles, type Theme } from '@/hooks/useTheme';

// Short enough for the band's one-line 30pt title.
const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'long', day: 'numeric' });

export default function DayScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { date } = useLocalSearchParams<{ date: string }>();
  const { user } = useAuth();
  const [fetchedStickers, setStickers] = useState<Sticker[]>([]);
  // A card being deleted (undo window, or already gone) must not come back with
  // a refetch: every list filters through the provider's pendingDeleteIds.
  const { pendingDeleteIds } = usePendingDeletes();
  const stickers = useMemo(
    () => (pendingDeleteIds.size ? fetchedStickers.filter(s => !pendingDeleteIds.has(s.id)) : fetchedStickers),
    [fetchedStickers, pendingDeleteIds],
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedSticker, setSelectedSticker] = useState<Sticker | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [practiceQueue, setPracticeQueue] = useState<Sticker[] | null>(null);
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const fetchStickers = useCallback(async () => {
    // Returning without lowering `loading` would leave this screen spinning
    // forever on a malformed link — the one path that can reach it without a
    // date in hand.
    if (!user || !date) { setLoading(false); return; }
    // date is a local-time "YYYY-MM-DD" key — bound the query to that local
    // day's start/end so it matches how the calendar bucketed stickers.
    const dayStart = new Date(`${date}T00:00:00`);
    // A malformed link would make toISOString() throw below: show the error state.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(dayStart.getTime())) {
      setLoadError(true); setLoading(false); setRefreshing(false); return;
    }
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const { data, error } = await supabase
      .from('stickers')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', dayStart.toISOString())
      .lt('created_at', dayEnd.toISOString())
      .order('created_at', { ascending: false });
    if (error) {
      setLoadError(true);
    } else if (data) {
      setLoadError(false);
      setStickers(data as Sticker[]);
    }
    setLoading(false);
    setRefreshing(false);
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
    haptic.tap();
    patchSticker(id, { is_favorite: next });
    const { error } = await supabase.from('stickers').update({ is_favorite: next }).eq('id', id);
    if (error) {
      patchSticker(id, { is_favorite: !next });
      toast.show({ kind: 'error', message: "Couldn't update the favourite. Try again." });
    }
  }, [stickers, patchSticker, toast]);

  // One batched sign request for the whole day's grid — see
  // hooks/useSignedUrls.ts.
  const urls = useSignedUrls(useMemo(
    () => stickers.map(listImagePath),
    [stickers]
  ));

  const formattedDate = useMemo(() => {
    if (!date) return '';
    return DATE_FORMAT.format(new Date(`${date}T00:00:00`));
  }, [date]);

  return (
    <View style={styles.container}>
      <RoseBand
        title={formattedDate}
        leading={
          <IconButton onPress={() => router.back()} label="Go back">
            <ChevronLeft size={22} strokeWidth={1.75} color={colors.inkDark} />
          </IconButton>
        }
      />

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.terraInk} size="large" />
      ) : loadError ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorTitle}>Couldn&apos;t load this day</Text>
          <Text style={styles.errorBody}>Nothing has been lost. Check your connection and try again.</Text>
          <Button label="Try again" onPress={fetchStickers} />
        </View>
      ) : (
        <FlatList
          data={stickers}
          ListHeaderComponent={
            <View style={styles.headerRow}>
              <Text style={styles.count} maxFontSizeMultiplier={2}>{`${stickers.length} found`}</Text>
              {stickers.length > 0 && (
                <Pressable
                  testID="practice-day"
                  onPress={() => { haptic.tap(); setPracticeQueue(stickers); }}
                  style={({ pressed }) => [styles.practiceBtn, pressed && { backgroundColor: colors.terraLight }]}
                  accessibilityRole="button"
                  accessibilityLabel="Practice this day"
                  accessibilityHint="Quiz these cards without changing your review schedule"
                >
                  <Text style={styles.practiceText} maxFontSizeMultiplier={1.4}>Practice this day</Text>
                </Pressable>
              )}
            </View>
          }
          keyExtractor={s => s.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 32 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchStickers(); }} tintColor={colors.terraInk} />}
          // Reachable by deleting the last sticker of a day from the card that
          // opens out of this very list.
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.errorTitle}>Nothing left on this day</Text>
              <Text style={styles.errorBody}>Every sticker found on this date has been deleted.</Text>
              <Button label="Back to calendar" onPress={() => router.back()} />
            </View>
          }
          renderItem={({ item }) => {
            const url = urls.get(listImagePath(item) ?? '') ?? null;
            const fav = !!item.is_favorite;
            return (
              <Pressable
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                onPress={() => setSelectedSticker(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.word}, ${item.translation}`}
                accessibilityActions={[{ name: 'favourite', label: fav ? 'Remove from favourites' : 'Add to favourites' }]}
                onAccessibilityAction={e => { if (e.nativeEvent.actionName === 'favourite') handleToggleFavorite(item.id); }}
              >
                <View style={styles.well}>
                  <View style={styles.stk}>
                    {url ? (
                      <Image
                        source={{ uri: url, cacheKey: listImagePath(item) ?? undefined }}
                        cachePolicy="memory-disk"
                        style={styles.img}
                        contentFit="contain"
                      />
                    ) : (
                      <StickerImageFallback sticker={item} size={56} />
                    )}
                  </View>
                  <Pressable onPress={() => handleToggleFavorite(item.id)} style={styles.heart} accessible={false} importantForAccessibility="no">
                    <Heart size={20} strokeWidth={1.75} color={colors.terraInk} fill={fav ? colors.terra : 'transparent'} />
                  </Pressable>
                </View>
                <View style={styles.text}>
                  <Text style={[styles.word, { fontFamily: wordFontFor(item.language) }]} numberOfLines={2} maxFontSizeMultiplier={1.3}>{item.word}</Text>
                  <Text style={styles.meaning} maxFontSizeMultiplier={2}>{item.translation}</Text>
                  {!!item.notes?.trim() && <Text style={styles.note} maxFontSizeMultiplier={2}>{item.notes.trim()}</Text>}
                  {!!item.location_label && (
                    <View style={styles.place}>
                      <MapPin size={14} strokeWidth={1.75} color={colors.inkLight} />
                      <Text style={styles.placeText} numberOfLines={1} maxFontSizeMultiplier={2}>{item.location_label}</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <StudyCard
        sticker={selectedSticker}
        onClose={() => setSelectedSticker(null)}
        onDeleted={() => { setSelectedSticker(null); fetchStickers(); }}
        onUpdate={patchSticker}
        onTest={sticker => {
          setSelectedSticker(null);
          // Present the practice Modal only once the browse Modal has left.
          setTimeout(() => setPracticeQueue([sticker]), 400);
        }}
      />

      <StudySessionHost
        queue={practiceQueue}
        mode="practice"
        onExit={() => setPracticeQueue(null)}
        onUpdate={patchSticker}
      />
    </View>
  );
}

const makeStyles = ({ colors, type, e1, stickerShadow }: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sky },
  count: { ...type.small, marginBottom: 0 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  practiceBtn: {
    minHeight: MIN_TAP, paddingHorizontal: 16, borderRadius: radii.full, borderWidth: 1.5, borderColor: colors.terra,
    alignItems: 'center', justifyContent: 'center',
  },
  practiceText: { ...type.button, fontSize: 14, color: colors.terraInk },
  loader: { flex: 1 },
  emptyWrap: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 48, gap: 12 },
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  errorTitle: { ...type.h2, textAlign: 'center' },
  errorBody: { ...type.body, color: colors.inkLight, textAlign: 'center' },
  list: { paddingHorizontal: 20, paddingTop: 16, gap: 16 },
  card: { backgroundColor: colors.card, borderRadius: radii.lg, overflow: 'hidden', ...e1 },
  pressed: { opacity: 0.94 },
  well: { height: 200, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  stk: { width: '62%', height: '80%', ...stickerShadow },
  img: { width: '100%', height: '100%' },
  heart: { position: 'absolute', top: 4, right: 4, width: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center' },
  text: { padding: 16, gap: 4 },
  word: { fontSize: 30, lineHeight: 38, color: colors.inkDark },
  meaning: { ...type.h2, color: colors.inkMid },
  note: { ...type.body, color: colors.inkMid, marginTop: 4 },
  place: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  placeText: { ...type.small, flexShrink: 1 },
});
