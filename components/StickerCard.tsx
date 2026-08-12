import { TouchableOpacity, Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Heart, MapPin, Volume2, Check, Play } from 'lucide-react-native';
import { Sticker } from '@/lib/types';
import { speak } from '@/lib/speech';
import { useTrimmedVoicePlayback } from '@/hooks/useTrimmedVoicePlayback';
import { colors, shadows, radii, spacing, fonts } from '@/constants/theme';

interface StickerCardProps {
  sticker: Sticker;
  onPress: () => void;
  onToggleFavorite?: (id: string) => void;
  selected?: boolean;
  // Signed by the parent list in one batched request (hooks/useSignedUrls)
  // rather than each card minting its own — see skills.md wall-loading note.
  imageUrl: string | null;
  voiceUrl: string | null;
}

export default function StickerCard({ sticker, onPress, onToggleFavorite, selected, imageUrl, voiceUrl }: StickerCardProps) {
  const { play: playVoice } = useTrimmedVoicePlayback(
    voiceUrl, sticker.voice_note_start_ms, sticker.voice_note_end_ms
  );

  return (
    <TouchableOpacity style={[styles.card, selected && styles.cardSelected]} onPress={onPress} activeOpacity={0.9}>
      <TouchableOpacity
        style={styles.speakBtn}
        onPress={(e) => { e.stopPropagation(); speak(sticker.word, sticker.language); }}
        hitSlop={6}
      >
        <Volume2 size={13} color={colors.inkFaint} />
      </TouchableOpacity>

      {/* Your own recorded pronunciation, if you've made one — same "You"
          amber tint used everywhere else this shows up (sticker detail). */}
      {sticker.voice_note_path && (
        <TouchableOpacity
          style={styles.voiceBtn}
          onPress={(e) => { e.stopPropagation(); playVoice(); }}
          hitSlop={6}
        >
          <Play size={11} color={colors.sageDark} fill={colors.sageDark} />
        </TouchableOpacity>
      )}

      {selected && (
        <View style={styles.selectedBadge}>
          <Check size={13} color={colors.white} />
        </View>
      )}

      {onToggleFavorite && (
        <TouchableOpacity
          style={styles.favoriteBtn}
          onPress={(e) => { e.stopPropagation(); onToggleFavorite(sticker.id); }}
          hitSlop={6}
        >
          <Heart
            size={15}
            color={sticker.is_favorite ? colors.error : colors.inkFaint}
            fill={sticker.is_favorite ? colors.error : 'transparent'}
          />
        </TouchableOpacity>
      )}

      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl, cacheKey: sticker.image_path }}
            cachePolicy="memory-disk"
            style={styles.image}
            contentFit="contain"
          />
        ) : (
          <ActivityIndicator style={styles.spinner} color={colors.terra} />
        )}
      </View>
      <View style={styles.label}>
        <View style={styles.wordRow}>
          <Text style={styles.word} numberOfLines={1}>{sticker.word}</Text>
          <Text style={styles.reading} numberOfLines={1}>[{sticker.reading}]</Text>
        </View>
        <Text style={styles.translation} numberOfLines={1}>{sticker.translation}</Text>
        {!!sticker.location_label && (
          <View style={styles.locationRow}>
            <MapPin size={10} color={colors.error} />
            <Text style={styles.locationText} numberOfLines={1}>{sticker.location_label}</Text>
          </View>
        )}
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
    ...shadows.card,
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: colors.terra,
  },
  selectedBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 2,
    width: 24,
    height: 24,
    borderRadius: radii.full,
    backgroundColor: colors.terra,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speakBtn: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    zIndex: 2,
    width: 24,
    height: 24,
    borderRadius: radii.full,
    backgroundColor: colors.sky,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceBtn: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm + 28,
    zIndex: 2,
    width: 24,
    height: 24,
    borderRadius: radii.full,
    backgroundColor: colors.sageLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 2,
    width: 24,
    height: 24,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  spinner: { flex: 1 },
  label: {
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs,
    gap: 2,
  },
  wordRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.xs },
  word: { fontSize: 14, fontFamily: fonts.jp, color: colors.inkDark, flexShrink: 1 },
  reading: { fontSize: 9, fontFamily: fonts.mono, color: colors.inkFaint },
  translation: { fontSize: 12, fontFamily: fonts.cozyMedium, color: colors.inkDark, textTransform: 'capitalize' },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  locationText: { fontSize: 9, fontWeight: '500', color: colors.inkFaint, flexShrink: 1 },
});
