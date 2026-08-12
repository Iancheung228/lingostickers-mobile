import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, AccessibilityInfo, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Trash2, Share2, Volume2, Send, Heart, Tag, MapPin, MessageSquare, BookOpen, Mic, Play, Square, Lightbulb } from 'lucide-react-native';
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
import { getSurfaceTint, getPanelTint, getPanelBorderTint, getAccentSurfaceTint, getAccentTint } from '@/lib/color';
import SendChallengeModal from '@/components/SendChallengeModal';
import { useFriends } from '@/hooks/useFriends';
import { useChallenges } from '@/hooks/useChallenges';
import { colors, shadows, radii, spacing, fonts } from '@/constants/theme';

// WeChat custom-sticker uploads look best as small square PNGs with a
// transparent background — see "Custom Stickers" in WeChat's gallery settings.
const WECHAT_STICKER_SIZE = 240;

// Header row's own content height (excludes the safe-area top inset, which
// varies per device and gets added separately).
const HEADER_BAR_HEIGHT = 38 + spacing.ms * 2;
const CUTOUT_SIZE = 190;
// How much of the cutout sits up over the photo vs. down onto the panel
// below — a postcard-sticker-peeling-off-the-edge effect.
const CUTOUT_OVERLAP = 68;

const CAPTION_DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// Reanimated's own Animated.Image only wraps core RN primitives, not
// expo-image — this lets the parallax hero (heroAnimatedStyle below) animate
// an expo-image so the memory photo still benefits from disk caching.
const AnimatedImage = Animated.createAnimatedComponent(Image);

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
  const [reducedMotion, setReducedMotion] = useState(false);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const heroHeight = Math.round(windowHeight * 0.42);
  const scrollY = useSharedValue(0);
  const dismissTranslateY = useSharedValue(0);
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

  const hasHero = !!sticker?.memory_photo_path;

  // Every surface on this screen derived from the sticker's memory photo —
  // same hue as the photo for structural/passive surfaces (recedes,
  // harmonizes), complementary hue for interactive/CTA elements (pops).
  // Falls back to the app's exact fixed palette when there's no photo, so
  // a sticker with no memory photo renders pixel-identical to before.
  const photoColor = sticker?.memory_photo_color;
  const pageTint = getSurfaceTint(photoColor, colors.sky);
  const cardTint = getSurfaceTint(photoColor, colors.card);
  const tagTint = getSurfaceTint(photoColor, colors.cardAlt);
  const tagAltTint = getSurfaceTint(photoColor, colors.sky);
  const panelTint = getPanelTint(photoColor, colors.skyDeep);
  const panelBorderTint = getPanelBorderTint(photoColor, colors.skyNight);
  const ctaSurfaceTint = getAccentSurfaceTint(photoColor, colors.cardAlt);
  // Border and icon share the same computed accent hue when a photo is
  // present (getAccentTint's fallback param is only read when there's no
  // photo) — kept as two calls purely so each falls back to its own
  // original fixed color when there's nothing to derive from.
  const ctaBorderTint = getAccentTint(photoColor, colors.skyNight, colors.cardAlt);
  const ctaIconTint = getAccentTint(photoColor, colors.inkDark, colors.cardAlt);
  const aiSurfaceTint = getAccentSurfaceTint(photoColor, colors.terraLight);
  const aiAccentTint = getAccentTint(photoColor, colors.terraDark, colors.terraLight);
  const micIdleTint = getAccentTint(photoColor, colors.terra, colors.sky);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => { if (mounted) setReducedMotion(enabled); });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => { mounted = false; sub.remove(); };
  }, []);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  // Photo grows/lags behind the scroll when pulled down past the top
  // (rubber-band stretch) and lags slightly on the way up (parallax) — the
  // same recipe as the App Store / Apple Music hero header. Skipped
  // entirely under Reduce Motion.
  const heroAnimatedStyle = useAnimatedStyle(() => {
    if (reducedMotion) return {};
    const translateY = interpolate(
      scrollY.value, [-heroHeight, 0, heroHeight], [-heroHeight * 0.3, 0, heroHeight * 0.4], Extrapolation.CLAMP
    );
    const scale = interpolate(scrollY.value, [-heroHeight, 0], [1.5, 1], Extrapolation.CLAMP);
    return { transform: [{ translateY }, { scale }] };
  });

  // Header chrome starts fully transparent over the photo and fades to a
  // solid backing as the hero scrolls out of view — Apple Music's
  // now-playing title-reveal pattern. No hero photo → always solid.
  const headerProgressStyle = useAnimatedStyle(() => {
    if (!hasHero) return { opacity: 1 };
    const threshold = Math.max(heroHeight - HEADER_BAR_HEIGHT - insets.top, 1);
    return { opacity: interpolate(scrollY.value, [0, threshold], [0, 1], Extrapolation.CLAMP) };
  });

  // Drag-the-header-down-to-dismiss — lives on the fixed header bar (a
  // sibling of the ScrollView, not inside it) so it never has to arbitrate
  // gesture priority with the scroll/hero-parallax pan underneath. Past the
  // threshold (distance or a fast flick), it hands off to the same onClose
  // the X button uses — the Modal's own dismiss animation takes it from
  // wherever the finger let go, same as the native iOS pageSheet gesture.
  const DISMISS_DISTANCE_THRESHOLD = 110;
  const DISMISS_VELOCITY_THRESHOLD = 800;
  const dismissPan = Gesture.Pan()
    .hitSlop({ top: 12, bottom: 12, left: 60, right: 60 })
    .onUpdate((e) => {
      dismissTranslateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_DISTANCE_THRESHOLD || e.velocityY > DISMISS_VELOCITY_THRESHOLD) {
        runOnJS(onClose)();
      } else {
        dismissTranslateY.value = withSpring(0, { damping: 18 });
      }
    });
  const dismissAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dismissTranslateY.value }],
  }));

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

  // Fresh sticker opened — resolve the memory photo (if any) for the hero,
  // and reset scroll-dependent/edit state.
  useEffect(() => {
    scrollY.value = 0;
    dismissTranslateY.value = 0;
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

  const captionText = sticker.location_label
    ? `${sticker.location_label} · ${CAPTION_DATE.format(new Date(sticker.discovered_at))}`
    : CAPTION_DATE.format(new Date(sticker.discovered_at));

  return (
    // "pageSheet" (iOS-only — this app is currently iOS-first, see skills.md
    // #4) shows this as a card over the home screen instead of a fully
    // opaque full-screen page. onDismiss fires if iOS's own native
    // swipe-down gesture completes, so it stays in sync with tapping the X
    // button — but that native gesture is iOS-only and undiscoverable (no
    // visual affordance), so the header's grabber handle below adds an
    // explicit, cross-platform drag-to-dismiss on top of it.
    <Modal visible animationType="slide" presentationStyle="pageSheet" onDismiss={onClose}>
      <Animated.View style={[styles.container, { backgroundColor: pageTint }, dismissAnimatedStyle]}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Animated.ScrollView
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            contentContainerStyle={[
              styles.scrollBody,
              {
                // Hero photos intentionally run edge-to-edge behind the
                // transparent header. Without one, there's no content to
                // show through it, so reserve the header's own height —
                // otherwise it paints over (crops) the top of the cutout.
                paddingTop: hasHero ? 0 : HEADER_BAR_HEIGHT + insets.top,
                paddingBottom: spacing.xxl + insets.bottom,
              },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {hasHero ? (
              <>
                <View style={[styles.heroBox, { height: heroHeight }]}>
                  {memoryImageUrl ? (
                    <AnimatedImage
                      source={{ uri: memoryImageUrl, cacheKey: sticker.memory_photo_path ?? undefined }}
                      cachePolicy="memory-disk"
                      style={[styles.heroImage, heroAnimatedStyle]}
                      contentFit="cover"
                    />
                  ) : (
                    <ActivityIndicator style={styles.heroImage} color={colors.card} />
                  )}
                  <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
                    <Defs>
                      <LinearGradient id="heroFade" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={pageTint} stopOpacity={0} />
                        <Stop offset="0.6" stopColor={pageTint} stopOpacity={0} />
                        <Stop offset="1" stopColor={pageTint} stopOpacity={1} />
                      </LinearGradient>
                    </Defs>
                    <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroFade)" />
                  </Svg>
                  <View style={styles.captionPill}>
                    <MapPin size={12} color={colors.white} />
                    <Text style={styles.captionText} numberOfLines={1}>{captionText}</Text>
                  </View>
                </View>

                <View style={styles.heroCutoutWrap}>
                  {imageUrl ? (
                    <Image
                      source={{ uri: imageUrl, cacheKey: sticker.image_path }}
                      cachePolicy="memory-disk"
                      style={styles.heroCutoutImage}
                      contentFit="contain"
                    />
                  ) : (
                    <ActivityIndicator color={colors.terra} />
                  )}
                </View>
              </>
            ) : (
              <View style={styles.classicFrame}>
                {imageUrl ? (
                  <Image
                    source={{ uri: imageUrl, cacheKey: sticker.image_path }}
                    cachePolicy="memory-disk"
                    style={styles.image}
                    contentFit="contain"
                  />
                ) : (
                  <ActivityIndicator style={styles.image} color={colors.terra} />
                )}
              </View>
            )}

            <TouchableOpacity
              onPress={() => setChallengeOpen(true)}
              style={[styles.challengeButton, { backgroundColor: ctaSurfaceTint, borderColor: ctaBorderTint }]}
              disabled={!imageUrl}
            >
              <Send size={13} color={ctaIconTint} />
              <Text style={styles.challengeButtonText}>Challenge a Friend</Text>
            </TouchableOpacity>

            {/* Cozy panel — word, tags, contextual sentence, notes */}
            <View style={[styles.panel, { backgroundColor: panelTint, borderColor: panelBorderTint }]}>
              <View style={[styles.wordCard, { backgroundColor: cardTint }]}>
                <View style={styles.wordRow}>
                  <Text style={styles.word}>{sticker.word}</Text>
                </View>

                <View style={styles.pronunciationRow}>
                  <TouchableOpacity
                    onPress={() => speak(sticker.word, sticker.language)}
                    style={[styles.pronButton, { backgroundColor: aiSurfaceTint }]}
                    hitSlop={6}
                  >
                    <Volume2 size={16} color={aiAccentTint} />
                    <Text style={[styles.pronButtonLabel, { color: aiAccentTint }]}>AI</Text>
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
                      <Mic size={18} color={sticker.voice_note_path ? colors.inkFaint : micIdleTint} />
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
                  <View style={[styles.tag, { backgroundColor: tagTint }]}>
                    <Tag size={11} color={colors.inkDark} />
                    <Text style={styles.tagText}>{sticker.category}</Text>
                  </View>
                  {!!sticker.location_label && (
                    <View style={[styles.tag, { backgroundColor: tagAltTint }]}>
                      <MapPin size={11} color={colors.error} />
                      <Text style={styles.tagText} numberOfLines={1}>{sticker.location_label}</Text>
                    </View>
                  )}
                </View>
              </View>

              {!!sticker.sentence && (
                <View style={[styles.infoCard, { backgroundColor: cardTint }]}>
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
                  {!!sticker.sentence_insight && (
                    <View style={styles.insightRow}>
                      <Lightbulb size={12} color={colors.sageDark} />
                      <Text style={styles.insightText}>{sticker.sentence_insight}</Text>
                    </View>
                  )}
                </View>
              )}

              <View style={[styles.infoCard, { backgroundColor: cardTint }]}>
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
          </Animated.ScrollView>
        </KeyboardAvoidingView>

        <View style={[styles.headerWrap, { height: HEADER_BAR_HEIGHT + insets.top }]} pointerEvents="box-none">
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: pageTint }, headerProgressStyle]} />
          <GestureDetector gesture={dismissPan}>
            <View style={styles.grabberZone}>
              <View style={styles.grabberPill}>
                <View style={styles.grabber} />
              </View>
            </View>
          </GestureDetector>
          <View style={[styles.header, { paddingTop: insets.top }]}>
            <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: cardTint }]}>
              <X size={22} color={colors.inkDark} />
            </TouchableOpacity>
            <Animated.Text style={[styles.headerTitle, headerProgressStyle]}>Sticker Inspector</Animated.Text>
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={handleToggleFavorite} style={[styles.iconButton, { backgroundColor: cardTint }]} hitSlop={4}>
                <Heart
                  size={18}
                  color={sticker.is_favorite ? colors.error : colors.inkFaint}
                  fill={sticker.is_favorite ? colors.error : 'transparent'}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleExportPress} style={[styles.iconButton, { backgroundColor: cardTint }]} disabled={exporting || !imageUrl} hitSlop={4}>
                {exporting
                  ? <ActivityIndicator size="small" color={colors.inkDark} />
                  : <Share2 size={17} color={colors.inkDark} />}
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete} style={[styles.iconButton, { backgroundColor: cardTint }]} disabled={deleting} hitSlop={4}>
                {deleting
                  ? <ActivityIndicator size="small" color={colors.error} />
                  : <Trash2 size={18} color={colors.error} />}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Animated.View>
      <SendChallengeModal
        sticker={challengeOpen ? sticker : null}
        friends={acceptedFriends}
        onSend={async (receiverId) => {
          const { error } = await sendChallenge(sticker.id, receiverId);
          if (error) {
            Alert.alert('Challenge failed', error.message);
            return false;
          }
          return true;
        }}
        onClose={() => setChallengeOpen(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sky },
  flex: { flex: 1 },

  headerWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.ms,
  },
  grabberZone: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingVertical: 8,
    zIndex: 1,
  },
  // A translucent dark scrim behind the bar — same trick as captionPill
  // below — so it stays visible whether it's sitting over a bright photo,
  // a dark one, or the plain cream page background (no hero photo).
  grabberPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.95)',
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

  scrollBody: { alignItems: 'center' },

  // Hero — full-bleed memory photo behind the sticker cutout.
  heroBox: {
    alignSelf: 'stretch',
    overflow: 'hidden',
    backgroundColor: colors.skyNight,
  },
  heroImage: { width: '100%', height: '100%' },
  captionPill: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '70%',
    paddingVertical: 6,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radii.full,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  captionText: { color: colors.white, fontSize: 11, fontWeight: '700', flexShrink: 1 },
  heroCutoutWrap: {
    width: CUTOUT_SIZE,
    height: CUTOUT_SIZE,
    marginTop: -CUTOUT_OVERLAP,
    marginBottom: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-4deg' }],
    shadowColor: colors.inkDark,
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  heroCutoutImage: { width: '100%', height: '100%' },

  // Fallback frame — used when a sticker has no memory photo.
  classicFrame: {
    width: 220,
    height: 220,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  image: { width: '100%', height: '100%' },

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
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  challengeButtonText: { fontSize: 13, fontFamily: fonts.cozyMedium, color: colors.inkDark },

  panel: {
    alignSelf: 'stretch',
    marginHorizontal: spacing.lg,
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
  pronButtonMe: { backgroundColor: colors.sageLight },
  pronButtonLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
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
    paddingTop: spacing.ms,
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
    padding: spacing.ms,
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
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  insightText: { flex: 1, fontSize: 11, color: colors.sageDark, lineHeight: 15 },

  notesEditBtn: { paddingHorizontal: spacing.xs },
  notesEditText: { fontSize: 12, fontWeight: '700', color: colors.terraDark },
  notesBox: {
    backgroundColor: colors.sageLight,
    borderRadius: radii.md,
    padding: spacing.ms,
  },
  notesText: { fontSize: 12, fontFamily: fonts.mono, color: colors.inkMid, lineHeight: 18 },
  notesInput: {
    backgroundColor: colors.sky,
    borderRadius: radii.md,
    padding: spacing.ms,
    fontSize: 12,
    fontFamily: fonts.mono,
    color: colors.inkMid,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
});
