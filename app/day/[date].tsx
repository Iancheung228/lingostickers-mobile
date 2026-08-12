import { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Sticker } from '@/lib/types';
import { useSignedUrls } from '@/hooks/useSignedUrls';
import StickerCard from '@/components/StickerCard';
import StickerDetailView from '@/components/StickerDetailView';
import { colors, shadows, radii, spacing, fonts } from '@/constants/theme';

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

export default function DayScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const { user } = useAuth();
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSticker, setSelectedSticker] = useState<Sticker | null>(null);

  const fetchStickers = useCallback(async () => {
    if (!user || !date) return;
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
    if (!error && data) setStickers(data as Sticker[]);
    setLoading(false);
  }, [user, date]);

  useFocusEffect(useCallback(() => { fetchStickers(); }, [fetchStickers]));

  const patchSticker = useCallback((id: string, patch: Partial<Sticker>) => {
    setStickers(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
    setSelectedSticker(prev => prev && prev.id === id ? { ...prev, ...patch } : prev);
  }, []);

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
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <ArrowLeft size={18} color={colors.inkMid} />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>{formattedDate}</Text>
          <Text style={styles.subtitle}>{stickers.length} captured</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.terra} size="large" />
      ) : (
        <FlatList
          data={stickers}
          keyExtractor={s => s.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              <StickerCard
                sticker={item}
                onPress={() => setSelectedSticker(item)}
                imageUrl={urls.get(item.image_path) ?? null}
                voiceUrl={item.voice_note_path ? urls.get(item.voice_note_path) ?? null : null}
              />
            </View>
          )}
        />
      )}

      <StickerDetailView
        sticker={selectedSticker}
        onClose={() => setSelectedSticker(null)}
        onDelete={() => { setSelectedSticker(null); fetchStickers(); }}
        onUpdate={patchSticker}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sky },
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
  title: { fontSize: 15, fontFamily: fonts.cozy, color: colors.inkDark },
  subtitle: { fontSize: 10, color: colors.inkFaint, fontWeight: '600', marginTop: 1 },
  loader: { flex: 1 },
  grid: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl, paddingTop: spacing.sm },
  row: { gap: spacing.sm, marginBottom: spacing.sm },
  cardWrapper: { flex: 1 },
});
