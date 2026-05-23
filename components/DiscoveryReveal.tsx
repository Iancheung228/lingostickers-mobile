import { useEffect, useState } from 'react';
import { Modal, View, Text, Image, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { X, Bookmark } from 'lucide-react-native';
import { StickerDraft } from '@/lib/types';
import { supabase } from '@/lib/supabase';

interface DiscoveryRevealProps {
  draft: StickerDraft | null;
  onAdd: () => void;
  onDiscard: () => void;
  saving: boolean;
}

export default function DiscoveryReveal({ draft, onAdd, onDiscard, saving }: DiscoveryRevealProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!draft?.imagePath) return;
    supabase.storage.from('sticker-images')
      .createSignedUrl(draft.imagePath, 3600)
      .then(({ data }) => { if (data) setImageUrl(data.signedUrl); });
  }, [draft?.imagePath]);

  if (!draft) return null;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>New Discovery</Text>
          <TouchableOpacity onPress={onDiscard} style={styles.closeButton} disabled={saving}>
            <X size={24} color="#1A1A2E" />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <Text style={styles.discoveredLabel}>NEW DISCOVERY FOUND</Text>

          <View style={styles.stickerFrame}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
            ) : (
              <ActivityIndicator style={styles.image} color="#A7D7C5" />
            )}
          </View>

          <Text style={styles.frenchWord}>{draft.name}</Text>
          <Text style={styles.pronunciation}>{draft.pronunciation}</Text>
          <Text style={styles.translation}>{draft.translation?.toUpperCase() ?? ''}</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.addButton} onPress={onAdd} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Bookmark size={20} color="#fff" />
                <Text style={styles.addButtonText}>Add to Collection</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.discardButton} onPress={onDiscard} disabled={saving}>
            <Text style={styles.discardButtonText}>Discard</Text>
          </TouchableOpacity>
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
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A2E' },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  discoveredLabel: {
    fontSize: 10,
    letterSpacing: 3,
    color: '#9E9E9E',
    fontWeight: '700',
    marginBottom: 24,
  },
  stickerFrame: {
    width: 240,
    height: 240,
    marginBottom: 28,
  },
  image: { width: '100%', height: '100%' },
  frenchWord: { fontSize: 40, fontWeight: '800', color: '#1A1A2E', textAlign: 'center', marginBottom: 6 },
  pronunciation: { fontSize: 18, color: '#6B7280', fontStyle: 'italic', marginBottom: 10, textAlign: 'center' },
  translation: { fontSize: 13, color: '#A7D7C5', fontWeight: '800', letterSpacing: 3, textAlign: 'center' },
  actions: { paddingHorizontal: 32, paddingBottom: 32, gap: 12 },
  addButton: {
    backgroundColor: '#A7D7C5',
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#A7D7C5',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  discardButton: { alignItems: 'center', paddingVertical: 12 },
  discardButtonText: { color: '#9E9E9E', fontSize: 14, fontWeight: '600' },
});
