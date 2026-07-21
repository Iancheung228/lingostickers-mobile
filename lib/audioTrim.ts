export interface MeteringSample {
  t: number;   // milliseconds into the recording
  db: number;  // metering level in dB (roughly -160 silence .. 0 loudest)
}

// Below this, treat it as silence/background noise rather than speech.
// Typical room tone sits well under -40dB; actual speech is usually
// well above -30dB, so -35dB is a comfortable middle threshold.
const SILENCE_THRESHOLD_DB = -35;

// Keep a small cushion around the detected speech so words don't get
// clipped right at their onset/tail.
const PADDING_MS = 80;

// Finds where actual speech starts/ends within a recording from its
// metering samples, so playback can seek past leading silence and stop
// before trailing silence — without needing to re-encode the audio file.
// Falls back to the full duration if metering never picked up anything
// above the threshold (e.g. metering was unavailable on this device).
export function computeTrimOffsets(
  samples: MeteringSample[],
  durationMs: number
): { startMs: number; endMs: number } {
  const loud = samples.filter(s => s.db > SILENCE_THRESHOLD_DB);
  if (loud.length === 0) return { startMs: 0, endMs: durationMs };

  const startMs = Math.max(0, loud[0].t - PADDING_MS);
  const endMs = Math.min(durationMs, loud[loud.length - 1].t + PADDING_MS);
  return { startMs, endMs };
}
