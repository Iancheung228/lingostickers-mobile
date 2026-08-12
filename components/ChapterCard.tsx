import { TouchableOpacity, Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Chapter } from '@/lib/chapters';
import { colors, fonts } from '@/constants/theme';

interface ChapterCardProps {
  chapter: Chapter;
  onPress: () => void;
  // Signed by the parent list in one batched request (hooks/useSignedUrls)
  // rather than each card minting its own — see skills.md wall-loading note.
  imageUrl: string | null;
}

export default function ChapterCard({ chapter, onPress, imageUrl }: ChapterCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image
            source={{
              uri: imageUrl,
              cacheKey: chapter.coverSticker.memory_photo_path ?? chapter.coverSticker.image_path,
            }}
            cachePolicy="memory-disk"
            style={styles.image}
            contentFit="cover"
          />
        ) : (
          <ActivityIndicator style={styles.image} color={colors.terra} />
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
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: colors.card,
    shadowColor: colors.terra,
    shadowOpacity: 0.3,
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
    backgroundColor: 'rgba(28,73,102,0.55)',
  },
  title: { color: colors.white, fontSize: 16, fontFamily: fonts.cozy },
  subtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontStyle: 'italic', marginTop: 2 },
});
