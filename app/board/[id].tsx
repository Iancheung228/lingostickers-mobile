import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ArrowLeft, LayoutGrid, Plus, Sparkles } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useBoardStickers } from '@/hooks/useBoards';
import { supabase } from '@/lib/supabase';
import { Board, BoardStickerWithSticker, Sticker } from '@/lib/types';
import BoardCanvas from '@/components/BoardCanvas';
import StickerDetailView from '@/components/StickerDetailView';
import StickerPickerModal from '@/components/StickerPickerModal';
import { colors, shadows, radii, spacing, fonts } from '@/constants/theme';

export default function BoardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { profile, refetch: refetchProfile } = useProfile(user?.id);
  const { items, loading, addSticker, removeSticker, updatePosition, autoArrange, refetch: refetchItems } = useBoardStickers(id);
  const [board, setBoard] = useState<Board | null>(null);
  const [selectedSticker, setSelectedSticker] = useState<Sticker | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const autoPromptedRef = useRef(false);

  // A freshly created board has nothing on it — jump straight to picking
  // stickers instead of landing on a bare canvas the user has to notice
  // the + button on. Only fires once per visit to this screen.
  useEffect(() => {
    if (!loading && items.length === 0 && !autoPromptedRef.current) {
      autoPromptedRef.current = true;
      setPickerOpen(true);
    }
  }, [loading, items.length]);

  const fetchBoard = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from('boards').select('*').eq('id', id).single();
    if (data) setBoard(data as Board);
  }, [id]);

  useFocusEffect(useCallback(() => {
    fetchBoard();
    refetchItems();
    refetchProfile();
  }, [fetchBoard, refetchItems, refetchProfile]));

  const handlePickSticker = async (sticker: Sticker) => {
    if (!user) return;
    const alreadyOnBoard = items.some(i => i.sticker_id === sticker.id);
    if (alreadyOnBoard) {
      await removeSticker(sticker.id, canvasSize);
      return;
    }
    await addSticker(sticker.id, user.id, canvasSize);
  };

  const handleRemove = (item: BoardStickerWithSticker) => {
    removeSticker(item.sticker_id, canvasSize);
  };

  const patchSticker = useCallback((patchId: string, patch: Partial<Sticker>) => {
    setSelectedSticker(prev => prev && prev.id === patchId ? { ...prev, ...patch } : prev);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <ArrowLeft size={18} color={colors.inkMid} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{board?.name ?? 'Board'}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => router.replace('/boards')}
            style={styles.addBtn}
            hitSlop={8}
          >
            <LayoutGrid size={16} color={colors.inkDark} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => autoArrange(canvasSize)}
            disabled={items.length === 0}
            style={[styles.addBtn, items.length === 0 && styles.addBtnDisabled]}
            hitSlop={8}
          >
            <Sparkles size={16} color={colors.inkDark} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setPickerOpen(true)} style={styles.addBtn} hitSlop={8}>
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
            displayStyle={profile?.wall_display_style ?? 'framed'}
            borderStyle={profile?.cutout_border_style ?? 'shadow'}
            canvasSize={canvasSize}
            onSelectSticker={setSelectedSticker}
            onMove={updatePosition}
            onRemove={handleRemove}
            backgroundPath={profile?.wall_background_path}
            backgroundDim={profile?.wall_background_dim}
          />
        )}
        {!loading && items.length === 0 && (
          <View style={styles.empty} pointerEvents="none">
            <Text style={styles.emptyTitle}>Nothing here yet</Text>
            <Text style={styles.emptySubtitle}>Tap + to add stickers from your collection.</Text>
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
        currentUserId={user?.id}
        title="Add to Board"
        selectedIds={new Set(items.map(i => i.sticker_id))}
        onSelect={handlePickSticker}
        onClose={() => setPickerOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sky },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.ms,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  addBtnDisabled: { opacity: 0.4 },
  title: { flex: 1, fontSize: 15, fontFamily: fonts.cozy, color: colors.inkDark, textAlign: 'center' },
  hint: { fontSize: 10, color: colors.inkFaint, fontWeight: '600', textAlign: 'center', marginBottom: spacing.sm },
  canvasWrap: { flex: 1, marginHorizontal: spacing.md, marginBottom: spacing.md },
  loader: { flex: 1 },
  empty: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  emptyTitle: { fontSize: 18, fontFamily: fonts.cozy, color: colors.inkDark, marginBottom: 8 },
  emptySubtitle: { fontSize: 13, color: colors.inkFaint, textAlign: 'center', lineHeight: 20 },
});
