import { Modal, View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { X } from 'lucide-react-native';
import { Chapter } from '@/lib/chapters';
import { Sticker } from '@/lib/types';
import StickerCard from './StickerCard';
import { colors, shadows, radii, spacing, fonts } from '@/constants/theme';

interface ChapterDetailViewProps {
  chapter: Chapter | null;
  onClose: () => void;
  onSelectSticker: (sticker: Sticker) => void;
  onToggleFavorite?: (id: string) => void;
}

export default function ChapterDetailView({ chapter, onClose, onSelectSticker, onToggleFavorite }: ChapterDetailViewProps) {
  if (!chapter) return null;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={22} color={colors.inkDark} />
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
              <StickerCard sticker={item} onPress={() => onSelectSticker(item)} onToggleFavorite={onToggleFavorite} />
            </View>
          )}
        />
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    gap: spacing.sm,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  headerSpacer: { width: 38 },
  headerTitle: { flex: 1, fontSize: 16, fontFamily: fonts.cozy, color: colors.inkDark, textAlign: 'center' },
  grid: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl, paddingTop: spacing.xs },
  row: { gap: spacing.sm, marginBottom: spacing.sm },
  cardWrapper: { flex: 1 },
});
