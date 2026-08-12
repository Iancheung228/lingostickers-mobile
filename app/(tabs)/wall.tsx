import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Sticker as StickerIcon } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useBoards } from '@/hooks/useBoards';
import { Board } from '@/lib/types';
import BoardCarouselPage from '@/components/BoardCarouselPage';
import CreateBoardCard from '@/components/CreateBoardCard';
import { colors, spacing, fonts } from '@/constants/theme';
import { TAB_BAR_CLEARANCE } from '@/constants/tabBar';

const CREATE_PAGE_ID = '__create__';
type PageItem = Board | { id: typeof CREATE_PAGE_ID };

export default function WallScreen() {
  const { user } = useAuth();
  const { profile, refetch: refetchProfile } = useProfile(user?.id);
  const { boards, createBoard, deleteBoard, setBoardBackground, setBoardBackgroundDim } = useBoards(user?.id);
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<PageItem>>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);
  // A horizontal FlatList's own outer frame resolves flex:1 fine, but each
  // rendered page (a row item) doesn't automatically stretch to that frame's
  // height — without a real height, the board canvas's flex:1 chain inside
  // it can measure taller than what's actually reserved above the floating
  // tab bar, letting it overlap the bar. Measuring the list's frame directly
  // and pinning every page to that height closes the gap.
  const [listHeight, setListHeight] = useState(0);

  useFocusEffect(useCallback(() => { refetchProfile(); }, [refetchProfile]));

  const pages: PageItem[] = [...boards, { id: CREATE_PAGE_ID }];

  // A newly created board lands at the front (useBoards prepends it) —
  // jump the carousel there so the user lands on the board they just named
  // instead of staying on the trailing "create" page.
  useEffect(() => {
    if (justCreatedId && boards.length > 0 && boards[0].id === justCreatedId) {
      listRef.current?.scrollToIndex({ index: 0, animated: true });
    }
  }, [justCreatedId, boards]);

  const handleCreateBoard = async (name: string) => {
    const { error, board } = await createBoard(name);
    if (!error && board) setJustCreatedId(board.id);
    return { error };
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <StickerIcon size={13} color={colors.inkDark} />
          <Text style={styles.title}>My Boards</Text>
        </View>
        <Text style={styles.subtitle}>Swipe to explore</Text>
      </View>

      <FlatList
        ref={listRef}
        style={styles.list}
        onLayout={(e) => setListHeight(e.nativeEvent.layout.height)}
        data={pages}
        keyExtractor={p => p.id}
        horizontal
        pagingEnabled
        scrollEnabled={!dragging}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        getItemLayout={(_, index) => ({ length: screenWidth, offset: screenWidth * index, index })}
        onMomentumScrollEnd={(e) => {
          setPageIndex(Math.round(e.nativeEvent.contentOffset.x / screenWidth));
        }}
        renderItem={({ item }) => (
          <View style={{ width: screenWidth, height: listHeight || undefined }}>
            {item.id === CREATE_PAGE_ID ? (
              <CreateBoardCard onCreate={handleCreateBoard} />
            ) : (
              <BoardCarouselPage
                board={item as Board}
                currentUserId={user?.id}
                displayStyle={profile?.wall_display_style ?? 'framed'}
                borderStyle={profile?.cutout_border_style ?? 'shadow'}
                onDeleteBoard={deleteBoard}
                onChangeBackground={setBoardBackground}
                onChangeBackgroundDim={setBoardBackgroundDim}
                onDragStateChange={setDragging}
                autoOpenPicker={item.id === justCreatedId}
                onAutoOpenHandled={() => setJustCreatedId(null)}
              />
            )}
          </View>
        )}
      />

      {pages.length > 1 && (
        <View style={styles.dots}>
          {pages.map((p, i) => (
            <View
              key={p.id}
              style={[
                styles.dot,
                p.id === CREATE_PAGE_ID && styles.dotCreate,
                i === pageIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sky },
  header: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  // flex:1 here plus the explicit `height: listHeight` on each rendered page
  // (see onLayout above) is what keeps the board canvas's flex:1 chain from
  // resolving taller than the space actually reserved above the floating
  // tab bar.
  list: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { fontSize: 15, fontFamily: fonts.cozy, color: colors.inkDark },
  subtitle: { fontSize: 10, color: colors.inkFaint, fontWeight: '600', marginTop: 1 },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.borderLight },
  dotCreate: { borderRadius: 2, backgroundColor: colors.sageLight },
  dotActive: { backgroundColor: colors.terra, width: 16 },
});
