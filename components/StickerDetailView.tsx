import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, Image, TouchableOpacity, TextInput, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, interpolate, Easing } from 'react-native-reanimated';
import { X, Trash2, Share2, RotateCw, Volume2, Send, Heart, Tag, MapPin, MessageSquare, BookOpen, Mic, Play, Square } from 'lucide-react-native';
import { File, Directory, Paths } from 'expo-file-system';
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { Sticker } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { speak, stopSpeaking } from '@/lib/speech';
import { computeTrimOffsets, MeteringSample } from '@/lib/audioTrim';
import { useTrimmedVoicePlayback } from '@/hooks/useTrimmedVoicePlayback';
import SendChallengeModal from '@/components/SendChallengeModal';
import { useFriends } from '@/hooks/useFriends';
import { useChallenges } from '@/hooks/useChallenges';
import { colors, shadows, radii, spacing, fonts } from '@/constants/theme';

// WeChat custom-sticker uploads look best as small square PNGs with a
// transparent background — see "Custom Stickers" in WeChat's gallery settings.
const WECHAT_STICKER_SIZE = 240;

interface StickerDetailViewProps {
  sticker: Sticker | null;
  onClose: () => void;
  onDelete: () => void;
  onUpdate: (id: string, patch: Partial<Pick<Sticker,
    'is_favorite' | 'notes' | 'voice_note_path' | 'voice_note_start_ms' | 'voice_note_end_ms'
  >>) => void;
}

export default function StickerDetailView({ sticker, onClose, onDelete, onUpdate }: StickerDetailViewProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [memoryImageUrl, setMemoryImageUrl] = useState<string | null>(null);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const flipProgress = useSharedValue(0);
  const { friends } = useFriends();
  const { sendChallenge } = useChallenges();
  const acceptedFriends = friends.filter(f => f.status === 'accepted');
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  // Polled well under the default 500ms so the silence-trim below has
  // enough resolution to find where speech actually starts/ends.
  const recorderState = useAudioRecorderState(recorder, 100);
  const meteringSamplesRef = useRef<MeteringSample[]>([]);
  const { play: playVoice, pause: pauseVoice } = useTrimmedVoicePlayback(
    voiceUrl, sticker?.voice_note_start_ms, sticker?.voice_note_end_ms
  );

  useEffect(() => {
    if (!recorderState.isRecording) return;
    meteringSamplesRef.current.push({
      t: recorderState.durationMillis,
      db: recorderState.metering ?? -160,
    });
  }, [recorderState.isRecording, recorderState.durationMillis, recorderState.metering]);

  const refreshVoiceUrl = async (path: string) => {
    const { data } = await supabase.storage.from('sticker-images').createSignedUrl(path, 3600);
    if (data) setVoiceUrl(data.signedUrl);
  };

  useEffect(() => {
    if (!sticker?.image_path) return;
    supabase.storage.from('sticker-images')
      .createSignedUrl(sticker.image_path, 3600)
      .then(({ data }) => { if (data) setImageUrl(data.signedUrl); });
  }, [sticker?.image_path]);

  useEffect(() => {
    setVoiceUrl(null);
    if (sticker?.voice_note_path) refreshVoiceUrl(sticker.voice_note_path);
  }, [sticker?.voice_note_path]);

  // Fresh sticker opened — start showing the front face, and resolve the
  // memory photo (if any) so it's ready by the time the user flips.
  useEffect(() => {
    flipProgress.value = 0;
    setMemoryImageUrl(null);
    setEditingNotes(false);
    setNotesDraft(sticker?.notes ?? '');
    if (!sticker?.memory_photo_path) return;
    let cancelled = false;
    supabase.storage.from('sticker-images')
      .createSignedUrl(sticker.memory_photo_path, 3600)
      .then(({ data }) => { if (!cancelled && data) setMemoryImageUrl(data.signedUrl); });
    return () => { cancelled = true; };
  }, [sticker?.id]);

  // Stop any in-flight pronunciation/recording when the sticker changes or the modal closes.
  useEffect(() => {
    return () => {
      stopSpeaking();
      if (recorderState.isRecording) recorder.stop();
    };
  }, [sticker?.id]);

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

  const handleToggleFavorite = async () => {
    if (!sticker) return;
    const next = !sticker.is_favorite;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onUpdate(sticker.id, { is_favorite: next });
    const { error } = await supabase.from('stickers').update({ is_favorite: next }).eq('id', sticker.id);
    if (error) onUpdate(sticker.id, { is_favorite: !next });
  };

  const handleSaveNotes = async () => {
    if (!sticker) return;
    setSavingNotes(true);
    const { error } = await supabase.from('stickers').update({ notes: notesDraft }).eq('id', sticker.id);
    setSavingNotes(false);
    if (error) {
      Alert.alert("Couldn't save notes", error.message);
      return;
    }
    onUpdate(sticker.id, { notes: notesDraft });
    setEditingNotes(false);
  };

  const handlePlayVoice = () => {
    if (!voiceUrl) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    playVoice();
  };

  const MIN_RECORDING_MS = 300;

  // Hold the mic to record, let go to stop — re-holding (whether or not a
  // take already exists) re-records and overwrites the previous one at the
  // same storage path, so there's always at most one voice note per sticker.
  const handleStartRecording = async () => {
    if (!sticker || uploadingVoice || recorderState.isRecording) return;
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      Alert.alert('Microphone access needed', 'Allow microphone access to record your pronunciation.');
      return;
    }
    pauseVoice();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    meteringSamplesRef.current = [];
    // The recorder's native record() silently no-ops unless the audio
    // session has allowsRecording enabled — lib/speech.ts only ever turns
    // on playsInSilentMode for TTS, so this has to be set explicitly here.
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  };

  const handleStopRecording = async () => {
    if (!sticker || !recorderState.isRecording) return;
    const durationMs = recorderState.durationMillis;
    const samples = meteringSamplesRef.current;
    await recorder.stop();
    // Drop back to playback-only mode so speak()/voice-note playback
    // afterward doesn't stay routed through the recording session.
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });

    // Too short to be a deliberate recording — treat like an accidental tap.
    if (durationMs < MIN_RECORDING_MS) return;

    setUploadingVoice(true);
    try {
      if (!recorder.uri) throw new Error('Recording failed');
      const { startMs, endMs } = computeTrimOffsets(samples, durationMs);
      const path = `${sticker.user_id}/${sticker.id}-voice.m4a`;
      const bytes = await new File(recorder.uri).bytes();
      const { error } = await supabase.storage
        .from('sticker-images')
        .upload(path, bytes, { contentType: 'audio/m4a', upsert: true });
      if (error) throw error;
      await supabase.from('stickers').update({
        voice_note_path: path,
        voice_note_start_ms: startMs,
        voice_note_end_ms: endMs,
      }).eq('id', sticker.id);
      onUpdate(sticker.id, { voice_note_path: path, voice_note_start_ms: startMs, voice_note_end_ms: endMs });
      await refreshVoiceUrl(path);
    } catch (err: any) {
      Alert.alert("Couldn't save recording", err?.message ?? 'Something went wrong.');
    } finally {
      setUploadingVoice(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Sticker',
      `Remove "${sticker?.word}" from your collection?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            if (!sticker) return;
            setDeleting(true);
            const pathsToRemove = [sticker.image_path];
            if (sticker.memory_photo_path) pathsToRemove.push(sticker.memory_photo_path);
            if (sticker.voice_note_path) pathsToRemove.push(sticker.voice_note_path);
            await Promise.all([
              supabase.from('stickers').delete().eq('id', sticker.id),
              supabase.storage.from('sticker-images').remove(pathsToRemove),
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
          dialogTitle: `Share "${sticker.word}" sticker`,
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
            <X size={22} color={colors.inkDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sticker Inspector</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleToggleFavorite} style={styles.iconButton} hitSlop={4}>
              <Heart
                size={18}
                color={sticker.is_favorite ? colors.error : colors.inkFaint}
                fill={sticker.is_favorite ? colors.error : 'transparent'}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleExportPress} style={styles.iconButton} disabled={exporting || !imageUrl} hitSlop={4}>
              {exporting
                ? <ActivityIndicator size="small" color={colors.inkDark} />
                : <Share2 size={17} color={colors.inkDark} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete} style={styles.iconButton} disabled={deleting} hitSlop={4}>
              {deleting
                ? <ActivityIndicator size="small" color={colors.error} />
                : <Trash2 size={18} color={colors.error} />}
            </TouchableOpacity>
          </View>
        </View>

        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
          <TouchableOpacity
            style={styles.stickerFrame}
            onPress={handleFlip}
            activeOpacity={sticker.memory_photo_path ? 0.85 : 1}
            disabled={!sticker.memory_photo_path}
          >
            <Animated.View style={[styles.face, frontFaceStyle]}>
              {imageUrl ? (
                <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
              ) : (
                <ActivityIndicator style={styles.image} color={colors.terra} />
              )}
            </Animated.View>

            {sticker.memory_photo_path && (
              <Animated.View style={[styles.face, styles.backFace, backFaceStyle]}>
                {memoryImageUrl ? (
                  <Image source={{ uri: memoryImageUrl }} style={styles.memoryImage} resizeMode="cover" />
                ) : (
                  <ActivityIndicator style={styles.image} color={colors.terra} />
                )}
                <View style={styles.memoryLabel}>
                  <Text style={styles.memoryLabelText}>THE MOMENT</Text>
                </View>
              </Animated.View>
            )}
          </TouchableOpacity>

          {sticker.memory_photo_path && (
            <View style={styles.flipHint}>
              <RotateCw size={13} color={colors.inkFaint} />
              <Text style={styles.flipHintText}>Tap the sticker to flip</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={() => setChallengeOpen(true)}
            style={styles.challengeButton}
            disabled={!imageUrl}
          >
            <Send size={13} color={colors.inkDark} />
            <Text style={styles.challengeButtonText}>Challenge a Friend</Text>
          </TouchableOpacity>

          {/* Cozy panel — word, tags, contextual sentence, notes */}
          <View style={styles.panel}>
            <View style={styles.wordCard}>
              <View style={styles.wordRow}>
                <Text style={styles.word}>{sticker.word}</Text>
              </View>

              <View style={styles.pronunciationRow}>
                <TouchableOpacity
                  onPress={() => speak(sticker.word, sticker.language)}
                  style={[styles.pronButton, styles.pronButtonAi]}
                  hitSlop={6}
                >
                  <Volume2 size={16} color={colors.terraDark} />
                  <Text style={[styles.pronButtonLabel, styles.pronButtonLabelAi]}>AI</Text>
                </TouchableOpacity>

                {sticker.voice_note_path && !recorderState.isRecording && (
                  <TouchableOpacity
                    onPress={handlePlayVoice}
                    style={[styles.pronButton, styles.pronButtonMe]}
                    disabled={uploadingVoice}
                    hitSlop={6}
                  >
                    <Play size={14} color={colors.sageDark} fill={colors.sageDark} />
                    <Text style={[styles.pronButtonLabel, styles.pronButtonLabelMe]}>You</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPressIn={handleStartRecording}
                  onPressOut={handleStopRecording}
                  style={styles.micButton}
                  disabled={uploadingVoice}
                  hitSlop={6}
                >
                  {uploadingVoice ? (
                    <ActivityIndicator size="small" color={colors.terra} />
                  ) : recorderState.isRecording ? (
                    <Square size={16} color={colors.error} fill={colors.error} />
                  ) : (
                    <Mic size={18} color={sticker.voice_note_path ? colors.inkFaint : colors.terra} />
                  )}
                </TouchableOpacity>
              </View>
              {recorderState.isRecording ? (
                <Text style={styles.recordingHint}>Recording… let go to stop</Text>
              ) : (
                <Text style={styles.recordingHintIdle}>Hold the mic to record your pronunciation</Text>
              )}
              <Text style={styles.reading}>[{sticker.reading}]</Text>
              <Text style={styles.translation}>{sticker.translation}</Text>

              <View style={styles.tagsRow}>
                <View style={styles.tag}>
                  <Tag size={11} color={colors.inkDark} />
                  <Text style={styles.tagText}>{sticker.category}</Text>
                </View>
                {!!sticker.location_label && (
                  <View style={[styles.tag, styles.tagAlt]}>
                    <MapPin size={11} color={colors.error} />
                    <Text style={styles.tagText} numberOfLines={1}>{sticker.location_label}</Text>
                  </View>
                )}
              </View>
            </View>

            {!!sticker.sentence && (
              <View style={styles.infoCard}>
                <View style={styles.infoLabelRow}>
                  <MessageSquare size={13} color={colors.terra} />
                  <Text style={styles.infoLabel}>Contextual Sentence</Text>
                </View>
                <View style={styles.sentenceBox}>
                  <View style={styles.memorySentenceRow}>
                    <Text style={styles.sentenceText}>{sticker.sentence}</Text>
                    <TouchableOpacity
                      onPress={() => speak(sticker.sentence, sticker.language)}
                      hitSlop={10}
                    >
                      <Volume2 size={14} color={colors.inkFaint} />
                    </TouchableOpacity>
                  </View>
                  {!!sticker.sentence_translation && (
                    <Text style={styles.sentenceTranslation}>{sticker.sentence_translation}</Text>
                  )}
                </View>
              </View>
            )}

            <View style={styles.infoCard}>
              <View style={styles.infoLabelRow}>
                <BookOpen size={13} color={colors.sageDark} />
                <Text style={styles.infoLabel}>My Learning Notes</Text>
                <TouchableOpacity
                  onPress={() => editingNotes ? handleSaveNotes() : setEditingNotes(true)}
                  style={styles.notesEditBtn}
                  disabled={savingNotes}
                >
                  {savingNotes ? (
                    <ActivityIndicator size="small" color={colors.terra} />
                  ) : (
                    <Text style={styles.notesEditText}>{editingNotes ? 'Save' : 'Edit'}</Text>
                  )}
                </TouchableOpacity>
              </View>

              {editingNotes ? (
                <TextInput
                  value={notesDraft}
                  onChangeText={setNotesDraft}
                  placeholder="Add grammar notes, mnemonics, anything worth remembering..."
                  placeholderTextColor={colors.inkFaint}
                  multiline
                  style={styles.notesInput}
                />
              ) : (
                <View style={styles.notesBox}>
                  <Text style={styles.notesText}>
                    {sticker.notes || 'No notes yet — tap Edit to add some.'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      <SendChallengeModal
        sticker={challengeOpen ? sticker : null}
        friends={acceptedFriends}
        onSend={async (receiverId) => {
          const { error } = await sendChallenge(sticker.id, receiverId);
          if (error) Alert.alert('Challenge failed', error.message);
        }}
        onClose={() => setChallengeOpen(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sky },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  headerTitle: { fontSize: 11, fontFamily: fonts.mono, color: colors.inkFaint, letterSpacing: 1.5, textTransform: 'uppercase' },

  scrollBody: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  stickerFrame: {
    width: 220,
    height: 220,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  image: { width: '100%', height: '100%' },
  face: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backFace: {
    backgroundColor: colors.inkDark,
  },
  memoryImage: { width: '100%', height: '100%' },
  memoryLabel: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radii.md,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  memoryLabelText: { color: colors.white, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  flipHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.md,
  },
  flipHintText: { fontSize: 12, color: colors.inkFaint, fontWeight: '600' },

  challengeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'stretch',
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.skyNight,
    marginBottom: spacing.lg,
  },
  challengeButtonText: { fontSize: 13, fontFamily: fonts.cozyMedium, color: colors.inkDark },

  panel: {
    alignSelf: 'stretch',
    backgroundColor: colors.skyDeep,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.skyNight,
    padding: spacing.md,
    gap: spacing.md,
  },
  wordCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadows.card,
  },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  word: { fontSize: 34, fontFamily: fonts.jp, color: colors.inkDark, textAlign: 'center' },
  pronunciationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  pronButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  pronButtonAi: { backgroundColor: colors.terraLight },
  pronButtonMe: { backgroundColor: colors.sageLight },
  pronButtonLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  pronButtonLabelAi: { color: colors.terraDark },
  pronButtonLabelMe: { color: colors.sageDark },
  micButton: { padding: 6 },
  reading: { fontSize: 13, fontFamily: fonts.mono, color: colors.inkFaint, marginTop: 4, textAlign: 'center' },
  recordingHint: { fontSize: 11, fontWeight: '600', color: colors.error, marginTop: 6, textAlign: 'center' },
  recordingHintIdle: { fontSize: 10, fontWeight: '500', color: colors.inkFaint, marginTop: 6, textAlign: 'center' },
  translation: {
    fontSize: 16,
    fontFamily: fonts.cozy,
    color: colors.inkDark,
    textTransform: 'capitalize',
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.sm + 4,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.cardAlt,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  tagAlt: { backgroundColor: colors.sky },
  tagText: { fontSize: 10, fontWeight: '700', color: colors.inkMid },

  infoCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.card,
  },
  infoLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoLabel: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sentenceBox: {
    backgroundColor: colors.cardAlt,
    borderRadius: radii.md,
    padding: spacing.sm + 4,
    gap: 6,
  },
  memorySentenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sentenceText: { fontSize: 14, fontFamily: fonts.jp, color: colors.inkDark, flexShrink: 1, lineHeight: 20 },
  sentenceTranslation: { fontSize: 12, color: colors.inkLight, fontStyle: 'italic' },

  notesEditBtn: { paddingHorizontal: spacing.xs },
  notesEditText: { fontSize: 12, fontWeight: '700', color: colors.terraDark },
  notesBox: {
    backgroundColor: colors.sageLight,
    borderRadius: radii.md,
    padding: spacing.sm + 4,
  },
  notesText: { fontSize: 12, fontFamily: fonts.mono, color: colors.inkMid, lineHeight: 18 },
  notesInput: {
    backgroundColor: colors.sky,
    borderRadius: radii.md,
    padding: spacing.sm + 4,
    fontSize: 12,
    fontFamily: fonts.mono,
    color: colors.inkMid,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
});
