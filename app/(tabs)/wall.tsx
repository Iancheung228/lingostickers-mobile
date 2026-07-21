import { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useBoards } from '@/hooks/useBoards';
import { supabase } from '@/lib/supabase';
import { Board, Sticker } from '@/lib/types';
import { buildChapters } from '@/lib/chapters';
import StickerBoard from '@/components/StickerBoard';
import StickerDetailView from '@/components/StickerDetailView';
import BoardsList from '@/components/BoardsList';
import { colors, shadows, radii, spacing, fonts } from '@/constants/theme';

type ViewMode = 'chapters' | 'boards';

export default function WallScreen() {
  const { user } = useAuth();
  const { profile, refetch: refetchProfile } = useProfile(user?.id);
  const { boards, loading: boardsLoading, createBoard, deleteBoard } = useBoards(user?.id);
  const [viewMode, setViewMode] = useState<ViewMode>('chapters');
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSticker, setSelectedSticker] = useState<Sticker | null>(null);

  const fetchStickers = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('stickers')
      .select('*')
      .eq('user_id', user.id)
      .order('discovered_at', { ascending: false });
    if (!error && data) setStickers(data as Sticker[]);
    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => { fetchStickers(); refetchProfile(); }, [fetchStickers, refetchProfile]));

  const patchSticker = useCallback((id: string, patch: Partial<Sticker>) => {
    setStickers(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
    setSelectedSticker(prev => prev && prev.id === id ? { ...prev, ...patch } : prev);
  }, []);

  const chapters = useMemo(() => buildChapters(stickers), [stickers]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📌 Cozy Sticker Wall</Text>
        <Text style={styles.subtitle}>
          {viewMode === 'chapters' ? 'Swipe between your story chapters' : 'Your custom boards'}
        </Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, viewMode === 'chapters' && styles.tabActive]}
          onPress={() => setViewMode('chapters')}
        >
          <Text style={[styles.tabText, viewMode === 'chapters' && styles.tabTextActive]}>Chapters</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, viewMode === 'boards' && styles.tabActive]}
          onPress={() => setViewMode('boards')}
        >
          <Text style={[styles.tabText, viewMode === 'boards' && styles.tabTextActive]}>My Boards</Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'chapters' ? (
        loading ? (
          <ActivityIndicator style={styles.loader} color={colors.terra} size="large" />
        ) : (
          <StickerBoard
            chapters={chapters}
            onSelectSticker={setSelectedSticker}
            displayStyle={profile?.wall_display_style}
            borderStyle={profile?.cutout_border_style}
          />
        )
      ) : (
        <BoardsList
          boards={boards}
          loading={boardsLoading}
          onCreateBoard={createBoard}
          onDeleteBoard={deleteBoard}
          onOpenBoard={(board: Board) => router.push(`/board/${board.id}`)}
        />
      )}

      <StickerDetailView
        sticker={selectedSticker}
        onClose={() => setSelectedSticker(null)}
        onDelete={() => { setSelectedSticker(null); fetchStickers(); }}
        onUpdate={patchSticker}
      />
    </SafeAreaView>
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
  title: { fontSize: 15, fontFamily: fonts.cozy, color: colors.inkDark },
  subtitle: { fontSize: 10, color: colors.inkFaint, fontWeight: '600', marginTop: 1 },
  loader: { flex: 1 },
  tabs: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.cardAlt,
    borderRadius: radii.full,
    padding: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radii.full,
  },
  tabActive: { backgroundColor: colors.card, ...shadows.card },
  tabText: { fontSize: 12, fontWeight: '700', color: colors.inkFaint },
  tabTextActive: { color: colors.inkDark },
});
