import { useEffect, useState } from 'react';
import { TouchableOpacity, Image, Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { Chapter } from '@/lib/chapters';
import { supabase } from '@/lib/supabase';

interface ChapterCardProps {
  chapter: Chapter;
  onPress: () => void;
}

export default function ChapterCard({ chapter, onPress }: ChapterCardProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const path = chapter.coverSticker.memory_photo_path ?? chapter.coverSticker.image_path;
    supabase.storage.from('sticker-images')
      .createSignedUrl(path, 3600)
      .then(({ data }) => { if (data) setImageUrl(data.signedUrl); });
  }, [chapter.coverSticker.id]);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <ActivityIndicator style={styles.image} color="#A7D7C5" />
        )}
        <View style={styles.caption}>
          <Text style={styles.title} numberOfLines={1}>{chapter.title}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{chapter.subtitle}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#A7D7C5',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 16 / 10,
  },
  image: { width: '100%', height: '100%' },
  caption: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  title: { color: '#fff', fontSize: 16, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontStyle: 'italic', marginTop: 2 },
});
