import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, SafeAreaView, ScrollView, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Search, Settings } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/lib/supabase';
import { Sticker, Category } from '@/lib/types';
import { buildChapters, Chapter } from '@/lib/chapters';
import StickerCard from '@/components/StickerCard';
import StickerDetailView from '@/components/StickerDetailView';
import SettingsView from '@/components/SettingsView';
import ChapterCard from '@/components/ChapterCard';
import ChapterDetailView from '@/components/ChapterDetailView';
import StickerBoard from '@/components/StickerBoard';
import OtterMascot from '@/components/illustrations/OtterMascot';
import CozyBackground from '@/components/CozyBackground';
import { colors, shadows, radii, spacing, typography } from '@/constants/theme';

const CATEGORIES: Array<'All' | Category> = ['All', 'Kitchen', 'Animals', 'Study', 'Nature', 'Other'];

const VIEW_MODES = [
  { key: 'grid',       label: 'Grid'       },
  { key: 'story',      label: 'Story'      },
  { key: 'board',      label: 'Board'      },
  { key: 'challenges', label: 'Challenges' },
] as const;

type ViewMode = typeof VIEW_MODES[number]['key'];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function CollectionScreen() {
  const { user, signOut } = useAuth();
  const { profile, setTargetLanguage } = useProfile(user?.id);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'All' | Category>('All');
  const [selectedSticker, setSelectedSticker] = useState<Sticker | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [openChapter, setOpenChapter] = useState<Chapter | null>(null);

  const fetchStickers = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('stickers')
      .select('*')
      .eq('user_id', user.id)
      .order('discovered_at', { ascending: false });

    if (!error && data) setStickers(data as Sticker[]);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => { fetchStickers(); }, [fetchStickers]);
  useFocusEffect(useCallback(() => { fetchStickers(); }, [fetchStickers]));

  const onRefresh = () => { setRefreshing(true); fetchStickers(); };

  const filtered = viewMode === 'challenges'
    ? stickers.filter(s => s.source === 'challenge')
    : activeCategory === 'All'
      ? stickers
      : stickers.filter(s => s.category === activeCategory);

  const chapters = useMemo(() => buildChapters(stickers), [stickers]);

  const username = profile?.username ?? 'Explorer';

  return (
    <CozyBackground variant="strip">
      <SafeAreaView style={styles.safeArea}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{username[0]?.toUpperCase() ?? 'E'}</Text>
            </View>
            <View>
              <Text style={styles.greeting}>{getGreeting()},</Text>
              <Text style={styles.username}>{username}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setSettingsOpen(true)} style={styles.iconBtn} hitSlop={8}>
            <Settings size={20} color={colors.inkMid} />
          </TouchableOpacity>
        </View>

        {/* ── Stats strip ── */}
        <View style={styles.statsRow}>
          <Text style={styles.statsCount}>{stickers.length}</Text>
          <Text style={styles.statsLabel}> stickers collected</Text>
        </View>

        {/* ── View mode pills ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pillScroll}
          contentContainerStyle={styles.pillContent}
        >
          {VIEW_MODES.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.chip, viewMode === key && styles.chipActive]}
              onPress={() => setViewMode(key)}
            >
              <Text style={[styles.chipText, viewMode === key && styles.chipTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Category filter (grid mode only) ── */}
        {viewMode === 'grid' && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.pillScroll}
            contentContainerStyle={styles.pillContent}
          >
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, styles.chipAlt, activeCategory === cat && styles.chipAltActive]}
                onPress={() => setActiveCategory(cat)}
              >
                <Text style={[styles.chipText, activeCategory === cat && styles.chipTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* ── Content ── */}
        {loading ? (
          <ActivityIndicator style={styles.loader} color={colors.terra} size="large" />
        ) : viewMode === 'grid' || viewMode === 'challenges' ? (
          filtered.length === 0 ? (
            <EmptyState
              title={viewMode === 'challenges' ? 'No challenge wins yet' : 'No stickers yet'}
              subtitle={viewMode === 'challenges'
                ? 'Stickers you win from friend challenges appear here.'
                : 'Tap the Scan tab to discover your first word!'}
            />
          ) : (
            <FlatList
              key={viewMode}
              data={filtered}
              keyExtractor={s => s.id}
              numColumns={2}
              columnWrapperStyle={styles.row}
              contentContainerStyle={styles.grid}
              renderItem={({ item }) => (
                <View style={styles.cardWrapper}>
                  <StickerCard sticker={item} onPress={() => setSelectedSticker(item)} />
                </View>
              )}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.terra} />
              }
            />
          )
        ) : viewMode === 'story' ? (
          chapters.length === 0 ? (
            <EmptyState title="No stickers yet" subtitle="Tap the Scan tab to discover your first word!" />
          ) : (
            <FlatList
              key="story"
              data={chapters}
              keyExtractor={c => c.key}
              contentContainerStyle={styles.chapterList}
              renderItem={({ item }) => (
                <ChapterCard chapter={item} onPress={() => setOpenChapter(item)} />
              )}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.terra} />
              }
            />
          )
        ) : (
          <StickerBoard chapters={chapters} onSelectSticker={setSelectedSticker} />
        )}

        <ChapterDetailView
          chapter={openChapter}
          onClose={() => setOpenChapter(null)}
          onSelectSticker={setSelectedSticker}
        />

        <StickerDetailView
          sticker={selectedSticker}
          onClose={() => setSelectedSticker(null)}
          onDelete={() => { setSelectedSticker(null); fetchStickers(); }}
        />

        <SettingsView
          visible={settingsOpen}
          profile={profile}
          onClose={() => setSettingsOpen(false)}
          onChangeLanguage={setTargetLanguage}
        />
      </SafeAreaView>
    </CozyBackground>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.empty}>
      <OtterMascot size={100} variant="small" />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.terra,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.cardWarm,
  },
  avatarText: { color: colors.card, fontSize: 16, fontWeight: '800' },
  greeting: { fontSize: 12, fontWeight: '500', color: colors.inkLight },
  username: { fontSize: 16, fontWeight: '800', color: colors.inkDark },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  statsCount: { fontSize: 28, fontWeight: '800', color: colors.inkDark },
  statsLabel: { fontSize: 14, fontWeight: '500', color: colors.inkLight },

  pillScroll: { flexGrow: 0, flexShrink: 0, marginBottom: spacing.xs },
  pillContent: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xs, gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.terra, borderColor: colors.terra },
  chipAlt: { backgroundColor: colors.sky, borderColor: colors.borderLight },
  chipAltActive: { backgroundColor: colors.terra, borderColor: colors.terra },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.inkMid },
  chipTextActive: { color: colors.card },

  loader: { marginTop: spacing.xxl },

  grid: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl, paddingTop: spacing.sm },
  row: { gap: spacing.sm, marginBottom: spacing.sm },
  cardWrapper: { flex: 1 },
  chapterList: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  emptyTitle: { ...typography.h3, textAlign: 'center' },
  emptySubtitle: { ...typography.body, textAlign: 'center', color: colors.inkLight },
});
