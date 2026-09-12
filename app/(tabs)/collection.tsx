import { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, ScrollView, ActivityIndicator, Modal, Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { Heart, ArrowUpDown, Check, Search, X } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/lib/supabase';
import { Sticker, Category, Language } from '@/lib/types';
import { useSignedUrls } from '@/hooks/useSignedUrls';
import { useStickerAuthors } from '@/hooks/useStickerAuthors';
import StickerCard from '@/components/StickerCard';
import StudyCard from '@/components/StudyCard';
import MiniStickerWall from '@/components/MiniStickerWall';
import HomeHeader from '@/components/HomeHeader';
import FeedRail from '@/components/FeedRail';
import LatestStickers, { MAX_ROWS as LATEST_FEED_ROWS } from '@/components/LatestStickers';
import { DAILY_GOAL, FEED_PREVIEW, dueToday, findsToday, reviewMinutes } from '@/lib/review';
import StudySessionHost from '@/components/StudySessionHost';
import { colors, shadows, radii, spacing, typography, fonts } from '@/constants/theme';
import { TAB_BAR_CLEARANCE } from '@/constants/tabBar';
import { languageLabel } from '@/lib/languages';

const CATEGORIES: Array<'All' | Category> = ['All', 'Kitchen', 'Animals', 'Study', 'Nature', 'Other'];

// 'newest'/'oldest' sort by discovered_at (when the memory happened —
// backdated to the photo's own date on import). 'recentlyAdded' sorts by
// created_at (when it actually landed in your collection) instead, for
// people who want to see today's imports at the top regardless of how old
// the photo itself is.
type SortMode = 'newest' | 'oldest' | 'recentlyAdded';
const SORT_CYCLE: SortMode[] = ['newest', 'oldest', 'recentlyAdded'];
const SORT_LABELS: Record<SortMode, string> = {
  newest: 'Latest first',
  oldest: 'Oldest first',
  recentlyAdded: 'Recently added',
};

// The wall card lifts up into the rose band rather than sitting below it,
// so the band and the card read as one masthead. HomeHeader reserves the
// matching space at its own bottom edge — deep enough that the two overlap
// by most of the card's mount, which is what keeps the masthead compact
// enough to leave the Latest stickers feed on screen.
const WALL_OVERLAP = 56;

export default function CollectionScreen() {
  const { user } = useAuth();
  const { profile, setHomeBackground, setHomeWallArranged } = useProfile(user?.id);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [loading, setLoading] = useState(true);
  // Distinguishes "you have no stickers" from "we couldn't ask". Without it a
  // failed fetch left `stickers` empty and the screen cheerfully told someone
  // with a full collection to go scan their first word.
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'All' | Category>('All');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [selectedSticker, setSelectedSticker] = useState<Sticker | null>(null);
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // A review session is just the due queue plus a cursor into it: closing
  // the detail view advances to the next card instead of dismissing, so
  // "Review all" is a real flip-through built out of the screen we already
  // have rather than a second full-screen viewer.
  const [reviewQueue, setReviewQueue] = useState<Sticker[] | null>(null);
  // null = every language. Only offered when the collection actually holds
  // more than one — interleaving two languages in one session is genuinely
  // disorienting, but a filter for a state you can't be in is just clutter.
  const [langFilter, setLangFilter] = useState<Language | null>(null);

  const openSearch = () => setSearchActive(true);
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

    if (error) {
      setLoadError(true);
    } else if (data) {
      setLoadError(false);
      setStickers(data as Sticker[]);
    }
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

  // The language chips sit on the due rail, but they scope the whole screen
  // below it — the feed and the grid too. Picking Japanese and then scrolling
  // into a grid still full of French is the filter quietly not meaning what
  // it says. `languages` below is deliberately derived from the *unscoped*
  // collection, so the chip row can always undo itself (skills.md #8: an
  // exit you draw has to keep working).
  const inLanguage = useMemo(
    () => (langFilter ? stickers.filter(s => s.language === langFilter) : stickers),
    [stickers, langFilter]
  );

  // Sorted first, then filtered — the "Latest stickers" feed shows the whole
  // (language-scoped) collection in the chosen order while the grid below
  // shows the filtered slice of it, and both have to agree about what
  // "latest" means.
  const sortField = sortMode === 'recentlyAdded' ? 'created_at' : 'discovered_at';
  const sorted = useMemo(() => [...inLanguage].sort((a, b) => {
    const diff = new Date(a[sortField]).getTime() - new Date(b[sortField]).getTime();
    return sortMode === 'oldest' ? diff : -diff;
  }), [inLanguage, sortField, sortMode]);

  let filtered = isSearching
    ? sorted.filter(s =>
        s.word.toLowerCase().includes(trimmedQuery) ||
        s.translation.toLowerCase().includes(trimmedQuery) ||
        s.reading.toLowerCase().includes(trimmedQuery) ||
        (s.notes?.toLowerCase().includes(trimmedQuery) ?? false)
      )
    : activeCategory === 'All'
      ? sorted
      : sorted.filter(s => s.category === activeCategory);
  if (favoritesOnly) filtered = filtered.filter(s => s.is_favorite);

  // Recomputed only when the collection changes, not on every render — it
  // reads the clock, and a queue that reshuffled mid-scroll would be worse
  // than one that's a few minutes stale.
  const due = useMemo(
    () => dueToday(stickers, { language: langFilter ?? undefined }),
    [stickers, langFilter]
  );
  // The rail is a feed of recent finds, NOT a preview of the review queue.
  // Deliberately built from the whole collection rather than from `due`: a
  // card scanned a minute ago is the newest thing you have and is correctly
  // not due yet (NEW_CARD_REST_DAYS), so a due-derived rail could never show
  // the thing you just made. `due` still exists untouched for HomeHeader's
  // count and for startReview, which need the scheduler's own order.
  //
  // Language-filtered like everything else the chips govern.
  const feedItems = useMemo(
    () => stickers
      .filter(s => !langFilter || s.language === langFilter)
      .slice()
      .sort((a, b) => Date.parse(b.discovered_at) - Date.parse(a.discovered_at))
      .slice(0, FEED_PREVIEW),
    [stickers, langFilter]
  );
  const languages = useMemo(
    () => Array.from(new Set(stickers.map(s => s.language))),
    [stickers]
  );
  const foundToday = useMemo(() => findsToday(stickers), [stickers]);

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
    // The due rail and the Latest feed both paint above the grid, so their
    // images belong in the fast batch even though they aren't drawn from
    // `filtered` — otherwise the first thing on screen is the last to load.
    () => [
      ...feedItems.map(s => s.image_path),
      ...sorted.slice(0, LATEST_FEED_ROWS).map(s => s.image_path),
      ...filtered.slice(0, PRIORITY_COUNT).map(s => s.image_path),
    ],
    [feedItems, sorted, filtered]
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

  // Whose face goes on each due card: yours, or the friend who sent you the
  // challenge you won it off.
  const getAuthor = useStickerAuthors(stickers, profile);

  const cycleSort = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSortMode(m => SORT_CYCLE[(SORT_CYCLE.indexOf(m) + 1) % SORT_CYCLE.length]);
  };

  const startReview = () => {
    if (due.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setReviewQueue(due);
  };

  const listHeader = (
    <>
      <HomeHeader
        foundToday={foundToday}
        goal={DAILY_GOAL}
        dueCount={due.length}
        reviewMinutes={reviewMinutes(due.length)}
        onStartReview={startReview}
        onSearch={openSearch}
      />

      {/* ── Mini sticker wall preview, lifted into the rose band above ── */}
      <View style={styles.wallLift}>
        <MiniStickerWall
          borderStyle={profile?.cutout_border_style ?? 'shadow'}
          stickers={stickers}
          userId={user?.id}
          backgroundPath={profile?.home_background_path}
          backgroundDim="none"
          onChangeBackground={setHomeBackground}
          arranged={profile?.home_wall_arranged ?? false}
          onArranged={setHomeWallArranged}
          onPressSticker={setSelectedSticker}
        />
      </View>

      <FeedRail
        items={feedItems}
        languages={languages}
        activeLanguage={langFilter}
        onSelectLanguage={setLangFilter}
        getUrl={getUrl}
        getAuthor={getAuthor}
        onPressSticker={setSelectedSticker}
      />

      <LatestStickers
        stickers={sorted}
        sortLabel={SORT_LABELS[sortMode]}
        onCycleSort={cycleSort}
        getUrl={getUrl}
        onPressSticker={setSelectedSticker}
      />

      {/* ── Search bar, shown only while searching. There's no view-mode
          switcher any more — the grid is the only view — so this row simply
          isn't rendered at rest rather than swapping places with one. ── */}
      {searchActive && (
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
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Clear the search box"
              >
                <X size={14} color={colors.inkFaint} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={closeSearch} hitSlop={8}>
            <Text style={styles.searchCancel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Category filter — sort/favorites live in the fixed icon cluster
          beside it rather than scrolling inline, so only one kind of control
          (category) ever shares the scroll row. While searching, category no
          longer applies (search spans everything), so the chips are swapped
          for a result count instead. ── */}
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
            onPress={cycleSort}
            accessibilityRole="button"
            accessibilityLabel={`Sort: ${SORT_LABELS[sortMode]}. Tap to change, hold for all options.`}
            onLongPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setSortMenuVisible(true);
            }}
            delayLongPress={350}
            hitSlop={8}
          >
            <ArrowUpDown size={14} color={sortMode !== 'newest' ? colors.inkDark : colors.inkMid} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtnSmall, favoritesOnly && styles.iconBtnSmallFavActive]}
            onPress={() => setFavoritesOnly(f => !f)}
            accessibilityRole="button"
            accessibilityLabel={favoritesOnly ? 'Showing favourites only. Tap to show all.' : 'Show favourites only'}
            accessibilityState={{ selected: favoritesOnly }}
            hitSlop={8}
          >
            <Heart size={14} color={favoritesOnly ? colors.white : colors.error} fill={favoritesOnly ? colors.white : 'transparent'} />
          </TouchableOpacity>
        </View>
      </View>
    </>
  );

  return (
    <View style={styles.screen}>
      {/* One list for the whole screen: the masthead, the two feature
          sections and the filter row all ride along as its header, so the
          rose band scrolls away with the content instead of being pinned
          above a separately-scrolling grid. */}
      <FlatList
        data={loading ? [] : filtered}
        keyExtractor={s => s.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.loader} color={colors.terra} size="large" />
          ) : loadError ? (
            <EmptyState
              title="Couldn't load your collection"
              subtitle="Nothing has been lost — we just couldn't reach the server. Check your connection and try again."
              onRetry={fetchStickers}
            />
          ) : (
            <EmptyState
              title={
                isSearching ? `No matches for "${searchQuery.trim()}"`
                : langFilter ? `No ${languageLabel(langFilter)} stickers here`
                : 'No stickers yet'
              }
              subtitle={
                isSearching ? 'Try a different word, meaning, or note.'
                // The language chips are up in the due rail, possibly
                // scrolled off the top by the time you reach an empty grid —
                // so say which filter is doing this, and undo it from here.
                : langFilter ? 'The language filter above is narrowing this screen.'
                : favoritesOnly ? 'Tap the heart on a sticker to favorite it!'
                : 'Tap the Scan tab to discover your first word!'
              }
              actionLabel={!isSearching && langFilter ? 'Show all languages' : undefined}
              onAction={() => setLangFilter(null)}
            />
          )
        }
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

      {/* Browsing only. Tapping a sticker from the grid, the feed or the due
          rail leaves the schedule alone — grading belongs to a session. */}
      <StudyCard
        sticker={selectedSticker}
        mode="browse"
        onClose={() => setSelectedSticker(null)}
        onDeleted={() => { setSelectedSticker(null); fetchStickers(); }}
        onUpdate={patchSticker}
      />

      <StudySessionHost
        queue={reviewQueue}
        onExit={() => setReviewQueue(null)}
        onUpdate={patchSticker}
        onDeleted={fetchStickers}
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
    </View>
  );
}

function EmptyState({ title, subtitle, onRetry, actionLabel, onAction }: {
  title: string; subtitle: string; onRetry?: () => void;
  actionLabel?: string; onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
      {onRetry && (
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={onRetry}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Try loading your collection again"
        >
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      )}
      {actionLabel && onAction && (
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={onAction}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={styles.retryText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.sky },

  // Negative top margin pulls the wall card up over the rose band's own
  // bottom padding, so the card straddles the seam. It has to sit in its
  // own wrapper rather than on MiniStickerWall itself — the panel is a
  // shared component the Wall tab renders flush.
  wallLift: { marginTop: -WALL_OVERLAP },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.ms,
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
  searchInput: { flex: 1, padding: 0, fontSize: 14, fontFamily: fonts.text, color: colors.inkDark },
  searchCancel: { fontSize: 13, fontFamily: fonts.display, color: colors.inkMid },
  searchResultsLabelWrap: { flex: 1, justifyContent: 'center', paddingVertical: spacing.xs },
  searchResultsLabel: { fontSize: 12, fontFamily: fonts.display, color: colors.inkFaint },

  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.lg,
    marginTop: spacing.ms,
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
  chipText: { fontSize: 13, fontFamily: fonts.display, color: colors.inkMid },
  chipTextActive: { color: colors.white },

  loader: { marginTop: spacing.xxl, alignSelf: 'center' },

  // No horizontal *or* top padding here on purpose: contentContainerStyle
  // wraps the ListHeaderComponent as well as the rows, so an inset put here
  // would push the full-bleed rose band in from the screen edges and down
  // from the very top. Both gutters belong to the rows alone.
  grid: { paddingBottom: TAB_BAR_CLEARANCE + spacing.xl },
  row: { gap: spacing.sm, marginBottom: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  cardWrapper: { flex: 1 },

  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  emptyTitle: { ...typography.h3, textAlign: 'center' },
  emptySubtitle: { ...typography.body, textAlign: 'center', color: colors.inkLight },
  retryBtn: {
    backgroundColor: colors.terra,
    borderRadius: radii.lg,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    ...shadows.button,
  },
  retryText: { color: colors.white, fontSize: 14, fontFamily: fonts.display, letterSpacing: 0.3 },

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
  sortModalTitle: { fontSize: 16, fontFamily: fonts.display, color: colors.inkDark, marginBottom: spacing.sm },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  sortOptionLast: { borderBottomWidth: 0 },
  sortOptionText: { fontSize: 15, fontFamily: fonts.display, color: colors.inkMid },
  sortOptionTextActive: { color: colors.terra },
});
