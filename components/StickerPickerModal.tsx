import { useEffect, useState } from 'react';
import { Modal, View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { X } from 'lucide-react-native';
import { Sticker } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import StickerCard from '@/components/StickerCard';
import { colors, radii, spacing, fonts } from '@/constants/theme';

interface StickerPickerModalProps {
  visible: boolean;
  currentUserId: string | undefined;
  onSelect: (sticker: Sticker) => void;
  onClose: () => void;
  title?: string;
  selectedIds?: Set<string>;
}

export default function StickerPickerModal({
  visible, currentUserId, onSelect, onClose, title = 'Pick a Sticker', selectedIds,
}: StickerPickerModalProps) {
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
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <X size={22} color={colors.inkDark} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 48 }} color={colors.terra} size="large" />
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
                <StickerCard sticker={item} onPress={() => onSelect(item)} selected={selectedIds?.has(item.id)} />
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sky },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.inkDark },
  empty: { color: colors.inkFaint, textAlign: 'center', marginTop: 48, fontSize: 14, paddingHorizontal: 32 },
  grid: { paddingHorizontal: 16, paddingBottom: 32 },
  row: { gap: 12, marginBottom: 12 },
  cardWrapper: { flex: 1 },
});
