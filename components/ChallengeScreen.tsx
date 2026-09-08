import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, Image, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';
import { BookOpen, MessageCircle, X, Flag } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { ChallengeWithSender } from '@/lib/types';
import { useChallenges } from '@/hooks/useChallenges';
import { useFriends } from '@/hooks/useFriends';
import { useAuth } from '@/hooks/useAuth';
import ReportSheet from '@/components/ReportSheet';
import { colors, spacing, fonts, wordFontFor, sentenceFontFor } from '@/constants/theme';
import { languageLabel } from '@/lib/languages';


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
  const [imageFailed, setImageFailed] = useState(false);
  // Read inside an async continuation, where `challenge` would be whatever it
  // was when that call started.
  const challengeIdRef = useRef(challenge?.id);
  challengeIdRef.current = challenge?.id;
  const [reportOpen, setReportOpen] = useState(false);
  const shakeX = useSharedValue(0);
  const { submitAnswer, requestHint, getChallengeImageUrl } = useChallenges();
  const { blockUser } = useFriends();
  const { user } = useAuth();

  // The sticker photo *is* the question — without it there is nothing to name.
  // A failed fetch used to leave exactly the blank grey box that a slow one
  // does, forever, with no way to ask again.
  //
  // The id is captured and re-checked on the way out: opening one challenge,
  // closing it and opening another is fast enough to overlap two fetches, and
  // the loser must not paint its picture onto the winner's question.
  const loadImage = useCallback(async () => {
    const id = challenge?.id;
    if (!id) return;
    setImageFailed(false);
    setImageUrl(null);
    const url = await getChallengeImageUrl(id).catch(() => null);
    if (challengeIdRef.current !== id) return;
    if (url) setImageUrl(url);
    else setImageFailed(true);
  }, [challenge?.id, getChallengeImageUrl]);

  useEffect(() => {
    if (!challenge) {
      setAnswer('');
      setAttemptsUsed(0);
      setHintUsed(false);
      setFirstLetter(null);
      setImageUrl(null);
      setImageFailed(false);
      return;
    }
    setAttemptsUsed(challenge.attempts_used);
    setHintUsed(challenge.hint_used);
    loadImage();
  }, [challenge?.id, loadImage]);

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
    } catch (err: any) {
      // The edge function says useful things ("this challenge has already been
      // answered", "you're out of attempts"); the hook now unwraps them.
      Alert.alert("Couldn't check that", err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleHint = async () => {
    if (!challenge || hintUsed || submitting) return;
    setSubmitting(true);
    try {
      const result = await requestHint(challenge.id);
      if (result.outcome === 'hint') {
        setFirstLetter(result.first_letter);
        setHintUsed(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (err: any) {
      Alert.alert("Couldn't get the hint", err?.message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Blocking from here closes the challenge as well: the picture that prompted
  // it is on screen, and leaving the user staring at it after they asked never
  // to hear from this person again would be absurd.
  const handleBlockFromChallenge = async () => {
    if (!challenge) return;
    const { error } = await blockUser(challenge.sender.id);
    if (error) { Alert.alert("Couldn't block", error.message); return; }
    onClose();
  };

  if (!challenge) return null;

  const blanked = blankWord(challenge.snapshot_sentence, challenge.snapshot_word);
  const senderName = challenge.sender.username ?? 'this person';

  return (
    <Modal visible={!!challenge} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close this challenge"
          >
            <X size={22} color={colors.inkDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Challenge</Text>
          <View style={styles.headerRight}>
            {attemptsUsed > 0 && (
              <Text style={styles.attemptsText}>{attemptsUsed} {attemptsUsed === 1 ? 'try' : 'tries'}</Text>
            )}
            {/* The picture on this screen came from another person's camera.
                This is the only place it is ever shown full-size, so it is the
                place a report has to be reachable from. */}
            <TouchableOpacity
              onPress={() => setReportOpen(true)}
              hitSlop={14}
              accessibilityRole="button"
              accessibilityLabel={`Report this challenge from ${senderName}`}
            >
              <Flag size={17} color={colors.inkLight} />
            </TouchableOpacity>
          </View>
        </View>

        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollBody} keyboardShouldPersistTaps="handled">
        {/* Sticker */}
        <View style={styles.stickerWrap}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.stickerImage} resizeMode="contain" />
          ) : imageFailed ? (
            <View style={styles.stickerPlaceholder}>
              <Text style={styles.imageErrorText}>Couldn&apos;t load the picture</Text>
              <TouchableOpacity
                style={styles.imageRetryBtn}
                onPress={loadImage}
                accessibilityRole="button"
                accessibilityLabel="Try loading the picture again"
              >
                <Text style={styles.imageRetryText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.stickerPlaceholder}>
              <ActivityIndicator color={colors.terra} />
            </View>
          )}
        </View>

        {/* Definition */}
        <View style={styles.definitionBox}>
          <BookOpen size={16} color={colors.inkLight} style={styles.definitionLabel} />
          <Text style={styles.definitionText}>{challenge.snapshot_translation}</Text>
        </View>

        {/* Blanked sentence */}
        <View style={styles.sentenceBox}>
          <MessageCircle size={16} color={colors.inkLight} style={styles.sentenceLabel} />
          <Text style={[styles.sentenceText, { fontFamily: sentenceFontFor(challenge.snapshot_language) }]}>{blanked}</Text>
        </View>

        {/* Hints from previous attempts */}
        {attemptsUsed >= 1 && (
          <Text style={styles.letterCountHint}>
            {challenge.snapshot_word.length} letters
          </Text>
        )}
        {firstLetter && (
          <Text style={styles.firstLetterHint}>
            Starts with: <Text style={[styles.firstLetterValue, { fontFamily: wordFontFor(challenge.snapshot_language) }]}>{firstLetter.toUpperCase()}</Text>
          </Text>
        )}

        {/* Input */}
        <Animated.View style={[styles.inputWrap, shakeStyle]}>
          <TextInput
            style={[styles.input, { fontFamily: wordFontFor(challenge.snapshot_language) }]}
            value={answer}
            onChangeText={setAnswer}
            placeholder={`Type in ${languageLabel(challenge.snapshot_language)}...`}
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

      <ReportSheet
        visible={reportOpen}
        reporterId={user?.id}
        reportedUserId={challenge.sender.id}
        reportedName={challenge.sender.username}
        challengeId={challenge.id}
        onBlock={handleBlockFromChallenge}
        onClose={() => setReportOpen(false)}
      />
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
  headerTitle: { fontSize: 16, fontFamily: fonts.display, color: colors.inkDark },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.ms },
  attemptsText: { fontSize: 12, fontFamily: fonts.display, color: colors.inkFaint },
  stickerWrap: { alignItems: 'center', paddingVertical: 16 },
  stickerImage: { width: 200, height: 200 },
  stickerPlaceholder: {
    width: 200, height: 200,
    backgroundColor: colors.borderLight,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  imageErrorText: { fontSize: 13, fontFamily: fonts.text, color: colors.inkMid, textAlign: 'center' },
  imageRetryBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.card,
  },
  imageRetryText: { fontSize: 13, fontFamily: fonts.display, color: colors.terra },
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
  definitionText: { flex: 1, fontSize: 14, fontFamily: fonts.text, color: colors.inkDark, lineHeight: 20 },
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
  // fontFamily comes from the render site — this is the target-language
  // sentence. No fontStyle either: no italic face is loaded, so iOS would
  // synthesise a slant, and a slanted Han character is simply wrong.
  sentenceText: { flex: 1, fontSize: 14, color: colors.inkMid, lineHeight: 20 },
  letterCountHint: { textAlign: 'center', fontSize: 13, fontFamily: fonts.text, color: colors.inkFaint, marginBottom: 6 },
  firstLetterHint: { textAlign: 'center', fontSize: 14, fontFamily: fonts.text, color: colors.inkMid, marginBottom: 8 },
  firstLetterValue: { color: colors.inkDark },
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
  submitText: { fontSize: 16, fontFamily: fonts.display, color: colors.white },
  hintButton: { alignItems: 'center', paddingVertical: 8 },
  hintText: { fontSize: 13, fontFamily: fonts.text, color: colors.inkFaint, textDecorationLine: 'underline' },
});
