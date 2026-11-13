import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useAudioRecorder, useAudioRecorderState, RecordingPresets,
  requestRecordingPermissionsAsync, setAudioModeAsync,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { supabase } from '@/lib/supabase';
import type { Sticker } from '@/lib/types';
import { computeTrimOffsets, MeteringSample } from '@/lib/audioTrim';
import { useTrimmedVoicePlayback } from '@/hooks/useTrimmedVoicePlayback';
import { alertPermissionDenied } from '@/lib/permissions';
import { useToast } from '@/components/ToastProvider';
import { haptic } from '@/lib/haptics';

/// Under this a take is an accidental brush, not a recording (B-core 5).
const MIN_RECORDING_MS = 400;
/// Auto-stop.
const MAX_RECORDING_MS = 15_000;

/**
 * The learner's own recording of a card: hold to record, one take per card.
 * Lives with the card detail only; the study loop has no mic any more.
 *
 * The recorder lifecycle is unchanged from the study card it was lifted from,
 * including the part that matters: `holding` is the finger, not the microphone.
 * Everything between the press and `record()` is asynchronous, so every await
 * on the way in checks whether the finger is still down, or a quick tap would
 * leave a hot mic with nobody left to stop it.
 */
export function useVoiceTake(sticker: Sticker | null, onUpdate?: (id: string, patch: Partial<Sticker>) => void) {
  const toast = useToast();
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  // Polled well under the default 500ms so the silence trim has enough
  // resolution to find where speech actually starts and ends.
  const state = useAudioRecorderState(recorder, 100);
  const samples = useRef<MeteringSample[]>([]);
  const holding = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const { play, pause, playing } = useTrimmedVoicePlayback(
    voiceUrl, sticker?.voice_note_start_ms, sticker?.voice_note_end_ms,
  );

  // Signed here rather than through useSignedUrls: re-recording overwrites the
  // same storage path, so a map keyed by that path would never re-sign and the
  // player would keep serving the previous take.
  const refreshVoiceUrl = useCallback(async (path: string) => {
    const { data } = await supabase.storage.from('sticker-images').createSignedUrl(path, 3600);
    if (data) setVoiceUrl(data.signedUrl);
  }, []);

  useEffect(() => {
    setVoiceUrl(null);
    if (!sticker?.voice_note_path) return;
    let cancelled = false;
    supabase.storage.from('sticker-images')
      .createSignedUrl(sticker.voice_note_path, 3600)
      .then(({ data }) => { if (!cancelled && data) setVoiceUrl(data.signedUrl); });
    return () => { cancelled = true; };
  }, [sticker?.id, sticker?.voice_note_path]);

  useEffect(() => {
    if (!state.isRecording) return;
    samples.current.push({ t: state.durationMillis, db: state.metering ?? -160 });
  }, [state.isRecording, state.durationMillis, state.metering]);

  // Never leave the mic hot when the card changes or closes.
  useEffect(() => () => {
    holding.current = false;
    // `useAudioRecorder` disposes the native object when the component goes
    // away, and reading `recorder.isRecording` on a released object throws.
    // Already gone means nothing left to stop.
    try { if (recorder.isRecording) recorder.stop(); } catch { /* already disposed */ }
  }, [sticker?.id]);

  const stop = useCallback(async () => {
    const wasHolding = holding.current;
    holding.current = false;
    // `recorder.isRecording` is the live flag; `state` is a 100ms poll, and a
    // take shorter than one tick would look like no take at all.
    if (!sticker || !recorder.isRecording) return;
    if (!wasHolding) return;
    const durationMs = Math.max(state.durationMillis, Math.round(recorder.currentTime * 1000));
    const taken = samples.current;
    await recorder.stop();
    // Back to playback-only, so TTS and voice playback aren't left routed
    // through the recording session.
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    haptic.tap();
    if (durationMs < MIN_RECORDING_MS) {
      toast.show({ kind: 'info', message: 'Too short. Hold a bit longer.' });
      return;
    }

    setUploading(true);
    try {
      if (!recorder.uri) throw new Error('Recording failed');
      const { startMs, endMs } = computeTrimOffsets(taken, durationMs);
      const path = `${sticker.user_id}/${sticker.id}-voice.m4a`;
      const bytes = await new File(recorder.uri).bytes();
      const { error } = await supabase.storage
        .from('sticker-images')
        .upload(path, bytes, { contentType: 'audio/m4a', upsert: true });
      if (error) throw error;
      const { error: rowError } = await supabase.from('stickers').update({
        voice_note_path: path, voice_note_start_ms: startMs, voice_note_end_ms: endMs,
      }).eq('id', sticker.id);
      if (rowError) throw rowError;
      onUpdate?.(sticker.id, { voice_note_path: path, voice_note_start_ms: startMs, voice_note_end_ms: endMs });
      await refreshVoiceUrl(path);
    } catch {
      haptic.error();
      toast.show({ kind: 'error', message: "Couldn't save your recording. Try again." });
    } finally {
      setUploading(false);
    }
  }, [sticker, recorder, state.durationMillis, onUpdate, refreshVoiceUrl, toast]);

  // Auto-stop at 15s.
  useEffect(() => {
    if (state.isRecording && state.durationMillis >= MAX_RECORDING_MS) void stop();
  }, [state.isRecording, state.durationMillis, stop]);

  const start = useCallback(async () => {
    if (!sticker || uploading || recorder.isRecording) return;
    holding.current = true;
    const { granted, canAskAgain } = await requestRecordingPermissionsAsync();
    if (!granted) {
      holding.current = false;
      alertPermissionDenied('Mic is off', 'Tabi Stickers needs your microphone to record you saying the word.', canAskAgain);
      return;
    }
    if (!holding.current) return;
    pause();
    haptic.press();
    samples.current = [];
    // record() silently no-ops unless the audio session has allowsRecording on.
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    if (!holding.current) return;
    await recorder.prepareToRecordAsync();
    // Last check before the mic opens. Past this line the recorder is live and
    // it is stop()'s job to close it.
    if (!holding.current) { await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }); return; }
    recorder.record();
  }, [sticker, uploading, recorder, pause]);

  /** Release the finger before the hold delay elapsed: nothing started yet. */
  const cancelHold = useCallback(() => { holding.current = false; }, []);

  return {
    hasTake: !!sticker?.voice_note_path && !!voiceUrl,
    takeLoading: !!sticker?.voice_note_path && !voiceUrl,
    recording: state.isRecording,
    uploading,
    playing,
    start, stop, cancelHold,
    playTake: play,
    pauseTake: pause,
  };
}
