import { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, SafeAreaView, ScrollView, ActivityIndicator, Modal, Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, router } from 'expo-router';
import { Settings, Heart, ArrowUpDown, Check, Search, X } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/lib/supabase';
import { Sticker, Category } from '@/lib/types';
import { buildChapters, Chapter } from '@/lib/chapters';
import { useSignedUrls } from '@/hooks/useSignedUrls';
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
  const { profile, setHomeBackground } = useProfile(user?.id);
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
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const openSearch = () => {
    setSearchActive(true);
    if (viewMode !== 'grid') setViewMode('grid');
  };
  const closeSearch = () => {
    setSearchActive(false);
    setSearchQuery('');
  };

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

  // Client-side substring search over the already-fetched collection — no
  // extra Supabase round-trip, and this collection is never large enough to
  // need one. Matches against word/translation/reading/notes: the fields a
  // person actually remembers a sticker by, not the full example sentence.
  const trimmedQuery = searchQuery.trim().toLowerCase();
  const isSearching = searchActive && trimmedQuery.length > 0;

  let filtered = viewMode === 'challenges'
    ? stickers.filter(s => s.source === 'challenge')
    : isSearching
      ? stickers.filter(s =>
          s.word.toLowerCase().includes(trimmedQuery) ||
          s.translation.toLowerCase().includes(trimmedQuery) ||
          s.reading.toLowerCase().includes(trimmedQuery) ||
          (s.notes?.toLowerCase().includes(trimmedQuery) ?? false)
        )
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

  // Two-tier signing: a small, fast batch for the images the grid/story list
  // actually renders first (comfortably covers the FlatList's initial
  // viewport + overscan window), plus a slower background batch for
  // everything else (off-screen images, every voice note, every memory
  // photo). Signing the *entire* collection's image+voice+memory paths in
  // one shot used to gate the whole screen's first paint on a request whose
  // size scaled with total collection size — see skills.md wall-loading
  // note. Splitting it this way means the visible cards resolve as fast as
  // the old one-tile-per-request code did, while the rest fills in
  // afterward without blocking anything.
  const PRIORITY_COUNT = 24;
  const priorityUrls = useSignedUrls(useMemo(
    () => filtered.slice(0, PRIORITY_COUNT).map(s => s.image_path),
    [filtered]
  ));
  const deferredUrls = useSignedUrls(useMemo(() => [
    ...filtered.slice(PRIORITY_COUNT).map(s => s.image_path),
    ...stickers.map(s => s.voice_note_path),
    ...stickers.map(s => s.memory_photo_path),
  ], [filtered, stickers]));
  const getUrl = useCallback(
    (path: string | null | undefined) => (path ? priorityUrls.get(path) ?? deferredUrls.get(path) ?? null : null),
    [priorityUrls, deferredUrls]
  );

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
          <TouchableOpacity onPress={openSearch} style={styles.iconBtn} hitSlop={8}>
            <Search size={18} color={colors.inkMid} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/profile')} style={styles.iconBtn} hitSlop={8}>
            <Settings size={18} color={colors.inkMid} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Mini sticker wall preview ── */}
      <MiniStickerWall
        stickers={stickers}
        userId={user?.id}
        backgroundPath={profile?.home_background_path}
        backgroundDim="none"
        onChangeBackground={setHomeBackground}
      />

      {/* ── View mode segmented control, replaced by a search bar while
          searching — search only spans Grid's data, so activating it forces
          viewMode to 'grid' (see openSearch) and there's nothing for this
          row to switch between. ── */}
      {searchActive ? (
        <View style={styles.searchBar}>
          <View style={styles.searchInputWrap}>
            <Search size={14} color={colors.inkFaint} />
            <TextInput
              autoFocus
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search word, meaning, notes…"
              placeholderTextColor={colors.inkFaint}
              style={styles.searchInput}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
                <X size={14} color={colors.inkFaint} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={closeSearch} hitSlop={8}>
            <Text style={styles.searchCancel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.segmented}>
          {VIEW_MODES.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.seg, viewMode === key && styles.segActive]}
              onPress={() => setViewMode(key)}
            >
              <Text style={[styles.segText, viewMode === key && styles.segTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Category filter (grid mode only) — sort/favorites live in the
          fixed icon cluster beside it rather than scrolling inline, so only
          one kind of control (category) ever shares the scroll row. While
          searching, category no longer applies (search spans everything),
          so the chips are swapped for a result count instead. ── */}
      {viewMode === 'grid' && (
        <View style={styles.filterRow}>
          {isSearching ? (
            <View style={styles.searchResultsLabelWrap}>
              <Text style={styles.searchResultsLabel}>
                {filtered.length} result{filtered.length === 1 ? '' : 's'}
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryScroll}
              contentContainerStyle={styles.categoryContent}
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
          <View style={styles.iconCluster}>
            <TouchableOpacity
              style={[styles.iconBtnSmall, sortMode !== 'newest' && styles.iconBtnSmallSortActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSortMode(m => SORT_CYCLE[(SORT_CYCLE.indexOf(m) + 1) % SORT_CYCLE.length]);
              }}
              onLongPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setSortMenuVisible(true);
              }}
              delayLongPress={350}
              hitSlop={6}
            >
              <ArrowUpDown size={14} color={sortMode !== 'newest' ? colors.inkDark : colors.inkMid} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtnSmall, favoritesOnly && styles.iconBtnSmallFavActive]}
              onPress={() => setFavoritesOnly(f => !f)}
              hitSlop={6}
            >
              <Heart size={14} color={favoritesOnly ? colors.white : colors.error} fill={favoritesOnly ? colors.white : 'transparent'} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Content ── */}
      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.terra} size="large" />
      ) : viewMode === 'grid' || viewMode === 'challenges' ? (
        filtered.length === 0 ? (
          <EmptyState
            title={isSearching
              ? `No matches for "${searchQuery.trim()}"`
              : viewMode === 'challenges' ? 'No challenge wins yet' : 'No stickers yet'}
            subtitle={isSearching
              ? 'Try a different word, meaning, or note.'
              : viewMode === 'challenges'
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
                <StickerCard
                  sticker={item}
                  onPress={() => setSelectedSticker(item)}
                  onToggleFavorite={handleToggleFavorite}
                  imageUrl={getUrl(item.image_path)}
                  voiceUrl={getUrl(item.voice_note_path)}
                />
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
              <ChapterCard
                chapter={item}
                onPress={() => setOpenChapter(item)}
                imageUrl={getUrl(item.coverSticker.memory_photo_path ?? item.coverSticker.image_path)}
              />
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

  segmented: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.borderLight,
    borderRadius: radii.full,
    padding: 3,
  },
  seg: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radii.full },
  segActive: { backgroundColor: colors.card, ...shadows.card },
  segText: { fontSize: 12, fontWeight: '700', color: colors.inkLight },
  segTextActive: { color: colors.inkDark },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    backgroundColor: colors.borderLight,
  },
  searchInput: { flex: 1, padding: 0, fontSize: 14, color: colors.inkDark },
  searchCancel: { fontSize: 13, fontWeight: '600', color: colors.inkMid },
  searchResultsLabelWrap: { flex: 1, justifyContent: 'center', paddingVertical: spacing.xs },
  searchResultsLabel: { fontSize: 12, fontWeight: '600', color: colors.inkFaint },

  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.lg,
    marginBottom: spacing.xs,
  },
  categoryScroll: { flex: 1 },
  categoryContent: { paddingVertical: spacing.xs, gap: spacing.sm, paddingRight: spacing.sm },
  iconCluster: { flexDirection: 'row', gap: spacing.xs, paddingRight: spacing.lg, paddingLeft: spacing.xs },
  iconBtnSmall: {
    width: 30,
    height: 30,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnSmallSortActive: { backgroundColor: colors.terraLight, borderColor: colors.terra },
  iconBtnSmallFavActive: { backgroundColor: colors.error, borderColor: colors.error },

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
  chipAlt: { backgroundColor: colors.card, borderColor: colors.borderLight },
  chipAltActive: { backgroundColor: colors.terra, borderColor: colors.terra },
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
