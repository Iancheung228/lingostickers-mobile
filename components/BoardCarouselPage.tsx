import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Trash2, Plus, Sparkles, ImagePlus, Sticker as StickerIcon } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { useBoardStickers } from '@/hooks/useBoards';
import { supabase } from '@/lib/supabase';
import { Board, BoardStickerWithSticker, Sticker, WallDisplayStyle, CutoutBorderStyle } from '@/lib/types';
import BoardCanvas from '@/components/BoardCanvas';
import BackgroundCropper from '@/components/BackgroundCropper';
import BackgroundDimSlider from '@/components/BackgroundDimSlider';
import { MAX_DIM_PCT } from '@/components/WallBackground';
import StickerDetailView from '@/components/StickerDetailView';
import StickerPickerModal from '@/components/StickerPickerModal';
import { colors, shadows, radii, spacing, fonts } from '@/constants/theme';

// Long side capped so a full-res photo library import doesn't balloon
// storage/bandwidth — matches the old global wall-background cap.
const BACKGROUND_MAX_SIDE = 1600;

interface BoardCarouselPageProps {
  board: Board;
  currentUserId: string | undefined;
  displayStyle: WallDisplayStyle;
  borderStyle: CutoutBorderStyle;
  onDeleteBoard: (id: string) => Promise<{ error: Error | null }>;
  onChangeBackground: (boardId: string, path: string | null) => Promise<{ error: Error | null }>;
  onChangeBackgroundDim: (boardId: string, dim: number) => Promise<{ error: Error | null }>;
  onDragStateChange: (dragging: boolean) => void;
  // Set true for exactly the board the user just created, so this page can
  // jump straight into "pick stickers" instead of showing a bare canvas the
  // user has to notice the + button on. Cleared via onAutoOpenHandled once
  // consumed, so re-focusing this page later never re-triggers it.
  autoOpenPicker: boolean;
  onAutoOpenHandled: () => void;
}

export default function BoardCarouselPage({
  board, currentUserId, displayStyle, borderStyle,
  onDeleteBoard, onChangeBackground, onChangeBackgroundDim, onDragStateChange, autoOpenPicker, onAutoOpenHandled,
}: BoardCarouselPageProps) {
  const { items, loading, addSticker, removeSticker, updatePosition, autoArrange, refetch: refetchItems } = useBoardStickers(board.id);
  const [selectedSticker, setSelectedSticker] = useState<Sticker | null>(null);
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
  const autoPromptedRef = useRef(false);

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
      return;
    }
    await addSticker(sticker.id, currentUserId, canvasSize);
  };

  const handleRemove = (item: BoardStickerWithSticker) => {
    removeSticker(item.sticker_id, canvasSize);
  };

  const patchSticker = useCallback((patchId: string, patch: Partial<Sticker>) => {
    setSelectedSticker(prev => prev && prev.id === patchId ? { ...prev, ...patch } : prev);
  }, []);

  const handleDelete = () => {
    Alert.alert('Delete Board', `Remove "${board.name}"? Your stickers stay in your collection.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const { error } = await onDeleteBoard(board.id);
          if (error) Alert.alert("Couldn't delete", error.message);
        },
      },
    ]);
  };

  // Picking only stages the photo into the cropper (see BackgroundCropper) —
  // the actual resize/upload happens once the user confirms a crop in
  // handleCropConfirm, so nobody uploads a photo they haven't previewed.
  const handlePickBackground = async () => {
    if (!currentUserId || uploadingBackground) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Photos Access Needed', 'LingoStickers needs access to your photo library to set a board background.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    const asset = !result.canceled ? result.assets[0] : null;
    if (!asset) return;
    setPickedBackgroundAsset({ uri: asset.uri, width: asset.width, height: asset.height });
  };

  // The cropper has already cropped, resized, and compressed the file, so
  // this just uploads it. Path is keyed by board id (not just user id) since
  // each board now has its own independent photo.
  const handleCropConfirm = async (localUri: string) => {
    if (!currentUserId) return;
    setPickedBackgroundAsset(null);
    setUploadingBackground(true);
    try {
      const path = `${currentUserId}/board-${board.id}-background.jpg`;
      const bytes = await new File(localUri).bytes();
      const { error: uploadError } = await supabase.storage
        .from('sticker-images')
        .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;

      const { error } = await onChangeBackground(board.id, path);
      if (error) throw error;
      setBackgroundVersion(v => v + 1);
    } catch (err: any) {
      Alert.alert("Couldn't set background", err?.message ?? 'Something went wrong.');
    } finally {
      setUploadingBackground(false);
    }
  };

  const handleRemoveBackground = () => {
    if (!board.background_path) return;
    Alert.alert(
      'Remove background',
      'Go back to the default corkboard look?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            const path = board.background_path!;
            const { error } = await onChangeBackground(board.id, null);
            if (error) { Alert.alert("Couldn't remove background", error.message); return; }
            await supabase.storage.from('sticker-images').remove([path]);
          },
        },
      ]
    );
  };

  // Only the actual release commits to the DB (see BackgroundDimSlider) —
  // this just drives the live canvas preview while dragging.
  const handlePreviewDim = useCallback((pct: number) => {
    setPreviewDimPct(pct);
  }, []);

  const handleCommitDim = useCallback(async (pct: number) => {
    const { error } = await onChangeBackgroundDim(board.id, pct);
    if (error) Alert.alert("Couldn't update tint", error.message);
    // board.background_dim now reflects pct (or reverted back on error) —
    // safe to stop overriding it with the preview.
    setPreviewDimPct(null);
  }, [board.id, onChangeBackgroundDim]);

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleDelete} style={styles.iconBtn} hitSlop={8}>
          <Trash2 size={16} color={colors.inkMid} />
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>{board.name}</Text>
          <Text style={styles.subtitle}>{items.length} sticker{items.length === 1 ? '' : 's'}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => autoArrange(canvasSize)}
            disabled={items.length === 0}
            style={[styles.iconBtn, items.length === 0 && styles.iconBtnDisabled]}
            hitSlop={8}
          >
            <Sparkles size={16} color={colors.inkDark} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setPickerOpen(true)} style={styles.iconBtn} hitSlop={8}>
            <Plus size={18} color={colors.inkDark} />
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.hint}>Hold and drag to move · drop on the trash to remove</Text>

      <View
        style={styles.canvasWrap}
        onLayout={(e) => setCanvasSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      >
        {loading ? (
          <ActivityIndicator style={styles.loader} color={colors.terra} size="large" />
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
            onDragEnd={() => onDragStateChange(false)}
            backgroundPath={board.background_path}
            backgroundDim={previewDimPct ?? board.background_dim}
            backgroundVersion={backgroundVersion}
          />
        )}
        {!loading && items.length === 0 && (
          <View style={styles.empty} pointerEvents="none">
            <View style={styles.emptyIconCircle}>
              <StickerIcon size={22} color={colors.inkDark} />
            </View>
            <Text style={styles.emptyTitle}>Nothing here yet</Text>
            <Text style={styles.emptySubtitle}>Tap + to add stickers from your collection.</Text>
          </View>
        )}

        {/* Matches MiniStickerWall's corner cover-photo button — tap to
            change, long-press to remove — so both places this appears
            (home preview, individual boards) feel like the same control. */}
        <TouchableOpacity
          style={styles.editBackgroundBtn}
          onPress={handlePickBackground}
          onLongPress={board.background_path ? handleRemoveBackground : undefined}
          delayLongPress={400}
          disabled={uploadingBackground}
          hitSlop={8}
          activeOpacity={0.8}
        >
          {uploadingBackground ? (
            <ActivityIndicator size="small" color={colors.inkDark} />
          ) : (
            <ImagePlus size={14} color={colors.inkDark} />
          )}
        </TouchableOpacity>

        {/* Only meaningful once there's a photo to tint — the default
            corkboard background doesn't use the dim scrim at all. */}
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

      <StickerDetailView
        sticker={selectedSticker}
        onClose={() => setSelectedSticker(null)}
        onDelete={() => { setSelectedSticker(null); refetchItems(); }}
        onUpdate={patchSticker}
      />

      <StickerPickerModal
        visible={pickerOpen}
        currentUserId={currentUserId}
        title={`Add to ${board.name}`}
        selectedIds={new Set(items.map(i => i.sticker_id))}
        onSelect={handlePickSticker}
        onClose={() => setPickerOpen(false)}
      />

      <BackgroundCropper
        asset={pickedBackgroundAsset}
        frameWidth={canvasSize.width}
        frameHeight={canvasSize.height}
        maxOutputSide={BACKGROUND_MAX_SIDE}
        onCancel={() => setPickedBackgroundAsset(null)}
        onConfirm={handleCropConfirm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.ms,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  titleWrap: { flex: 1, alignItems: 'center' },
  title: { fontSize: 15, fontFamily: fonts.cozy, color: colors.inkDark, textAlign: 'center' },
  subtitle: { fontSize: 10, color: colors.inkFaint, fontWeight: '600', marginTop: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  iconBtnDisabled: { opacity: 0.4 },
  hint: { fontSize: 10, color: colors.inkFaint, fontWeight: '600', textAlign: 'center', marginBottom: spacing.sm },
  canvasWrap: { flex: 1, marginHorizontal: spacing.md, marginBottom: spacing.md },
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
  emptyTitle: { fontSize: 18, fontFamily: fonts.cozy, color: colors.inkDark, marginBottom: 8 },
  emptySubtitle: { fontSize: 13, color: colors.inkFaint, textAlign: 'center', lineHeight: 20 },
  editBackgroundBtn: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    width: 26,
    height: 26,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  tintSliderWrap: {
    position: 'absolute',
    left: spacing.sm + 26 + spacing.xs,
    bottom: spacing.sm,
  },
});
