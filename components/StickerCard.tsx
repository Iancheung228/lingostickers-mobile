import { useEffect, useState } from 'react';
import { TouchableOpacity, Image, Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { Sticker } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { colors, shadows, radii, spacing } from '@/constants/theme';

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
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.82}>
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
        ) : (
          <ActivityIndicator style={styles.spinner} color={colors.terra} />
        )}
      </View>
      <View style={styles.label}>
        <Text style={styles.word} numberOfLines={1}>{sticker.word}</Text>
        <Text style={styles.translation} numberOfLines={1}>{sticker.translation}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.sm + 2,
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    ...shadows.cardWarm,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    marginBottom: spacing.sm,
    backgroundColor: colors.sky,
    borderRadius: radii.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  spinner: { flex: 1 },
  label: {
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs,
  },
  word: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.inkDark,
    marginBottom: 2,
  },
  translation: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.inkLight,
  },
});
