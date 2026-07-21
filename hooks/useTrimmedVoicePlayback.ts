import { useEffect } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

// Plays a recorded voice note starting at its detected speech onset and
// stops it again at the detected tail, so leading/trailing silence never
// gets heard — without touching the stored audio file. Falls back to
// playing the whole thing when there's no trim info (recordings made
// before trimming existed).
export function useTrimmedVoicePlayback(
  url: string | null,
  startMs: number | null | undefined,
  endMs: number | null | undefined
) {
  const player = useAudioPlayer(url ? { uri: url } : null, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);
  const endSeconds = endMs != null ? endMs / 1000 : null;

  useEffect(() => {
    if (endSeconds != null && status.playing && status.currentTime >= endSeconds) {
      player.pause();
    }
  }, [status.playing, status.currentTime, endSeconds]);

  const play = () => {
    player.seekTo((startMs ?? 0) / 1000);
    player.play();
  };

  return { play, pause: () => player.pause() };
}
