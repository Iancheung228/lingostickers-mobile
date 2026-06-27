import { useEffect, useState } from 'react';
import { Modal, View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { X } from 'lucide-react-native';
import { Sticker } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import StickerCard from '@/components/StickerCard';

interface StickerPickerModalProps {
  visible: boolean;
  currentUserId: string | undefined;
  onSelect: (sticker: Sticker) => void;
  onClose: () => void;
}

export default function StickerPickerModal({ visible, currentUserId, onSelect, onClose }: StickerPickerModalProps) {
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible || !currentUserId) return;
    setLoading(true);
    supabase
      .from('stickers')
      .select('*')
      .eq('user_id', currentUserId)
      .order('discovered_at', { ascending: false })
      .then(({ data }) => {
        setStickers((data ?? []) as Sticker[]);
        setLoading(false);
      });
  }, [visible, currentUserId]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Pick a Sticker</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <X size={22} color="#1A1A2E" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 48 }} color="#A7D7C5" size="large" />
        ) : stickers.length === 0 ? (
          <Text style={styles.empty}>Scan something first to send a challenge!</Text>
        ) : (
          <FlatList
            data={stickers}
            keyExtractor={s => s.id}
            numColumns={2}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.grid}
            renderItem={({ item }) => (
              <View style={styles.cardWrapper}>
                <StickerCard sticker={item} onPress={() => onSelect(item)} />
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F0E8' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: { fontSize: 20, fontWeight: '800', color: '#1A1A2E' },
  empty: { color: '#9E9E9E', textAlign: 'center', marginTop: 48, fontSize: 14, paddingHorizontal: 32 },
  grid: { paddingHorizontal: 16, paddingBottom: 32 },
  row: { gap: 12, marginBottom: 12 },
  cardWrapper: { flex: 1 },
});
