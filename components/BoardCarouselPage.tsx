import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import {
  Trash2, Plus, ImagePlus, ImageOff, MoreHorizontal, Pencil, Wand2, X, Crop, GraduationCap,
  ChevronLeft, Sticker as StickerIcon,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File, Paths } from 'expo-file-system';
import { useBoardStickers } from '@/hooks/useBoards';
import { supabase } from '@/lib/supabase';
import { useCoachMark } from '@/lib/coachMarks';
import { alertPermissionDenied } from '@/lib/permissions';
import {
  BackgroundCrop, Board, BoardStickerWithSticker, CropRect, Sticker,
  WallDisplayStyle, CutoutBorderStyle,
} from '@/lib/types';
import BoardCanvas from '@/components/BoardCanvas';
import RoseBand from '@/components/RoseBand';
import IconButton from '@/components/ui/IconButton';
import BoardMenu, { BoardMenuItem, MenuAnchor } from '@/components/BoardMenu';
import BackgroundCropper, { CropResult } from '@/components/BackgroundCropper';
import BackgroundDimSlider from '@/components/BackgroundDimSlider';
import { MAX_DIM_PCT } from '@/components/WallBackground';
import FieldEditor from '@/components/FieldEditor';
import StudyCard from '@/components/StudyCard';
import StudySessionHost from '@/components/StudySessionHost';
import { useToast } from '@/components/ToastProvider';
import { friendlyErrorSync } from '@/lib/friendlyError';
import { dueToday } from '@/lib/review';
import StickerPickerModal from '@/components/StickerPickerModal';
import { radii, spacing, fonts } from '@/constants/theme';
import { useTheme, useThemedStyles, type Theme } from '@/hooks/useTheme';

// Long side capped so a full-res photo library import doesn't balloon
// storage/bandwidth — matches the old global wall-background cap.
const BACKGROUND_MAX_SIDE = 1600;

// The uncropped source is kept only so the framing can be changed later, and
// it's never drawn at full size — so it's capped too, a little above the
// visible cap to leave real room to zoom into. Uncapped it would be the
// entire original photo, several MB per board, uploaded to be looked at
// approximately never.
const SOURCE_MAX_SIDE = 2048;

interface BoardCarouselPageProps {
  board: Board;
  currentUserId: string | undefined;
  displayStyle: WallDisplayStyle;
  borderStyle: CutoutBorderStyle;
  /// True for the page the carousel is actually showing. Every board is
  /// mounted at once, so anything that must happen once per *viewing* — the
  /// one-time coach mark below — has to be gated on this rather than on
  /// mount, or every off-screen page burns it simultaneously.
  isActive: boolean;
  /// Back to the Boards grid.
  onBack: () => void;
  /// Delete is an undo toast owned by the Boards screen (deferred delete); it also leaves this view.
  onDeleteBoard: () => void;
  onRenameBoard: (id: string, name: string) => Promise<{ error: Error | null }>;
  onChangeBackground: (boardId: string, path: string | null, crop?: BackgroundCrop | null) => Promise<{ error: Error | null }>;
  onChangeBackgroundDim: (boardId: string, dim: number) => Promise<{ error: Error | null }>;
  onDragStateChange: (dragging: boolean) => void;
  // Fired whenever this board's sticker set or cover photo changes. The
  // bottom rail draws its own thumbnails from a separate read-only query
  // (useBoardPreviews), so without this it would keep showing a stale
  // miniature of a board you just edited — skills.md #1, two copies of the
  // same data drifting apart.
  onContentChanged: () => void;
  // Set true for exactly the board the user just created, so this page can
  // jump straight into "pick stickers" instead of showing a bare canvas the
  // user has to notice the + button on. Cleared via onAutoOpenHandled once
  // consumed, so re-focusing this page later never re-triggers it.
  autoOpenPicker: boolean;
  onAutoOpenHandled: () => void;
}

const COVER_UNDO_MS = 6500;

export default function BoardCarouselPage({
  board, currentUserId, displayStyle, borderStyle, isActive,
  onBack, onDeleteBoard, onRenameBoard, onChangeBackground, onChangeBackgroundDim,
  onDragStateChange, onContentChanged,
  autoOpenPicker, onAutoOpenHandled,
}: BoardCarouselPageProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const {
    items, loading, addSticker, removeSticker, updatePosition, autoArrange, refetch: refetchItems,
  } = useBoardStickers(board.id);
  const toast = useToast();
  const [selectedSticker, setSelectedSticker] = useState<Sticker | null>(null);
  const [studyQueue, setStudyQueue] = useState<Sticker[] | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [pickedBackgroundAsset, setPickedBackgroundAsset] = useState<{ uri: string; width: number; height: number } | null>(null);
  // board.background_path is a fixed filename (see handleCropConfirm) so it
  // reads identically before and after a re-upload — bump this alongside it
  // so WallBackground actually re-fetches a fresh signed URL instead of
  // silently keeping the old photo on screen. See WallBackground.tsx.
  const [backgroundVersion, setBackgroundVersion] = useState(0);
  // Live value while the tint slider is being dragged — overrides
  // board.background_dim for the canvas preview so the tint updates in real
  // time as you drag, before the actual DB write (which only fires on
  // release). Null once nothing is in-flight.
  const [previewDimPct, setPreviewDimPct] = useState<number | null>(null);
  // Set only when the cropper was opened on the *existing* background rather
  // than a newly picked photo, so it reopens on the saved framing instead of
  // a centred fit. See BackgroundCropper's initialCrop.
  const [editingCrop, setEditingCrop] = useState<CropRect | null>(null);
  const [loadingSource, setLoadingSource] = useState(false);
  // The local copy of the stored source, while repositioning. Confirming a
  // reposition hands back this very file untouched unless the user rotated,
  // so comparing against it is what lets the upload below skip re-sending a
  // multi-megabyte photo that hasn't changed a byte.
  const storedSourceUriRef = useRef<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const autoPromptedRef = useRef(false);
  const menuAnchorRef = useRef<View>(null);

  const dragCoach = useCoachMark('board-drag', isActive && !loading && items.length > 0);
  const [dragged, setDragged] = useState(false);

  useEffect(() => {
    if (autoOpenPicker && !autoPromptedRef.current) {
      autoPromptedRef.current = true;
      setPickerOpen(true);
      onAutoOpenHandled();
    }
  }, [autoOpenPicker, onAutoOpenHandled]);

  const handlePickSticker = async (sticker: Sticker) => {
    if (!currentUserId) return;
    const alreadyOnBoard = items.some(i => i.sticker_id === sticker.id);
    if (alreadyOnBoard) {
      await removeSticker(sticker.id, canvasSize);
    } else {
      await addSticker(sticker.id, currentUserId, canvasSize);
    }
    onContentChanged();
  };

  const handleRemove = async (item: BoardStickerWithSticker) => {
    await removeSticker(item.sticker_id, canvasSize);
    onContentChanged();
  };

  // The third way off a board, alongside the drag-to-bin gesture and
  // re-tapping a checked sticker in the picker. It exists because the only
  // destructive control the open card had was "Delete card", which removes
  // the sticker from the whole collection — same trash glyph, a far wider
  // blast radius, and no narrower option next to it.
  const handleUnpinSelected = useCallback(async () => {
    if (!selectedSticker) return;
    await removeSticker(selectedSticker.id, canvasSize);
    setSelectedSticker(null);
    onContentChanged();
  }, [selectedSticker, removeSticker, canvasSize, onContentChanged]);

  const patchSticker = useCallback((patchId: string, patch: Partial<Sticker>) => {
    setSelectedSticker(prev => prev && prev.id === patchId ? { ...prev, ...patch } : prev);
  }, []);

  // Delete is undoable (a toast), so there is no confirm; the stickers stay in the collection.
  const handleDelete = () => onDeleteBoard();

  // Study the due cards on this board. The session host takes any list of cards,
  // so a board is just a subset of the collection.
  const handleStudy = () => {
    const due = dueToday(items.map(i => i.sticker));
    if (due.length === 0) {
      toast.show({ kind: 'info', message: 'Nothing due on this board.' });
      return;
    }
    setStudyQueue(due);
  };

  const handleRename = async (values: Record<string, string>) => {
    const next = (values.name ?? '').trim();
    if (!next || next === board.name) { setRenaming(false); return; }
    setSavingName(true);
    const { error } = await onRenameBoard(board.id, next);
    setSavingName(false);
    setRenaming(false);
    if (error) toast.show({ kind: 'error', message: friendlyErrorSync(error, "Couldn't rename the board. Try again.") });
  };

  // Picking only stages the photo into the cropper (see BackgroundCropper) —
  // the actual resize/upload happens once the user confirms a crop in
  // handleCropConfirm, so nobody uploads a photo they haven't previewed.
  const handlePickBackground = async () => {
    if (!currentUserId || uploadingBackground) return;
    const { granted, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      alertPermissionDenied(
        'Photos Access Needed',
        'Tabi Stickers needs access to your photo library to set a board background.',
        canAskAgain
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    const asset = !result.canceled ? result.assets[0] : null;
    if (!asset) return;
    setEditingCrop(null);
    storedSourceUriRef.current = null;
    setPickedBackgroundAsset({ uri: asset.uri, width: asset.width, height: asset.height });
  };

  // Sibling of background_path, derived by convention rather than stored —
  // exactly as background_path itself is (see 032_board_background_crop.sql).
  const sourcePath = currentUserId
    ? `${currentUserId}/board-${board.id}-background-source.jpg`
    : null;

  // Reopen the editor on the photo already up there. This needs the
  // *uncropped* source: the file being displayed was cut to the canvas frame,
  // and an image that exactly covers its frame has no pan range left at all,
  // so reopening on that would offer nothing to reposition.
  const handleRepositionBackground = async () => {
    if (!sourcePath || !board.background_crop || loadingSource) return;
    setLoadingSource(true);
    try {
      const { data, error } = await supabase.storage
        .from('sticker-images')
        .createSignedUrl(sourcePath, 3600);
      if (error || !data) throw error ?? new Error('Could not read the original photo');

      // Re-downloaded rather than cached across opens: it's a throwaway the
      // OS may evict at any point, and one fetch per reposition is cheaper
      // than reasoning about a stale copy.
      const dest = new File(Paths.cache, `board-${board.id}-source.jpg`);
      if (dest.exists) dest.delete();
      const downloaded = await File.downloadFileAsync(data.signedUrl, dest);

      const { sw, sh, ...crop } = board.background_crop;
      storedSourceUriRef.current = downloaded.uri;
      setEditingCrop(crop);
      setPickedBackgroundAsset({ uri: downloaded.uri, width: sw, height: sh });
    } catch (err: any) {
      toast.show({ kind: 'error', message: friendlyErrorSync(err, "Couldn't open the original photo. Try again.") });
    } finally {
      setLoadingSource(false);
    }
  };

  // Uploads two files: the cropped photo that gets drawn, and the source it
  // was cut from so the framing stays editable. Paths are keyed by board id
  // (not just user id) since each board has its own independent photo.
  const handleCropConfirm = async (result: CropResult) => {
    if (!currentUserId || !sourcePath) return;
    setPickedBackgroundAsset(null);
    setEditingCrop(null);
    setUploadingBackground(true);
    const storedSourceUri = storedSourceUriRef.current;
    storedSourceUriRef.current = null;
    try {
      const path = `${currentUserId}/board-${board.id}-background.jpg`;
      const bytes = await new File(result.uri).bytes();
      const { error: uploadError } = await supabase.storage
        .from('sticker-images')
        .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;

      // Repositioning without rotating re-crops the source we just
      // downloaded, so the stored copy is already byte-identical — only its
      // crop rect moved. Re-uploading it would spend megabytes to write back
      // exactly what's there.
      const unchanged = result.source.uri === storedSourceUri;
      let crop: BackgroundCrop | null = unchanged && board.background_crop
        ? { ...result.crop, sw: board.background_crop.sw, sh: board.background_crop.sh }
        : null;

      if (!unchanged) {
        const source = await shrinkForStorage(result.source);
        const sourceBytes = await new File(source.uri).bytes();
        const { error: sourceError } = await supabase.storage
          .from('sticker-images')
          .upload(sourcePath, sourceBytes, { contentType: 'image/jpeg', upsert: true });
        // A missing source costs this board the Reposition option and
        // nothing else — the background itself is already uploaded and
        // correct, so it isn't worth failing the whole operation over.
        crop = sourceError ? null : { ...result.crop, sw: source.width, sh: source.height };
      }

      const { error } = await onChangeBackground(board.id, path, crop);
      if (error) throw error;
      setBackgroundVersion(v => v + 1);
      onContentChanged();
    } catch (err: any) {
      toast.show({ kind: 'error', message: friendlyErrorSync(err, "Couldn't set the background. Try again.") });
    } finally {
      setUploadingBackground(false);
    }
  };

  // Removing a cover is an undo toast, not a confirm (B-app 8). The row is
  // cleared at once; the stored files go only after the undo window closes, so
  // Undo can put the very same photo and crop back.
  const handleRemoveBackground = async () => {
    if (!board.background_path) return;
    const path = board.background_path;
    const crop = board.background_crop ?? null;
    const files = sourcePath ? [path, sourcePath] : [path];
    const { error } = await onChangeBackground(board.id, null);
    if (error) { toast.show({ kind: 'error', message: friendlyErrorSync(error, "Couldn't remove the cover photo. Try again.") }); return; }
    onContentChanged();
    let undone = false;
    const timer = setTimeout(() => {
      if (!undone) void supabase.storage.from('sticker-images').remove(files);
    }, COVER_UNDO_MS);
    toast.show({
      kind: 'undo',
      message: 'Cover photo removed',
      action: {
        label: 'Undo',
        onPress: () => {
          undone = true;
          clearTimeout(timer);
          void onChangeBackground(board.id, path, crop).then(({ error: e }) => {
            if (e) toast.show({ kind: 'error', message: friendlyErrorSync(e, "Couldn't bring the cover photo back.") });
            else onContentChanged();
          });
        },
      },
    });
  };

  // Only the actual release commits to the DB (see BackgroundDimSlider) —
  // this just drives the live canvas preview while dragging.
  const handlePreviewDim = useCallback((pct: number) => {
    setPreviewDimPct(pct);
  }, []);

  const handleCommitDim = useCallback(async (pct: number) => {
    const { error } = await onChangeBackgroundDim(board.id, pct);
    if (error) toast.show({ kind: 'error', message: friendlyErrorSync(error, "Couldn't change the tint. Try again.") });
    // board.background_dim now reflects pct (or reverted back on error) —
    // safe to stop overriding it with the preview.
    setPreviewDimPct(null);
  }, [board.id, onChangeBackgroundDim, toast]);

  const openMenu = () => {
    menuAnchorRef.current?.measureInWindow((x, y, _w, h) => {
      setMenuAnchor({ x, y: y + h });
      setMenuOpen(true);
    });
  };

  // Everything a board can have done *to it*, in one place. Previously each
  // of these needed its own top-level control, which is why rename had
  // nowhere to live at all, why autoArrange shipped unreachable, and why
  // changing the cover photo was an unlabelled 26pt icon floating over the
  // canvas with "remove" hidden behind a long-press on it.
  const menuItems: BoardMenuItem[] = [
    { key: 'study', label: 'Study this board', icon: GraduationCap, disabled: items.length === 0, onPress: handleStudy },
    { key: 'rename', label: 'Rename board', icon: Pencil, onPress: () => setRenaming(true) },
    {
      key: 'tidy',
      label: 'Tidy up the layout',
      icon: Wand2,
      disabled: items.length === 0,
      onPress: () => autoArrange(canvasSize),
    },
    {
      key: 'cover',
      label: board.background_path ? 'Change cover photo' : 'Add a cover photo',
      icon: ImagePlus,
      disabled: uploadingBackground,
      onPress: handlePickBackground,
    },
    // Only offered when there's a source to re-crop. A background uploaded
    // before 032_board_background_crop.sql has none, so it can be replaced
    // but not repositioned — replacing it once writes a source and the
    // option appears from then on.
    ...(board.background_path && board.background_crop ? [{
      key: 'cover-reposition',
      label: 'Reposition cover photo',
      icon: Crop,
      disabled: loadingSource,
      onPress: handleRepositionBackground,
    }] : []),
    ...(board.background_path ? [{
      key: 'cover-remove',
      label: 'Remove cover photo',
      icon: ImageOff,
      onPress: handleRemoveBackground,
    }] : []),
    { key: 'delete', label: 'Delete board', icon: Trash2, destructive: true, separated: true, onPress: handleDelete },
  ];

  return (
    <View style={styles.page}>
      {/* The board's name replaces "Boards" in the band, with back on the
          left and the board's actions on the right, so there is no second
          title row under it. Rename lives in the "…" menu. */}
      <RoseBand
        title={board.name}
        leading={
          <IconButton onPress={onBack} label="Back to boards" testID="board-back">
            <ChevronLeft size={22} strokeWidth={1.75} color={colors.inkDark} />
          </IconButton>
        }
        right={
          <View style={styles.bandActions}>
            <TouchableOpacity
              onPress={() => setPickerOpen(true)}
              style={styles.addBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Add stickers to this board"
            >
              <Plus size={15} color={colors.white} strokeWidth={2.75} />
              <Text style={styles.addText}>Add</Text>
            </TouchableOpacity>
            <View ref={menuAnchorRef} collapsable={false}>
              <IconButton onPress={openMenu} label="Board options" loading={uploadingBackground || loadingSource}>
                <MoreHorizontal size={20} strokeWidth={1.75} color={colors.inkDark} />
              </IconButton>
            </View>
          </View>
        }
      />

      <View
        style={styles.canvasWrap}
        onLayout={(e) => setCanvasSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      >
        {loading ? (
          <ActivityIndicator style={styles.loader} color={colors.terraInk} size="large" />
        ) : (
          <BoardCanvas
            items={items}
            displayStyle={displayStyle}
            borderStyle={borderStyle}
            canvasSize={canvasSize}
            onSelectSticker={setSelectedSticker}
            onMove={updatePosition}
            onRemove={handleRemove}
            onDragStart={() => onDragStateChange(true)}
            onDragEnd={() => { onDragStateChange(false); if (dragCoach.visible) { setDragged(true); dragCoach.dismiss(); } }}
            backgroundPath={board.background_path}
            backgroundDim={previewDimPct ?? board.background_dim}
            backgroundVersion={backgroundVersion}
          />
        )}

        {/* box-none so only the button inside actually takes touches — the
            canvas underneath keeps its own. */}
        {!loading && items.length === 0 && (
          <View style={styles.empty} pointerEvents="box-none">
            <View style={styles.emptyIconCircle}>
              <StickerIcon size={22} color={colors.inkDark} />
            </View>
            <Text style={styles.emptyTitle}>Nothing here yet</Text>
            <Text style={styles.emptySubtitle}>Pin stickers from your collection to start this board.</Text>
            {/* The empty state *is* the button. It used to be
                pointerEvents="none" text pointing at a control elsewhere,
                which spends the most teachable moment on a caption. */}
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setPickerOpen(true)} activeOpacity={0.85}>
              <Plus size={16} color={colors.white} strokeWidth={2.5} />
              <Text style={styles.emptyBtnText}>Add stickers</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Only meaningful once there's a photo to tint — the default
            default background doesn't use the dim scrim at all. */}
        {board.background_path && (
          <View style={styles.tintSliderWrap}>
            <BackgroundDimSlider
              value={board.background_dim}
              maxPct={MAX_DIM_PCT}
              onPreviewChange={handlePreviewDim}
              onCommit={handleCommitDim}
            />
          </View>
        )}
      </View>

      {/* In flow, under the canvas: it never covers a sticker. Hidden once
          dismissed (the coach mark persists that) or after a first drag. */}
      {dragCoach.visible && !dragged && (
        <TouchableOpacity style={styles.coach} onPress={dragCoach.dismiss} activeOpacity={0.9} accessibilityRole="button" accessibilityLabel="Dismiss tip">
          <Text style={styles.coachText}>
            Hold a sticker to drag it. Drop it on the bin to take it off this board. It stays in your collection.
          </Text>
          <X size={14} color={colors.inkMid} />
        </TouchableOpacity>
      )}

      <BoardMenu
        visible={menuOpen}
        anchor={menuAnchor}
        items={menuItems}
        onClose={() => setMenuOpen(false)}
      />

      <FieldEditor
        spec={renaming ? {
          title: 'Rename board',
          subtitle: 'Just for you — this is the name shown on the Boards tab.',
          inputs: [{ key: 'name', value: board.name, placeholder: 'e.g. Tokyo Trip' }],
        } : null}
        saving={savingName}
        onCancel={() => setRenaming(false)}
        onSave={handleRename}
      />

      <StudySessionHost
        queue={studyQueue}
        onExit={() => { setStudyQueue(null); refetchItems(); }}
      />

      <StudyCard
        sticker={selectedSticker}
        onClose={() => setSelectedSticker(null)}
        onDeleted={() => { setSelectedSticker(null); refetchItems(); onContentChanged(); }}
        onUpdate={patchSticker}
        onRemoveFromBoard={{ boardName: board.name, remove: handleUnpinSelected }}
      />

      <StickerPickerModal
        visible={pickerOpen}
        currentUserId={currentUserId}
        title={`Add to ${board.name}`}
        selectedIds={new Set(items.map(i => i.sticker_id))}
        selectionNoun="on this board"
        onSelect={handlePickSticker}
        onClose={() => setPickerOpen(false)}
      />

      <BackgroundCropper
        asset={pickedBackgroundAsset}
        frameWidth={canvasSize.width}
        frameHeight={canvasSize.height}
        maxOutputSide={BACKGROUND_MAX_SIDE}
        initialCrop={editingCrop}
        onCancel={() => {
          setPickedBackgroundAsset(null);
          setEditingCrop(null);
          storedSourceUriRef.current = null;
        }}
        onConfirm={handleCropConfirm}
      />
    </View>
  );
}

// The source is kept for re-cropping, never drawn, so it's stored at
// SOURCE_MAX_SIDE rather than whatever the camera produced. Fractions are
// what get persisted alongside it (see CropResult), so shrinking here leaves
// the recorded framing exactly as valid as it was.
async function shrinkForStorage(source: { uri: string; width: number; height: number }) {
  const longSide = Math.max(source.width, source.height);
  if (longSide <= SOURCE_MAX_SIDE) return source;
  const ratio = SOURCE_MAX_SIDE / longSide;
  const rendered = await ImageManipulator.manipulate(source.uri)
    .resize({ width: Math.round(source.width * ratio), height: Math.round(source.height * ratio) })
    .renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
  return { uri: saved.uri, width: rendered.width, height: rendered.height };
}

const makeStyles = ({ colors, shadows }: Theme) => StyleSheet.create({
  page: { flex: 1 },
  bandActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 34,
    paddingHorizontal: spacing.ms,
    borderRadius: radii.full,
    backgroundColor: colors.terra,
    ...shadows.button,
  },
  addText: { fontSize: 13, fontFamily: fonts.display, color: colors.white },
  canvasWrap: { flex: 1, marginHorizontal: spacing.md, marginTop: spacing.md, marginBottom: spacing.md },
  loader: { flex: 1 },
  empty: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: radii.full,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: { fontSize: 18, fontFamily: fonts.display, color: colors.inkDark, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, fontFamily: fonts.text, color: colors.inkLight, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.ms,
    borderRadius: radii.full, backgroundColor: colors.terra,
    ...shadows.button,
  },
  emptyBtnText: { fontSize: 15, fontFamily: fonts.display, color: colors.white },
  coach: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.md, marginBottom: spacing.md, minHeight: 44,
    paddingHorizontal: spacing.ms, paddingVertical: spacing.sm,
    borderRadius: radii.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  coachText: { flex: 1, fontSize: 12, fontFamily: fonts.display, color: colors.inkMid, lineHeight: 17 },
  tintSliderWrap: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
  },
});
