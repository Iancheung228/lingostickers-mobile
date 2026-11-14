import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, RefreshControl, ActivityIndicator, PixelRatio, useWindowDimensions, Pressable } from 'react-native';
import Animated, {
  Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue,
} from 'react-native-reanimated';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePendingDeletes } from '@/components/PendingDeleteProvider';
import { useToast } from '@/components/ToastProvider';
import { useAuth } from '@/hooks/useAuth';
import { useDueCount } from '@/hooks/useDueCount';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/lib/supabase';
import { Sticker } from '@/lib/types';
import { useSignedUrls } from '@/hooks/useSignedUrls';
import { listImagePath } from '@/lib/thumbnails';
import StudyCard from '@/components/StudyCard';
import MiniStickerWall from '@/components/MiniStickerWall';
import HomeHeader, { BAND_HEIGHT, HomeBandFill, slimBandHeight } from '@/components/HomeHeader';
import HomeToolbar, { TOOLBAR_HEIGHT } from '@/components/HomeToolbar';
import HomeFilterSheet, { DEFAULT_SORT, type SortMode } from '@/components/HomeFilterSheet';
import StickerGridCell, { WELL_HEIGHT } from '@/components/StickerGridCell';
import StudySessionHost from '@/components/StudySessionHost';
import { dueAtMs, dueToday, reviewMinutes } from '@/lib/review';
import { newCardsIntroducedToday, useStudyPrefs } from '@/lib/studyPrefs';
import { limitNewCards } from '@/lib/studyQueue';
import { haptic } from '@/lib/haptics';
import { useMotion } from '@/lib/motion';
import { HOME_WALL_HEIGHT, HOME_WALL_OVERLAP } from '@/lib/homeWall';
import { colors, fonts, radii, type } from '@/constants/theme';
import { TAB_BAR_CLEARANCE } from '@/constants/tabBar';

// Geometry (SPEC "Home layout"): the wall overlaps the 140pt band by 24, the
// toolbar sits 12 under the wall and sticks under the slim band, the grid
// follows. The list scrolls under the band, and everything fixed is an overlay.
const WALL_TOP = BAND_HEIGHT - HOME_WALL_OVERLAP; // 116
const TOOLBAR_Y = WALL_TOP + HOME_WALL_HEIGHT + 12; // 352
const GRID_TOP = TOOLBAR_Y + TOOLBAR_HEIGHT + 8; // 412
const GUTTER = 20;
const GAP = 12;

const SEARCH_DEBOUNCE_MS = 150;

export default function CollectionScreen() {
  const { user } = useAuth();
  const toast = useToast();
  const { profile, setHomeBackground, setHomeWallArranged } = useProfile();
  const [fetchedStickers, setStickers] = useState<Sticker[]>([]);
  // A card being deleted (undo window, or already gone) must not come back with
  // a refetch: every list filters through the provider's pendingDeleteIds.
  const { pendingDeleteIds } = usePendingDeletes();
  const stickers = useMemo(
    () => (pendingDeleteIds.size ? fetchedStickers.filter(s => !pendingDeleteIds.has(s.id)) : fetchedStickers),
    [fetchedStickers, pendingDeleteIds],
  );
  const [loading, setLoading] = useState(true);
  // Distinguishes "you have no stickers" from "we couldn't ask".
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSticker, setSelectedSticker] = useState<Sticker | null>(null);
  const [reviewQueue, setReviewQueue] = useState<Sticker[] | null>(null);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { reduced } = useMotion();
  const prefs = useStudyPrefs();

  // ── toolbar state ──
  const [searchOpen, setSearchOpen] = useState(false);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sort, setSort] = useState<SortMode>(DEFAULT_SORT);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [dueOnly, setDueOnly] = useState(false);

  // Filter in memory (no network), debounced so typing doesn't re-sort per key.
  useEffect(() => {
    const t = setTimeout(() => setQuery(queryInput.trim().toLowerCase()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [queryInput]);

  // One fetch in flight at a time; a newer ask supersedes an older answer.
  const ticket = useRef(0);
  const refreshingRef = useRef(false);
  refreshingRef.current = refreshing;
  const fetchStickers = useCallback(async () => {
    if (!user) return;
    const mine = ++ticket.current;
    const { data, error } = await supabase
      .from('stickers')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (mine !== ticket.current) return;
    if (error) {
      // Keep a good list on screen; only a cold failure shows the error page.
      setLoadError(true);
      if (refreshingRef.current) toast.show({ kind: 'error', message: "Couldn't refresh. Pull down to try again." });
    } else if (data) {
      setLoadError(false);
      setStickers(data as Sticker[]);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user, toast]);

  useFocusEffect(useCallback(() => { fetchStickers(); }, [fetchStickers]));
  const onRefresh = () => { setRefreshing(true); fetchStickers(); };

  // Applies to the list and the open detail, so a favourite or edit shows
  // everywhere at once (skills.md #1).
  const patchSticker = useCallback((id: string, patch: Partial<Sticker>) => {
    setStickers(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
    setSelectedSticker(prev => prev && prev.id === id ? { ...prev, ...patch } : prev);
  }, []);

  const stickersRef = useRef(stickers);
  stickersRef.current = stickers;
  const handleToggleFavorite = useCallback(async (id: string) => {
    const target = stickersRef.current.find(s => s.id === id);
    if (!target) return;
    const next = !target.is_favorite;
    haptic.tap();
    patchSticker(id, { is_favorite: next });
    const { error } = await supabase.from('stickers').update({ is_favorite: next }).eq('id', id);
    if (error) {
      patchSticker(id, { is_favorite: !next });
      toast.show({ kind: 'error', message: "Couldn't update the favourite. Try again." });
    }
  }, [patchSticker, toast]);

  // ── the grid: filter, then sort ──
  const visible = useMemo(() => {
    let list = stickers;
    if (query) {
      list = list.filter(s =>
        s.word.toLowerCase().includes(query) ||
        s.translation.toLowerCase().includes(query) ||
        s.reading.toLowerCase().includes(query) ||
        (s.notes?.toLowerCase().includes(query) ?? false));
    }
    if (favoritesOnly) list = list.filter(s => s.is_favorite);
    if (dueOnly) { const now = Date.now(); list = list.filter(s => dueAtMs(s) <= now); }
    const out = [...list];
    const t = (s: Sticker) => new Date(s.created_at).getTime();
    if (sort === 'oldest') out.sort((a, b) => t(a) - t(b));
    else if (sort === 'due') out.sort((a, b) => dueAtMs(a) - dueAtMs(b));
    else if (sort === 'az') out.sort((a, b) => a.word.localeCompare(b.word, undefined, { sensitivity: 'base' }));
    else out.sort((a, b) => t(b) - t(a));
    return out;
  }, [stickers, query, favoritesOnly, dueOnly, sort]);

  // The pill (and the tab badge) show what a session will actually contain: the
  // due queue after the daily new-card limit, not the raw due count.
  const due = useMemo(
    () => limitNewCards(dueToday(stickers), prefs.newCardsPerDay, newCardsIntroducedToday()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stickers, prefs.newCardsPerDay],
  );
  const { setDueCount } = useDueCount();
  useEffect(() => { setDueCount(due.length); }, [due.length, setDueCount]);

  // Sign the first screenful fast, the rest (voice notes, memory photos) behind.
  const PRIORITY_COUNT = 24;
  const wallPaths = useMemo(() => stickers.slice(0, 8).map(listImagePath), [stickers]);
  const priorityUrls = useSignedUrls(useMemo(
    () => [...wallPaths, ...visible.slice(0, PRIORITY_COUNT).map(listImagePath)],
    [wallPaths, visible],
  ));
  const deferredUrls = useSignedUrls(useMemo(() => [
    ...visible.slice(PRIORITY_COUNT).map(listImagePath),
    ...stickers.map(s => s.voice_note_path),
    ...stickers.map(s => s.memory_photo_path),
  ], [visible, stickers]));
  const getUrl = useCallback(
    (path: string | null | undefined) => (path ? priorityUrls.get(path) ?? deferredUrls.get(path) ?? null : null),
    [priorityUrls, deferredUrls],
  );

  const startReview = () => {
    if (due.length === 0) return;
    setReviewQueue(due);
  };

  // ── scroll-linked chrome ──
  const slim = slimBandHeight(insets.top);
  const stickAt = TOOLBAR_Y - slim; // scroll offset at which the toolbar meets the slim band
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler(e => { scrollY.value = e.contentOffset.y; });
  const toolbarStyle = useAnimatedStyle(() => {
    const y = scrollY.value;
    return {
      transform: [{ translateY: Math.max(slim, TOOLBAR_Y - y) }],
    };
  });
  // Transparent at rest (so the wall's shadow isn't clipped), opaque once it sticks.
  const toolbarFill = useAnimatedStyle(() => ({
    opacity: reduced ? (scrollY.value >= stickAt - 30 ? 1 : 0) : interpolate(scrollY.value, [stickAt - 40, stickAt - 8], [0, 1], Extrapolation.CLAMP),
  }));
  const listRef = useRef<Animated.FlatList<Sticker>>(null);
  const openSearch = () => {
    setSearchOpen(true);
    listRef.current?.scrollToOffset({ offset: stickAt, animated: !reduced });
  };
  const closeSearch = () => { setSearchOpen(false); setQueryInput(''); setQuery(''); };

  // The scan toast's "View": ?open=<id> opens that card; ?fresh=<n> shows the
  // newest cards (default sort, no filters) scrolled to the grid.
  const params = useLocalSearchParams<{ open?: string; fresh?: string }>();
  const router = useRouter();
  useEffect(() => {
    if (params.fresh) {
      setSort(DEFAULT_SORT); setFavoritesOnly(false); setDueOnly(false); closeSearch();
      requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: stickAt, animated: !reduced }));
      router.setParams({ fresh: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.fresh]);
  useEffect(() => {
    if (!params.open) return;
    const found = stickers.find(s => s.id === params.open);
    if (found) { setSelectedSticker(found); router.setParams({ open: undefined }); }
    // Not fetched yet: the focus refetch will bring it and this runs again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.open, stickers]);

  const filtersActive = sort !== DEFAULT_SORT || favoritesOnly || dueOnly;
  const brandNew = !loading && !loadError && stickers.length === 0;
  const cols = PixelRatio.getFontScale() >= 1.5 ? 1 : 2;
  const cellWidth = (width - GUTTER * 2 - (cols - 1) * GAP) / cols;

  const header = <View style={{ height: brandNew ? WALL_TOP + HOME_WALL_HEIGHT + 24 : GRID_TOP }}>
    <View style={{ marginTop: WALL_TOP }}>
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
  </View>;

  const empty = loading ? (
    <View style={styles.skeletonWrap}>
      {Array.from({ length: 6 }).map((_, i) => <View key={i} style={[styles.skeleton, { width: cellWidth }]} />)}
    </View>
  ) : brandNew ? null : loadError ? (
    <EmptyState
      title="Couldn't load your collection"
      subtitle="Nothing has been lost. We just couldn't reach the server. Check your connection and try again."
      actionLabel="Try again"
      onAction={fetchStickers}
    />
  ) : query ? (
    <EmptyState
      title={`No stickers match "${queryInput.trim()}"`}
      subtitle="Try a different word, meaning or note."
      actionLabel="Clear search"
      onAction={() => { setQueryInput(''); setQuery(''); }}
    />
  ) : favoritesOnly ? (
    <EmptyState
      title="No favourites yet"
      subtitle="Tap the heart on a card to add it."
      actionLabel="Show all"
      onAction={() => { setFavoritesOnly(false); setDueOnly(false); }}
    />
  ) : (
    <EmptyState
      title="Nothing due"
      subtitle="Every card is scheduled for later."
      actionLabel="Show all"
      onAction={() => setDueOnly(false)}
    />
  );

  return (
    <View style={styles.screen}>
      <HomeBandFill scrollY={scrollY} />

      <Animated.FlatList
        ref={listRef}
        key={`cols-${cols}`}
        data={loading || brandNew ? [] : visible}
        keyExtractor={s => s.id}
        numColumns={cols}
        columnWrapperStyle={cols > 1 ? styles.row : undefined}
        contentContainerStyle={{ paddingBottom: insets.bottom + TAB_BAR_CLEARANCE + 24, minHeight: height + stickAt }}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item }) => (
          <View style={cols > 1 ? [styles.cellWrap, { maxWidth: cellWidth }] : styles.cellSingle}>
            <StickerGridCell
              sticker={item}
              imageUrl={getUrl(listImagePath(item))}
              onPress={setSelectedSticker}
              onToggleFavorite={handleToggleFavorite}
            />
          </View>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.terra} progressViewOffset={slim} />}
      />

      {!brandNew && !loading && (
        <Animated.View style={[styles.toolbar, toolbarStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.toolbarFill, toolbarFill]} />
          <HomeToolbar
            count={stickers.length}
            searchOpen={searchOpen}
            query={queryInput}
            filtersActive={filtersActive}
            onOpenSearch={openSearch}
            onCloseSearch={closeSearch}
            onChangeQuery={setQueryInput}
            onOpenFilter={() => setFilterOpen(true)}
          />
        </Animated.View>
      )}

      <HomeHeader
        dueCount={due.length}
        reviewMinutes={reviewMinutes(due.length)}
        onStartReview={startReview}
        scrollY={scrollY}
      />
      {refreshing && (
        <View style={[styles.refreshing, { top: slim + 8 }]} pointerEvents="none">
          <ActivityIndicator color={colors.terra} />
        </View>
      )}

      {/* Browsing only. Tapping a sticker leaves the schedule alone; grading
          belongs to a session. */}
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

      {filterOpen && (
        <HomeFilterSheet
          sort={sort}
          favoritesOnly={favoritesOnly}
          dueOnly={dueOnly}
          onSort={setSort}
          onFavoritesOnly={setFavoritesOnly}
          onDueOnly={setDueOnly}
          onReset={() => { setSort(DEFAULT_SORT); setFavoritesOnly(false); setDueOnly(false); }}
          onClosed={() => setFilterOpen(false)}
        />
      )}
    </View>
  );
}

function EmptyState({ title, subtitle, actionLabel, onAction }: {
  title: string; subtitle: string; actionLabel?: string; onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle} maxFontSizeMultiplier={1.5}>{title}</Text>
      <Text style={styles.emptySubtitle} maxFontSizeMultiplier={2}>{subtitle}</Text>
      {actionLabel && onAction && (
        <Pressable
          style={({ pressed }) => [styles.retryBtn, pressed && styles.retryPressed]}
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={styles.retryText} maxFontSizeMultiplier={1.5}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.sky },
  toolbar: {
    position: 'absolute', left: 0, right: 0, top: 0, zIndex: 10,
  },
  toolbarFill: { backgroundColor: colors.sky, shadowColor: colors.inkDark, shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  row: { gap: GAP, paddingHorizontal: GUTTER, marginBottom: GAP },
  cellWrap: { flex: 1 },
  cellSingle: { paddingHorizontal: GUTTER, marginBottom: GAP },
  refreshing: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 30 },
  skeletonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingHorizontal: GUTTER },
  skeleton: { height: WELL_HEIGHT + 62, borderRadius: radii.md, backgroundColor: colors.sand },
  empty: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 40, gap: 12 },
  emptyTitle: { ...type.h2, textAlign: 'center' },
  emptySubtitle: { ...type.body, textAlign: 'center', color: colors.inkLight },
  retryBtn: {
    minHeight: 44, justifyContent: 'center', backgroundColor: colors.terra, borderRadius: radii.full, paddingHorizontal: 24,
  },
  retryPressed: { backgroundColor: colors.terraDark },
  retryText: { color: colors.white, fontSize: 16, fontFamily: fonts.display },
});
