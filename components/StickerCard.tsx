import { useEffect, useState } from 'react';
import { TouchableOpacity, Image, Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { Sticker } from '@/lib/types';
import { supabase } from '@/lib/supabase';

interface StickerCardProps {
  sticker: Sticker;
  onPress: () => void;
}

export default function StickerCard({ sticker, onPress }: StickerCardProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    supabase.storage.from('sticker-images')
      .createSignedUrl(sticker.image_path, 3600)
      .then(({ data }) => { if (data) setImageUrl(data.signedUrl); });
  }, [sticker.image_path]);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
        ) : (
          <ActivityIndicator style={styles.image} color="#A7D7C5" />
        )}
      </View>
      <Text style={styles.name} numberOfLines={1}>{sticker.name}</Text>
      <Text style={styles.translation} numberOfLines={1}>{sticker.translation}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    flex: 1,
    shadowColor: '#A7D7C5',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    marginBottom: 8,
  },
  image: { width: '100%', height: '100%' },
  name: { fontSize: 14, fontWeight: '700', color: '#1A1A2E', marginBottom: 2 },
  translation: { fontSize: 11, color: '#6B7280', fontWeight: '500' },
});
