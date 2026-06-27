import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, SafeAreaView, ScrollView, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Settings } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/lib/supabase';
import { Sticker, Category } from '@/lib/types';
import { buildChapters, Chapter } from '@/lib/chapters';
import StickerCard from '@/components/StickerCard';
import StickerDetailView from '@/components/StickerDetailView';
import SettingsView from '@/components/SettingsView';
import ChapterCard from '@/components/ChapterCard';
import ChapterDetailView from '@/components/ChapterDetailView';
import StickerBoard from '@/components/StickerBoard';

const CATEGORIES: Array<'All' | Category> = ['All', 'Kitchen', 'Animals', 'Study', 'Nature', 'Other'];

export default function CollectionScreen() {
  const { user, signOut } = useAuth();
  const { profile, setTargetLanguage } = useProfile(user?.id);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'All' | Category>('All');
  const [selectedSticker, setSelectedSticker] = useState<Sticker | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'story' | 'board' | 'challenges'>('grid');
  const [openChapter, setOpenChapter] = useState<Chapter | null>(null);

  const fetchStickers = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('stickers')
      .select('*')
      .eq('user_id', user.id)
      .order('discovered_at', { ascending: false });

    if (!error && data) setStickers(data as Sticker[]);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => {
    fetchStickers();
  }, [fetchStickers]);

  useFocusEffect(
    useCallback(() => {
      fetchStickers();
    }, [fetchStickers])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchStickers();
  };

  const filtered = viewMode === 'challenges'
    ? stickers.filter(s => s.source === 'challenge')
    : activeCategory === 'All'
      ? stickers
      : stickers.filter(s => s.category === activeCategory);

  const chapters = useMemo(() => buildChapters(stickers), [stickers]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>LingoStickers</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setSettingsOpen(true)} hitSlop={8}>
            <Settings size={20} color="#1A1A2E" />
          </TouchableOpacity>
          <TouchableOpacity onPress={signOut}>
            <Text style={styles.signOut}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.stats}>
        <Text style={styles.statsLabel}>My Collection</Text>
        <Text style={styles.statsCount}>
          {stickers.length} <Text style={styles.statsUnit}>stickers</Text>
        </Text>
      </View>

      <View style={styles.viewModeRow}>
        <TouchableOpacity
          style={[styles.viewModeChip, viewMode === 'grid' && styles.viewModeChipActive]}
          onPress={() => setViewMode('grid')}
        >
          <Text style={[styles.viewModeChipText, viewMode === 'grid' && styles.viewModeChipTextActive]}>Grid</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewModeChip, viewMode === 'story' && styles.viewModeChipActive]}
          onPress={() => setViewMode('story')}
        >
          <Text style={[styles.viewModeChipText, viewMode === 'story' && styles.viewModeChipTextActive]}>Story</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewModeChip, viewMode === 'board' && styles.viewModeChipActive]}
          onPress={() => setViewMode('board')}
        >
          <Text style={[styles.viewModeChipText, viewMode === 'board' && styles.viewModeChipTextActive]}>Board</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewModeChip, viewMode === 'challenges' && styles.viewModeChipActive]}
          onPress={() => setViewMode('challenges')}
        >
          <Text style={[styles.viewModeChipText, viewMode === 'challenges' && styles.viewModeChipTextActive]}>Challenges</Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'grid' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryContent}
        >
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryChip, activeCategory === cat && styles.categoryChipActive]}
              onPress={() => setActiveCategory(cat)}
            >
              <Text style={[styles.categoryChipText, activeCategory === cat && styles.categoryChipTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} color="#A7D7C5" size="large" />
      ) : viewMode === 'grid' || viewMode === 'challenges' ? (
        filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {viewMode === 'challenges' ? 'No challenge wins yet' : 'No stickers yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {viewMode === 'challenges'
                ? 'Stickers you win from friends’ challenges will show up here.'
                : 'Tap the Scan tab to discover your first word!'}
            </Text>
          </View>
        ) : (
          <FlatList
            key={viewMode}
            data={filtered}
            keyExtractor={s => s.id}
            numColumns={2}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.grid}
            renderItem={({ item }) => (
              <View style={styles.cardWrapper}>
                <StickerCard sticker={item} onPress={() => setSelectedSticker(item)} />
              </View>
            )}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#A7D7C5" />}
          />
        )
      ) : viewMode === 'story' ? (
        chapters.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No stickers yet</Text>
            <Text style={styles.emptySubtitle}>Tap the Scan tab to discover your first word!</Text>
          </View>
        ) : (
          <FlatList
            key="story"
            data={chapters}
            keyExtractor={c => c.key}
            contentContainerStyle={styles.chapterList}
            renderItem={({ item }) => (
              <ChapterCard chapter={item} onPress={() => setOpenChapter(item)} />
            )}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#A7D7C5" />}
          />
        )
      ) : (
        <StickerBoard chapters={chapters} onSelectSticker={setSelectedSticker} />
      )}

      <ChapterDetailView
        chapter={openChapter}
        onClose={() => setOpenChapter(null)}
        onSelectSticker={setSelectedSticker}
      />

      <StickerDetailView
        sticker={selectedSticker}
        onClose={() => setSelectedSticker(null)}
        onDelete={() => { setSelectedSticker(null); fetchStickers(); }}
      />

      <SettingsView
        visible={settingsOpen}
        profile={profile}
        onClose={() => setSettingsOpen(false)}
        onChangeLanguage={setTargetLanguage}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F0E8' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: { fontSize: 28, fontWeight: '800', color: '#1A1A2E' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  signOut: { fontSize: 13, color: '#9E9E9E', fontWeight: '600' },
  stats: { paddingHorizontal: 20, paddingVertical: 12 },
  statsLabel: { fontSize: 11, fontWeight: '700', color: '#9E9E9E', letterSpacing: 1.5, marginBottom: 4 },
  statsCount: { fontSize: 32, fontWeight: '800', color: '#1A1A2E' },
  statsUnit: { fontSize: 16, fontWeight: '400', color: '#9E9E9E' },
  viewModeRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 8 },
  viewModeChip: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  viewModeChipActive: { backgroundColor: '#A7D7C5', borderColor: '#A7D7C5' },
  viewModeChipText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  viewModeChipTextActive: { color: '#fff' },
  chapterList: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  categoryScroll: { flexGrow: 0, flexShrink: 0, marginBottom: 8 },
  categoryContent: { paddingHorizontal: 20, paddingVertical: 4, gap: 8, alignItems: 'center' },
  categoryChip: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  categoryChipActive: { backgroundColor: '#A7D7C5', borderColor: '#A7D7C5' },
  categoryChipText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  categoryChipTextActive: { color: '#fff' },
  grid: { paddingHorizontal: 16, paddingBottom: 32 },
  row: { gap: 12, marginBottom: 12 },
  cardWrapper: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A2E', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#9E9E9E', textAlign: 'center', lineHeight: 22 },
});
