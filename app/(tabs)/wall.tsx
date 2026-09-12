import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Plus, Sticker as StickerIcon } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useBoards, useBoardPreviews } from '@/hooks/useBoards';
import { Board } from '@/lib/types';
import BoardCarouselPage from '@/components/BoardCarouselPage';
import BoardRail from '@/components/BoardRail';
import NewBoardSheet from '@/components/NewBoardSheet';
import SettingsButton from '@/components/SettingsButton';
import { colors, spacing, fonts, radii, shadows } from '@/constants/theme';
import { TAB_BAR_CLEARANCE } from '@/constants/tabBar';

export default function WallScreen() {
  const { user } = useAuth();
  const { profile, refetch: refetchProfile } = useProfile(user?.id);
  const { boards, createBoard, deleteBoard, renameBoard, setBoardBackground, setBoardBackgroundDim } = useBoards(user?.id);
  const { previews, refetch: refetchPreviews } = useBoardPreviews(user?.id);
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Board>>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);
  // A horizontal FlatList's own outer frame resolves flex:1 fine, but each
  // rendered page (a row item) doesn't automatically stretch to that frame's
  // height — without a real height, the board canvas's flex:1 chain inside
  // it can measure taller than what's actually reserved above the rail and
  // the floating tab bar. Measuring the list's frame directly and pinning
  // every page to that height closes the gap.
  const [listHeight, setListHeight] = useState(0);

  useFocusEffect(useCallback(() => {
    refetchProfile();
    refetchPreviews();
  }, [refetchProfile, refetchPreviews]));

  const goToPage = (index: number) => {
    // Set the index directly rather than waiting for the scroll to settle:
    // a programmatic scroll doesn't reliably fire onMomentumScrollEnd, and
    // the rail should light up the tapped board instantly either way.
    setPageIndex(index);
    listRef.current?.scrollToIndex({ index, animated: true });
  };

  // A newly created board lands at the front (useBoards prepends it) — jump
  // the carousel there so the user lands on the board they just named.
  useEffect(() => {
    if (justCreatedId && boards.length > 0 && boards[0].id === justCreatedId) {
      goToPage(0);
    }
  }, [justCreatedId, boards]);

  // Deleting the last board leaves pageIndex pointing past the end, which
  // would light up nothing in the rail and leave the carousel blank.
  useEffect(() => {
    if (boards.length > 0 && pageIndex > boards.length - 1) goToPage(boards.length - 1);
  }, [boards.length, pageIndex]);

  const handleCreateBoard = async (name: string) => {
    const { error, board } = await createBoard(name);
    if (!error && board) setJustCreatedId(board.id);
    return { error };
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }]}>
      {/* With no boards there's no board header to hang the gear off, so it
          gets its own slot in the same corner it occupies everywhere else. */}
      {boards.length === 0 && <SettingsButton style={styles.emptySettings} />}

      {boards.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconCircle}>
            <StickerIcon size={22} color={colors.inkDark} />
          </View>
          <Text style={styles.emptyTitle}>No boards yet</Text>
          <Text style={styles.emptySubtitle}>
            A board is a wall you arrange yourself — pin any stickers from your collection onto it.
          </Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => setSheetOpen(true)} activeOpacity={0.85}>
            <Plus size={16} color={colors.white} strokeWidth={2.5} />
            <Text style={styles.emptyBtnText}>New board</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          style={styles.list}
          onLayout={(e) => setListHeight(e.nativeEvent.layout.height)}
          data={boards}
          keyExtractor={b => b.id}
          horizontal
          pagingEnabled
          scrollEnabled={!dragging}
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          getItemLayout={(_, index) => ({ length: screenWidth, offset: screenWidth * index, index })}
          onMomentumScrollEnd={(e) => {
            setPageIndex(Math.round(e.nativeEvent.contentOffset.x / screenWidth));
          }}
          // Every page is mounted at once, so `isActive` below is the only
          // thing that tells a page it's the one being looked at.
          extraData={pageIndex}
          renderItem={({ item, index }) => (
            <View style={{ width: screenWidth, height: listHeight || undefined }}>
              <BoardCarouselPage
                board={item}
                currentUserId={user?.id}
                displayStyle={profile?.wall_display_style ?? 'framed'}
                borderStyle={profile?.cutout_border_style ?? 'shadow'}
                isActive={index === pageIndex}
                onDeleteBoard={deleteBoard}
                onRenameBoard={renameBoard}
                onChangeBackground={setBoardBackground}
                onChangeBackgroundDim={setBoardBackgroundDim}
                onDragStateChange={setDragging}
                onContentChanged={refetchPreviews}
                autoOpenPicker={item.id === justCreatedId}
                onAutoOpenHandled={() => setJustCreatedId(null)}
              />
            </View>
          )}
        />
      )}

      <BoardRail
        boards={boards}
        previews={previews}
        activeIndex={pageIndex}
        onSelect={goToPage}
        onCreate={() => setSheetOpen(true)}
      />

      <NewBoardSheet
        visible={sheetOpen}
        onCancel={() => setSheetOpen(false)}
        onCreate={handleCreateBoard}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sky },
  // flex:1 here plus the explicit `height: listHeight` on each rendered page
  // (see onLayout above) is what keeps the board canvas's flex:1 chain from
  // resolving taller than the space actually reserved above the rail.
  list: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  emptySettings: { position: 'absolute', top: 0, right: spacing.md, zIndex: 1 },
  emptyIconCircle: {
    width: 52, height: 52,
    borderRadius: radii.full,
    backgroundColor: colors.cardAlt,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: { fontSize: 18, fontFamily: fonts.display, color: colors.inkDark, marginBottom: 8 },
  emptySubtitle: { fontSize: 13, fontFamily: fonts.text, color: colors.inkFaint, textAlign: 'center', lineHeight: 20, marginBottom: spacing.lg, },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.ms,
    borderRadius: radii.full, backgroundColor: colors.terra,
    ...shadows.button,
  },
  emptyBtnText: { fontSize: 15, fontFamily: fonts.display, color: colors.white },
});
