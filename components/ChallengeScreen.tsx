import { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, Image, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';
import { BookOpen, MessageCircle, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { ChallengeWithSender, Language } from '@/lib/types';
import { useChallenges } from '@/hooks/useChallenges';
import { colors, radii, spacing, fonts } from '@/constants/theme';

const LANGUAGE_LABELS: Record<Language, string> = { fr: 'French', ja: 'Japanese', yue: 'Cantonese' };

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
            <X size={22} color={colors.inkDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Challenge</Text>
          {attemptsUsed > 0 && (
            <Text style={styles.attemptsText}>{attemptsUsed} {attemptsUsed === 1 ? 'try' : 'tries'}</Text>
          )}
        </View>

        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollBody} keyboardShouldPersistTaps="handled">
        {/* Sticker */}
        <View style={styles.stickerWrap}>
          {imageUrl
            ? <Image source={{ uri: imageUrl }} style={styles.stickerImage} resizeMode="contain" />
            : <View style={styles.stickerPlaceholder} />}
        </View>

        {/* Definition */}
        <View style={styles.definitionBox}>
          <BookOpen size={16} color={colors.inkLight} style={styles.definitionLabel} />
          <Text style={styles.definitionText}>{challenge.snapshot_translation}</Text>
        </View>

        {/* Blanked sentence */}
        <View style={styles.sentenceBox}>
          <MessageCircle size={16} color={colors.inkLight} style={styles.sentenceLabel} />
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
            placeholderTextColor={colors.inkFaint}
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
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.submitText}>Check Answer</Text>}
        </TouchableOpacity>

        {/* Hint */}
        {!hintUsed && (
          <TouchableOpacity style={styles.hintButton} onPress={handleHint} disabled={submitting}>
            <Text style={styles.hintText}>Show first letter</Text>
          </TouchableOpacity>
        )}
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sky },
  flex: { flex: 1 },
  scrollBody: { flexGrow: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.inkDark },
  attemptsText: { fontSize: 12, fontWeight: '600', color: colors.inkFaint },
  stickerWrap: { alignItems: 'center', paddingVertical: 16 },
  stickerImage: { width: 200, height: 200 },
  stickerPlaceholder: { width: 200, height: 200, backgroundColor: colors.borderLight, borderRadius: 20 },
  definitionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 8,
  },
  definitionLabel: { marginTop: 2 },
  definitionText: { flex: 1, fontSize: 14, color: colors.inkDark, lineHeight: 20 },
  sentenceBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 8,
  },
  sentenceLabel: { marginTop: 2 },
  sentenceText: { flex: 1, fontSize: 14, color: colors.inkMid, lineHeight: 20, fontStyle: 'italic' },
  letterCountHint: { textAlign: 'center', fontSize: 13, color: colors.inkFaint, marginBottom: 6 },
  firstLetterHint: { textAlign: 'center', fontSize: 14, color: colors.inkMid, marginBottom: 8 },
  firstLetterValue: { fontWeight: '800', color: colors.inkDark },
  inputWrap: { marginHorizontal: 20, marginBottom: 12 },
  input: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.terra,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.inkDark,
  },
  submitButton: {
    marginHorizontal: 20,
    backgroundColor: colors.terra,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { fontSize: 16, fontWeight: '700', color: colors.white },
  hintButton: { alignItems: 'center', paddingVertical: 8 },
  hintText: { fontSize: 13, color: colors.inkFaint, textDecorationLine: 'underline' },
});
