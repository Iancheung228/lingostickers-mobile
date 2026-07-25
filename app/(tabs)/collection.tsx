import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, SafeAreaView, ScrollView, ActivityIndicator, Modal, Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, router } from 'expo-router';
import { Settings, Heart, ArrowUpDown, Check } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/lib/supabase';
import { Sticker, Category } from '@/lib/types';
import { buildChapters, Chapter } from '@/lib/chapters';
import StickerCard from '@/components/StickerCard';
import StickerDetailView from '@/components/StickerDetailView';
import ChapterCard from '@/components/ChapterCard';
import ChapterDetailView from '@/components/ChapterDetailView';
import MiniStickerWall from '@/components/MiniStickerWall';
import OtterMascot from '@/components/illustrations/OtterMascot';
import { colors, shadows, radii, spacing, typography, fonts } from '@/constants/theme';
import { TAB_BAR_CLEARANCE } from '@/constants/tabBar';

const CATEGORIES: Array<'All' | Category> = ['All', 'Kitchen', 'Animals', 'Study', 'Nature', 'Other'];

const VIEW_MODES = [
  { key: 'grid',       label: 'Grid'       },
  { key: 'story',      label: 'Story'      },
  { key: 'challenges', label: 'Challenges' },
] as const;

type ViewMode = typeof VIEW_MODES[number]['key'];

// 'newest'/'oldest' sort by discovered_at (when the memory happened —
// backdated to the photo's own date on import). 'recentlyAdded' sorts by
// created_at (when it actually landed in your collection) instead, for
// people who want to see today's imports at the top regardless of how old
// the photo itself is.
type SortMode = 'newest' | 'oldest' | 'recentlyAdded';
const SORT_CYCLE: SortMode[] = ['newest', 'oldest', 'recentlyAdded'];
const SORT_LABELS: Record<SortMode, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  recentlyAdded: 'Recently added',
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function CollectionScreen() {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'All' | Category>('All');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [selectedSticker, setSelectedSticker] = useState<Sticker | null>(null);
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

  // Applies to both the sticker in the list and the currently-open detail
  // view, so a favorite toggle or notes edit is reflected everywhere at
  // once — see skills.md #1, two independent copies of the same data
  // drifting apart otherwise.
  const patchSticker = useCallback((id: string, patch: Partial<Sticker>) => {
    setStickers(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
    setSelectedSticker(prev => prev && prev.id === id ? { ...prev, ...patch } : prev);
  }, []);

  const handleToggleFavorite = useCallback(async (id: string) => {
    const target = stickers.find(s => s.id === id);
    if (!target) return;
    const next = !target.is_favorite;
    patchSticker(id, { is_favorite: next });
    const { error } = await supabase.from('stickers').update({ is_favorite: next }).eq('id', id);
    if (error) patchSticker(id, { is_favorite: !next });
  }, [stickers, patchSticker]);

  let filtered = viewMode === 'challenges'
    ? stickers.filter(s => s.source === 'challenge')
    : activeCategory === 'All'
      ? stickers
      : stickers.filter(s => s.category === activeCategory);
  if (viewMode === 'grid' && favoritesOnly) filtered = filtered.filter(s => s.is_favorite);
  if (viewMode === 'grid' || viewMode === 'challenges') {
    const field = sortMode === 'recentlyAdded' ? 'created_at' : 'discovered_at';
    filtered = [...filtered].sort((a, b) => {
      const diff = new Date(a[field]).getTime() - new Date(b[field]).getTime();
      return sortMode === 'oldest' ? diff : -diff;
    });
  }

  const chapters = useMemo(() => buildChapters(stickers), [stickers]);

  const username = profile?.username ?? 'Explorer';

  return (
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
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => router.push('/profile')} style={styles.iconBtn} hitSlop={8}>
            <Settings size={18} color={colors.inkMid} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Mini sticker wall preview ── */}
      <MiniStickerWall stickers={stickers} />

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

      {/* ── Category + favorites filter (grid mode only) ── */}
      {viewMode === 'grid' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pillScroll}
          contentContainerStyle={styles.pillContent}
        >
          <TouchableOpacity
            style={[styles.chip, styles.chipAlt]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSortMode(m => SORT_CYCLE[(SORT_CYCLE.indexOf(m) + 1) % SORT_CYCLE.length]);
            }}
            onLongPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setSortMenuVisible(true);
            }}
            delayLongPress={350}
          >
            <ArrowUpDown size={11} color={colors.inkMid} />
            <Text style={styles.chipText}>{SORT_LABELS[sortMode]}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, styles.chipAlt, favoritesOnly && styles.chipFavoriteActive]}
            onPress={() => setFavoritesOnly(f => !f)}
          >
            <Heart size={11} color={favoritesOnly ? colors.white : colors.error} fill={favoritesOnly ? colors.white : 'transparent'} />
            <Text style={[styles.chipText, favoritesOnly && styles.chipTextActive]}>Favorites</Text>
          </TouchableOpacity>
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
              : favoritesOnly
                ? 'Tap the heart on a sticker to favorite it!'
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
                <StickerCard sticker={item} onPress={() => setSelectedSticker(item)} onToggleFavorite={handleToggleFavorite} />
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
      ) : null}

      <ChapterDetailView
        chapter={openChapter}
        onClose={() => setOpenChapter(null)}
        onSelectSticker={setSelectedSticker}
        onToggleFavorite={handleToggleFavorite}
      />

      <StickerDetailView
        sticker={selectedSticker}
        onClose={() => setSelectedSticker(null)}
        onDelete={() => { setSelectedSticker(null); fetchStickers(); }}
        onUpdate={patchSticker}
      />

      <Modal
        visible={sortMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSortMenuVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSortMenuVisible(false)}>
          <Pressable style={styles.sortModalCard} onPress={() => {}}>
            <Text style={styles.sortModalTitle}>Sort by</Text>
            {SORT_CYCLE.map((mode, i) => (
              <TouchableOpacity
                key={mode}
                style={[styles.sortOption, i === SORT_CYCLE.length - 1 && styles.sortOptionLast]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSortMode(mode);
                  setSortMenuVisible(false);
                }}
              >
                <Text style={[styles.sortOptionText, sortMode === mode && styles.sortOptionTextActive]}>
                  {SORT_LABELS[mode]}
                </Text>
                {sortMode === mode && <Check size={16} color={colors.terra} />}
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
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
  safeArea: { flex: 1, backgroundColor: colors.sky, paddingBottom: TAB_BAR_CLEARANCE },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.terra,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  avatarText: { color: colors.inkDark, fontSize: 16, fontWeight: '800' },
  greeting: { fontSize: 12, fontWeight: '500', color: colors.inkLight },
  username: { fontSize: 16, fontFamily: fonts.cozy, color: colors.inkDark },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },

  pillScroll: { flexGrow: 0, flexShrink: 0, marginBottom: spacing.xs },
  pillContent: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xs, gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.terra, borderColor: colors.terra },
  chipAlt: { backgroundColor: colors.card, borderColor: colors.borderLight },
  chipAltActive: { backgroundColor: colors.terra, borderColor: colors.terra },
  chipFavoriteActive: { backgroundColor: colors.error, borderColor: colors.error },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.inkMid },
  chipTextActive: { color: colors.white },

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

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  sortModalCard: {
    alignSelf: 'stretch',
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: spacing.lg,
    ...shadows.card,
  },
  sortModalTitle: { fontSize: 16, fontFamily: fonts.cozy, color: colors.inkDark, marginBottom: spacing.sm },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  sortOptionLast: { borderBottomWidth: 0 },
  sortOptionText: { fontSize: 15, fontWeight: '600', color: colors.inkMid },
  sortOptionTextActive: { color: colors.terra },
});
