import { useEffect, useState } from 'react';
import { Modal, View, Text, Image, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
import { X, Trash2, Share2 } from 'lucide-react-native';
import { File, Directory, Paths } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { Sticker } from '@/lib/types';
import { supabase } from '@/lib/supabase';

// WeChat custom-sticker uploads look best as small square PNGs with a
// transparent background — see "Custom Stickers" in WeChat's gallery settings.
const WECHAT_STICKER_SIZE = 240;

interface StickerDetailViewProps {
  sticker: Sticker | null;
  onClose: () => void;
  onDelete: () => void;
}

export default function StickerDetailView({ sticker, onClose, onDelete }: StickerDetailViewProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

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

  // Downloads the sticker and resizes it to a chat-friendly square PNG,
  // returning a local file:// URI both export actions can reuse.
  const prepareExportFile = async (): Promise<string> => {
    if (!imageUrl) throw new Error('Image not loaded yet');
    const stickersDir = new Directory(Paths.cache, 'sticker-exports');
    if (!stickersDir.exists) stickersDir.create({ intermediates: true });

    const downloaded = await File.downloadFileAsync(imageUrl, stickersDir, { idempotent: true });
    // Only constrain one dimension so the other scales proportionally —
    // passing both width and height stretches/squishes the image.
    const resized = await manipulateAsync(
      downloaded.uri,
      [{ resize: { width: WECHAT_STICKER_SIZE } }],
      { format: SaveFormat.PNG, compress: 1 }
    );
    return resized.uri;
  };

  const handleSaveToPhotos = async () => {
    if (!sticker || exporting) return;
    setExporting(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Photo access needed', 'Allow photo library access to save the sticker.');
        return;
      }
      const fileUri = await prepareExportFile();
      await MediaLibrary.saveToLibraryAsync(fileUri);
      Alert.alert(
        'Saved to Photos',
        'To use it in WeChat: open WeChat → Me → Sticker Gallery → ⚙️ → Custom Stickers → ➕, then pick this image from your album.'
      );
    } catch (err: any) {
      Alert.alert('Couldn\'t save', err?.message ?? 'Something went wrong while saving the sticker.');
    } finally {
      setExporting(false);
    }
  };

  const handleShare = async () => {
    if (!sticker || exporting) return;
    setExporting(true);
    try {
      const fileUri = await prepareExportFile();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'image/png',
          dialogTitle: `Share "${sticker.name}" sticker`,
        });
      } else {
        Alert.alert('Sharing unavailable', 'Sharing isn\'t available on this device.');
      }
    } catch (err: any) {
      Alert.alert('Couldn\'t share', err?.message ?? 'Something went wrong while sharing the sticker.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPress = () => {
    if (!sticker || !imageUrl || exporting) return;
    Alert.alert(
      'Export sticker',
      'Save it to your photos so you can add it as a custom sticker in WeChat or iMessage, or share it directly to a chat.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save to Photos', onPress: handleSaveToPhotos },
        { text: 'Share to a chat…', onPress: handleShare },
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
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleExportPress} style={styles.exportButton} disabled={exporting || !imageUrl}>
              {exporting
                ? <ActivityIndicator size="small" color="#1A1A2E" />
                : <Share2 size={16} color="#1A1A2E" />}
              <Text style={styles.exportButtonText}>Export</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete} style={styles.deleteButton} disabled={deleting}>
              {deleting
                ? <ActivityIndicator size="small" color="#EF4444" />
                : <Trash2 size={20} color="#EF4444" />}
            </TouchableOpacity>
          </View>
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  exportButtonText: { fontSize: 14, fontWeight: '700', color: '#1A1A2E' },
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
