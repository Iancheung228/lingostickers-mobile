import { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Image } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSequence, withTiming, withDelay, interpolate, Easing,
} from 'react-native-reanimated';
import { RotateCw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { ChallengeWithSender, Sticker } from '@/lib/types';
import { supabase } from '@/lib/supabase';

interface ChallengeSuccessProps {
  challenge: ChallengeWithSender | null;
  wonStickerId: string;
  onClose: () => void;
}

export default function ChallengeSuccess({ challenge, wonStickerId, onClose }: ChallengeSuccessProps) {
  const [sticker, setSticker] = useState<Sticker | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [memoryImageUrl, setMemoryImageUrl] = useState<string | null>(null);
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const flipProgress = useSharedValue(0);

  useEffect(() => {
    if (!challenge || !wonStickerId) {
      setSticker(null);
      setImageUrl(null);
      setMemoryImageUrl(null);
      return;
    }

    // The awarded sticker is a real row the receiver now owns (its image
    // and, if the sender had one, memory photo were copied into the
    // receiver's own storage folder by submit-challenge-answer) — fetch it
    // directly rather than the challenge snapshot, so this looks exactly
    // like a sticker the receiver scanned themselves.
    supabase.from('stickers').select('*').eq('id', wonStickerId).single().then(({ data }) => {
      if (!data) return;
      const won = data as Sticker;
      setSticker(won);

      supabase.storage.from('sticker-images').createSignedUrl(won.image_path, 3600)
        .then(({ data: signed }) => { if (signed) setImageUrl(signed.signedUrl); });

      if (won.memory_photo_path) {
        supabase.storage.from('sticker-images').createSignedUrl(won.memory_photo_path, 3600)
          .then(({ data: signed }) => { if (signed) setMemoryImageUrl(signed.signedUrl); });
      }
    });

    flipProgress.value = 0;
    opacity.value = withTiming(1, { duration: 300 });
    scale.value = withSequence(
      withTiming(0, { duration: 0 }),
      withDelay(100, withTiming(1.15, { duration: 350 })),
      withTiming(1, { duration: 200 })
    );

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [challenge?.id, wonStickerId]);

  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const frontFaceStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${interpolate(flipProgress.value, [0, 1], [0, 180])}deg` },
    ],
  }));

  const backFaceStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${interpolate(flipProgress.value, [0, 1], [180, 360])}deg` },
    ],
  }));

  const handleFlip = () => {
    if (!sticker?.memory_photo_path) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    flipProgress.value = withTiming(flipProgress.value === 0 ? 1 : 0, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    });
  };

  if (!challenge) return null;

  return (
    <Modal visible={!!challenge} animationType="fade" transparent>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheet}>
          <Text style={styles.emoji}>🎉</Text>
          <Text style={styles.title}>You got it!</Text>
          <Text style={styles.subtitle}>
            Added to your collection
          </Text>

          <Animated.View style={[styles.stickerWrap, popStyle]}>
            <TouchableOpacity
              style={styles.stickerFrame}
              onPress={handleFlip}
              activeOpacity={sticker?.memory_photo_path ? 0.85 : 1}
              disabled={!sticker?.memory_photo_path}
            >
              <Animated.View style={[styles.face, frontFaceStyle]}>
                {imageUrl
                  ? <Image source={{ uri: imageUrl }} style={styles.stickerImage} resizeMode="contain" />
                  : <View style={styles.stickerPlaceholder} />}
              </Animated.View>

              {sticker?.memory_photo_path && (
                <Animated.View style={[styles.face, styles.backFace, backFaceStyle]}>
                  {memoryImageUrl
                    ? <Image source={{ uri: memoryImageUrl }} style={styles.memoryImage} resizeMode="cover" />
                    : <View style={styles.stickerPlaceholder} />}
                </Animated.View>
              )}
            </TouchableOpacity>
          </Animated.View>

          {sticker?.memory_photo_path && (
            <View style={styles.flipHint}>
              <RotateCw size={12} color="#9CA3AF" />
              <Text style={styles.flipHintText}>Tap to see the moment</Text>
            </View>
          )}

          <Text style={styles.word}>{challenge.snapshot_word}</Text>
          <Text style={styles.reading}>{challenge.snapshot_reading}</Text>
          <Text style={styles.translation}>{challenge.snapshot_translation}</Text>

          <View style={styles.replyPrompt}>
            <Text style={styles.replyLabel}>💬 Use it in a sentence en français!</Text>
            <Text style={styles.replyHint}>{challenge.snapshot_sentence}</Text>
          </View>

          <TouchableOpacity style={styles.doneButton} onPress={onClose}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#F5F0E8',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    alignItems: 'center',
    paddingBottom: 40,
  },
  emoji: { fontSize: 40, marginBottom: 8 },
  title: { fontSize: 26, fontWeight: '800', color: '#1A1A2E', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#9E9E9E', marginBottom: 20 },
  stickerWrap: { marginBottom: 8 },
  stickerFrame: { width: 160, height: 160 },
  face: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backFace: { backgroundColor: '#1A1A2E' },
  stickerImage: { width: '100%', height: '100%' },
  memoryImage: { width: '100%', height: '100%' },
  stickerPlaceholder: { width: '100%', height: '100%', backgroundColor: '#E5E7EB', borderRadius: 20 },
  flipHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  flipHintText: { fontSize: 12, color: '#9CA3AF', fontWeight: '600' },
  word: { fontSize: 28, fontWeight: '800', color: '#1A1A2E', marginBottom: 2 },
  reading: { fontSize: 14, color: '#9E9E9E', marginBottom: 4 },
  translation: { fontSize: 16, color: '#6B7280', marginBottom: 20 },
  replyPrompt: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    width: '100%',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  replyLabel: { fontSize: 13, fontWeight: '700', color: '#1A1A2E', marginBottom: 6 },
  replyHint: { fontSize: 13, color: '#6B7280', fontStyle: 'italic', lineHeight: 18 },
  doneButton: {
    backgroundColor: '#A7D7C5',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 48,
    alignItems: 'center',
  },
  doneText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
