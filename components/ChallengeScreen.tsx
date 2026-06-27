import { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, Image, ActivityIndicator, Alert,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { ChallengeWithSender, Language } from '@/lib/types';
import { useChallenges } from '@/hooks/useChallenges';

const LANGUAGE_LABELS: Record<Language, string> = { fr: 'French', ja: 'Japanese' };

interface ChallengeScreenProps {
  challenge: ChallengeWithSender | null;
  onClose: () => void;
  onWin: (wonStickerId: string) => void;
}

function blankWord(sentence: string, word: string): string {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return sentence.replace(new RegExp(escaped, 'gi'), '_'.repeat(word.length));
}

export default function ChallengeScreen({ challenge, onClose, onWin }: ChallengeScreenProps) {
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [hintUsed, setHintUsed] = useState(false);
  const [firstLetter, setFirstLetter] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const shakeX = useSharedValue(0);
  const { submitAnswer, useHint, getChallengeImageUrl } = useChallenges();

  useEffect(() => {
    if (!challenge) {
      setAnswer('');
      setAttemptsUsed(0);
      setHintUsed(false);
      setFirstLetter(null);
      setImageUrl(null);
      return;
    }
    setAttemptsUsed(challenge.attempts_used);
    setHintUsed(challenge.hint_used);

    getChallengeImageUrl(challenge.id).then(setImageUrl);
  }, [challenge?.id]);

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));

  const shake = () => {
    shakeX.value = withSequence(
      withTiming(-10, { duration: 60 }),
      withTiming(10, { duration: 60 }),
      withTiming(-8, { duration: 60 }),
      withTiming(8, { duration: 60 }),
      withTiming(0, { duration: 60 })
    );
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  };

  const handleSubmit = async () => {
    if (!challenge || !answer.trim() || submitting) return;
    setSubmitting(true);
    try {
      const result = await submitAnswer(challenge.id, answer.trim());
      if (result.outcome === 'correct') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onWin(result.won_sticker_id);
      } else if (result.outcome === 'wrong') {
        shake();
        setAttemptsUsed(result.attempts_used);
        setAnswer('');
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleHint = async () => {
    if (!challenge || hintUsed || submitting) return;
    setSubmitting(true);
    try {
      const result = await useHint(challenge.id);
      if (result.outcome === 'hint') {
        setFirstLetter(result.first_letter);
        setHintUsed(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {
      Alert.alert('Error', 'Could not load hint.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!challenge) return null;

  const blanked = blankWord(challenge.snapshot_sentence, challenge.snapshot_word);

  return (
    <Modal visible={!!challenge} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <X size={22} color="#1A1A2E" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Challenge</Text>
          {attemptsUsed > 0 && (
            <Text style={styles.attemptsText}>{attemptsUsed} {attemptsUsed === 1 ? 'try' : 'tries'}</Text>
          )}
        </View>

        {/* Sticker */}
        <View style={styles.stickerWrap}>
          {imageUrl
            ? <Image source={{ uri: imageUrl }} style={styles.stickerImage} resizeMode="contain" />
            : <View style={styles.stickerPlaceholder} />}
        </View>

        {/* Definition */}
        <View style={styles.definitionBox}>
          <Text style={styles.definitionLabel}>📖</Text>
          <Text style={styles.definitionText}>{challenge.snapshot_translation}</Text>
        </View>

        {/* Blanked sentence */}
        <View style={styles.sentenceBox}>
          <Text style={styles.sentenceLabel}>💬</Text>
          <Text style={styles.sentenceText}>{blanked}</Text>
        </View>

        {/* Hints from previous attempts */}
        {attemptsUsed >= 1 && (
          <Text style={styles.letterCountHint}>
            {challenge.snapshot_word.length} letters
          </Text>
        )}
        {firstLetter && (
          <Text style={styles.firstLetterHint}>
            Starts with: <Text style={styles.firstLetterValue}>{firstLetter.toUpperCase()}</Text>
          </Text>
        )}

        {/* Input */}
        <Animated.View style={[styles.inputWrap, shakeStyle]}>
          <TextInput
            style={styles.input}
            value={answer}
            onChangeText={setAnswer}
            placeholder={`Type in ${LANGUAGE_LABELS[challenge.snapshot_language]}...`}
            placeholderTextColor="#9E9E9E"
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={handleSubmit}
            returnKeyType="done"
            editable={!submitting}
          />
        </Animated.View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitButton, (!answer.trim() || submitting) && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={!answer.trim() || submitting}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitText}>Check Answer</Text>}
        </TouchableOpacity>

        {/* Hint */}
        {!hintUsed && (
          <TouchableOpacity style={styles.hintButton} onPress={handleHint} disabled={submitting}>
            <Text style={styles.hintText}>Show first letter</Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F0E8' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  attemptsText: { fontSize: 12, fontWeight: '600', color: '#9E9E9E' },
  stickerWrap: { alignItems: 'center', paddingVertical: 16 },
  stickerImage: { width: 200, height: 200 },
  stickerPlaceholder: { width: 200, height: 200, backgroundColor: '#E5E7EB', borderRadius: 20 },
  definitionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  definitionLabel: { fontSize: 16 },
  definitionText: { flex: 1, fontSize: 14, color: '#1A1A2E', lineHeight: 20 },
  sentenceBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  sentenceLabel: { fontSize: 16 },
  sentenceText: { flex: 1, fontSize: 14, color: '#6B7280', lineHeight: 20, fontStyle: 'italic' },
  letterCountHint: { textAlign: 'center', fontSize: 13, color: '#9E9E9E', marginBottom: 6 },
  firstLetterHint: { textAlign: 'center', fontSize: 14, color: '#6B7280', marginBottom: 8 },
  firstLetterValue: { fontWeight: '800', color: '#1A1A2E' },
  inputWrap: { marginHorizontal: 20, marginBottom: 12 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#A7D7C5',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1A1A2E',
  },
  submitButton: {
    marginHorizontal: 20,
    backgroundColor: '#A7D7C5',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  hintButton: { alignItems: 'center', paddingVertical: 8 },
  hintText: { fontSize: 13, color: '#9E9E9E', textDecorationLine: 'underline' },
});
