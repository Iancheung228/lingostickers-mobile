import { Modal, View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { X } from 'lucide-react-native';
import { Chapter } from '@/lib/chapters';
import { Sticker } from '@/lib/types';
import StickerCard from './StickerCard';

interface ChapterDetailViewProps {
  chapter: Chapter | null;
  onClose: () => void;
  onSelectSticker: (sticker: Sticker) => void;
}

export default function ChapterDetailView({ chapter, onClose, onSelectSticker }: ChapterDetailViewProps) {
  if (!chapter) return null;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#1A1A2E" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{chapter.title}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <FlatList
          data={chapter.stickers}
          keyExtractor={(s) => s.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              <StickerCard sticker={item} onPress={() => onSelectSticker(item)} />
            </View>
          )}
        />
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: { width: 40 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#1A1A2E', textAlign: 'center' },
  grid: { paddingHorizontal: 16, paddingBottom: 32, paddingTop: 4 },
  row: { gap: 12, marginBottom: 12 },
  cardWrapper: { flex: 1 },
});
