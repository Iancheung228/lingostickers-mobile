import { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Sticker as StickerIcon } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useBoards } from '@/hooks/useBoards';
import { supabase } from '@/lib/supabase';
import { Sticker } from '@/lib/types';
import { buildMonthlyChapters } from '@/lib/chapters';
import StickerBoard from '@/components/StickerBoard';
import StickerDetailView from '@/components/StickerDetailView';
import { colors, shadows, radii, spacing, fonts } from '@/constants/theme';
import { TAB_BAR_CLEARANCE } from '@/constants/tabBar';

export default function WallScreen() {
  const { user } = useAuth();
  const { profile, refetch: refetchProfile } = useProfile(user?.id);
  const { boards } = useBoards(user?.id);
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

  const chapters = useMemo(() => buildMonthlyChapters(stickers), [stickers]);

  // boards is fetched newest-created-first, so [0] is the most recent board —
  // jumping straight to its canvas instead of an intermediate list is the
  // point of this tab; "Boards" screen (for switching/creating) is still one
  // tap away via the button on that canvas screen.
  const openBoards = () => {
    if (boards.length > 0) {
      router.push(`/board/${boards[0].id}`);
    } else {
      router.push('/boards');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <StickerIcon size={13} color={colors.inkDark} />
          <Text style={styles.title}>Cozy Sticker Wall</Text>
        </View>
        <Text style={styles.subtitle}>Swipe through your months</Text>
      </View>

      <View style={styles.tabs}>
        <View style={[styles.tab, styles.tabActive]}>
          <Text style={[styles.tabText, styles.tabTextActive]}>Months</Text>
        </View>
        <TouchableOpacity style={styles.tab} onPress={openBoards}>
          <Text style={styles.tabText}>My Boards</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.terra} size="large" />
      ) : (
        <StickerBoard
          chapters={chapters}
          onSelectSticker={setSelectedSticker}
          displayStyle={profile?.wall_display_style}
          borderStyle={profile?.cutout_border_style}
          backgroundPath={profile?.wall_background_path}
          backgroundDim={profile?.wall_background_dim}
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
  container: { flex: 1, backgroundColor: colors.sky, paddingBottom: TAB_BAR_CLEARANCE },
  header: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
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
