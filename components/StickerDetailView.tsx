import { useEffect, useState } from 'react';
import { Modal, View, Text, Image, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
import { X, Trash2 } from 'lucide-react-native';
import { Sticker } from '@/lib/types';
import { supabase } from '@/lib/supabase';

interface StickerDetailViewProps {
  sticker: Sticker | null;
  onClose: () => void;
  onDelete: () => void;
}

export default function StickerDetailView({ sticker, onClose, onDelete }: StickerDetailViewProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!sticker?.image_path) return;
    supabase.storage.from('sticker-images')
      .createSignedUrl(sticker.image_path, 3600)
      .then(({ data }) => { if (data) setImageUrl(data.signedUrl); });
  }, [sticker?.image_path]);

  const handleDelete = () => {
    Alert.alert(
      'Delete Sticker',
      `Remove "${sticker?.name}" from your collection?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            if (!sticker) return;
            setDeleting(true);
            await Promise.all([
              supabase.from('stickers').delete().eq('id', sticker.id),
              supabase.storage.from('sticker-images').remove([sticker.image_path]),
            ]);
            setDeleting(false);
            onDelete();
          },
        },
      ]
    );
  };

  if (!sticker) return null;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#1A1A2E" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Vocabulary</Text>
          <TouchableOpacity onPress={handleDelete} style={styles.deleteButton} disabled={deleting}>
            {deleting
              ? <ActivityIndicator size="small" color="#EF4444" />
              : <Trash2 size={20} color="#EF4444" />}
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <View style={styles.stickerFrame}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
            ) : (
              <ActivityIndicator style={styles.image} color="#A7D7C5" />
            )}
          </View>

          <Text style={styles.frenchWord}>{sticker.name}</Text>
          <Text style={styles.pronunciation}>{sticker.pronunciation}</Text>
          <Text style={styles.translation}>{sticker.translation?.toUpperCase() ?? ''}</Text>

          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{sticker.category} Collection</Text>
          </View>
        </View>
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
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A2E' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  stickerFrame: {
    width: 240,
    height: 240,
    marginBottom: 32,
  },
  image: { width: '100%', height: '100%' },
  frenchWord: { fontSize: 44, fontWeight: '800', color: '#1A1A2E', textAlign: 'center', marginBottom: 8 },
  pronunciation: { fontSize: 18, color: '#6B7280', fontStyle: 'italic', marginBottom: 12, textAlign: 'center' },
  translation: {
    fontSize: 14,
    color: '#A7D7C5',
    fontWeight: '800',
    letterSpacing: 3,
    marginBottom: 32,
    textAlign: 'center',
  },
  categoryBadge: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  categoryText: { fontSize: 11, fontWeight: '700', color: '#6B7280', letterSpacing: 1.5 },
});
