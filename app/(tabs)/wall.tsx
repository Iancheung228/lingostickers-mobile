import { useCallback, useMemo, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Sticker as StickerIcon } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useBoards, useBoardPreviews } from '@/hooks/useBoards';
import BoardCarouselPage from '@/components/BoardCarouselPage';
import BoardTiles from '@/components/BoardTiles';
import { useRequireOnline } from '@/hooks/useRequireOnline';
import NewBoardSheet from '@/components/NewBoardSheet';
import type { StagedBackground } from '@/lib/backgroundLibrary';
import RoseBand from '@/components/RoseBand';
import EmptyState from '@/components/ui/EmptyState';
import { usePendingDeletes } from '@/components/PendingDeleteProvider';
import { TAB_BAR_CLEARANCE } from '@/constants/tabBar';
import { useTheme, useThemedStyles, type Theme } from '@/hooks/useTheme';

// Boards: a two-up grid of board tiles (C-look 4). Tapping a tile opens that
// board's canvas in place, with a back arrow; the tab bar stays.
export default function WallScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { user } = useAuth();
  const { profile, refetch: refetchProfile } = useProfile();
  const {
    boards: fetchedBoards, createBoard, deleteBoard, renameBoard, setBoardBackground, setBoardBackgroundDim,
  } = useBoards(user?.id);
  const { previews, refetch: refetchPreviews } = useBoardPreviews(user?.id);
  const { pendingDeleteIds, deleteBoardWithUndo } = usePendingDeletes();
  // A board waiting out its undo window must not come back on a refetch.
  const boards = useMemo(
    () => (pendingDeleteIds.size ? fetchedBoards.filter(b => !pendingDeleteIds.has(b.id)) : fetchedBoards),
    [fetchedBoards, pendingDeleteIds],
  );
  const insets = useSafeAreaInsets();
  const { gate } = useRequireOnline();
  const [openId, setOpenId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const createdRef = useRef<string | null>(null);
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);
  // Background picked in the New board sheet, applied once the board opens.
  const createdBackgroundRef = useRef<StagedBackground | null>(null);
  const [initialBackground, setInitialBackground] = useState<StagedBackground | null>(null);

  useFocusEffect(useCallback(() => {
    refetchProfile();
    refetchPreviews();
  }, [refetchProfile, refetchPreviews]));

  // The open board vanishing (deleted, undo window open) closes the view.
  const openBoard = boards.find(b => b.id === openId) ?? null;

  const openCreate = () => { if (gate('Creating a board needs a connection.')) setSheetOpen(true); };

  const handleCreateBoard = async (name: string, background: StagedBackground | null) => {
    const { error, board } = await createBoard(name);
    // Land on the board just named, straight into "pick stickers", but only
    // once the sheet has finished dismissing: iOS drops a second Modal that is
    // presented while the first is still leaving.
    if (!error && board) { createdRef.current = board.id; createdBackgroundRef.current = background; }
    return { error };
  };

  const handleDeleteOpen = () => {
    if (!openBoard) return;
    const target = openBoard;
    setOpenId(null);
    deleteBoardWithUndo(target, () => deleteBoard(target.id), { onUndo: refetchPreviews });
  };

  const bottomPad = insets.bottom + TAB_BAR_CLEARANCE;

  return (
    <View style={[styles.container, openBoard && { paddingBottom: bottomPad }]}>
      {!openBoard && <RoseBand title="Boards" />}
      {openBoard ? (
        <BoardCarouselPage
          key={openBoard.id}
          board={openBoard}
          currentUserId={user?.id}
          displayStyle={profile?.wall_display_style ?? 'framed'}
          borderStyle={profile?.cutout_border_style ?? 'shadow'}
          isActive
          onBack={() => { setOpenId(null); refetchPreviews(); }}
          onDeleteBoard={handleDeleteOpen}
          onRenameBoard={renameBoard}
          onChangeBackground={setBoardBackground}
          onChangeBackgroundDim={setBoardBackgroundDim}
          onDragStateChange={() => {}}
          onContentChanged={refetchPreviews}
          autoOpenPicker={openBoard.id === justCreatedId}
          onAutoOpenHandled={() => setJustCreatedId(null)}
          initialBackground={openBoard.id === justCreatedId ? initialBackground : null}
          onInitialBackgroundHandled={() => setInitialBackground(null)}
        />
      ) : boards.length === 0 ? (
        <View style={styles.empty}>
          <EmptyState
            icon={<StickerIcon size={28} strokeWidth={1.75} color={colors.inkLight} />}
            title="No boards yet"
            body="A board is a page you arrange yourself. Pin any stickers from your collection onto it."
            actionLabel="New board"
            onAction={openCreate}
            testID="boards-empty"
          />
        </View>
      ) : (
        <BoardTiles
          boards={boards}
          previews={previews}
          onOpen={b => setOpenId(b.id)}
          onCreate={openCreate}
          bottomPad={bottomPad}
        />
      )}

      <NewBoardSheet
        visible={sheetOpen}
        onCancel={() => {
          setSheetOpen(false);
          const id = createdRef.current;
          if (id) {
            createdRef.current = null;
            setInitialBackground(createdBackgroundRef.current);
            createdBackgroundRef.current = null;
            setJustCreatedId(id);
            setOpenId(id);
          }
        }}
        onCreate={handleCreateBoard}
      />
    </View>
  );
}

const makeStyles = ({ colors }: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sky },
  empty: { flex: 1, justifyContent: 'center', paddingBottom: TAB_BAR_CLEARANCE },
});
