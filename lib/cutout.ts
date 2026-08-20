import { File } from 'expo-file-system';

import { cutout, isAvailable, type CutoutResult } from '@/modules/subject-cutout';
import { trackEvent } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';
import type { Point } from '@/lib/cropGeometry';

export type { CutoutResult } from '@/modules/subject-cutout';

/**
 * Which tool the user drew their selection with. It changes how much we trust
 * the selection, so it changes the gate.
 */
export type SelectionKind = 'box' | 'lasso';

// ---------------------------------------------------------------------------
// The confidence gate
//
// These thresholds decide when the device hands off to the server. They live
// here, in JavaScript, rather than in the Swift — the gate is the part most
// likely to need tuning against real scans, and a constant in TypeScript can
// be changed with a hot reload where a constant in Swift costs an EAS build.
//
// `containment` ("is this instance mostly inside what the user circled?") uses
// the same bar for both tools: an instance sprawling well outside the
// selection means Vision grabbed the table, not the object, and that's equally
// wrong however the selection was drawn.
//
// `coverage` ("does the instance fill enough of the selection?") has to differ,
// because the two tools mean different things. The box starts at 70% of the
// frame and users often don't tighten it, so a genuinely small object can
// legitimately fill very little of it — a strict bar there would reject
// correct cutouts constantly. A traced lasso is deliberate and hugs the
// subject, so an instance filling almost none of it really is the wrong thing.
// ---------------------------------------------------------------------------
const GATE = {
  box: { minContainment: 0.55, minCoverage: 0.08 },
  lasso: { minContainment: 0.55, minCoverage: 0.25 },
} as const;

/**
 * Segment at this; ship at the lower figure. Mask quality wants the pixels,
 * the PNG doesn't. See SEGMENT_MAX_WIDTH in PhotoExtractor for why this isn't
 * simply set as high as it will go.
 */
const SEGMENT_MAX_DIMENSION = 1600;
const OUTPUT_MAX_DIMENSION = 1280;

export function isLocalCutoutAvailable(): boolean {
  return isAvailable();
}

/**
 * Try to cut the subject out on-device.
 *
 * Returns a refusal rather than throwing — "the device declined" is an
 * ordinary branch here, and every refusal reason routes to the server path.
 */
export async function attemptLocalCutout(params: {
  uri: string;
  polygon: Point[];
  sourceWidth: number;
  sourceHeight: number;
  kind: SelectionKind;
}): Promise<CutoutResult> {
  const { uri, polygon, sourceWidth, sourceHeight, kind } = params;

  if (!isAvailable()) {
    const result: CutoutResult = { ok: false, reason: 'unavailable' };
    reportCutout(result, kind);
    return result;
  }

  const gate = GATE[kind];
  const result = await cutout({
    uri,
    polygon,
    sourceWidth,
    sourceHeight,
    maxDimension: SEGMENT_MAX_DIMENSION,
    outputMaxDimension: OUTPUT_MAX_DIMENSION,
    minContainment: gate.minContainment,
    minCoverage: gate.minCoverage,
  });

  reportCutout(result, kind);
  return result;
}

// ---------------------------------------------------------------------------
// Upload
//
// The cutout goes straight from the device to Storage rather than through the
// edge function. The bucket's RLS policy already scopes writes to
// `{userId}/…`, which is the same path the function would have written to, so
// routing a finished PNG through a Deno worker would add a base64 round-trip
// and an extra hop to gain nothing.
// ---------------------------------------------------------------------------
export async function uploadCutout(uri: string, userId: string): Promise<string> {
  const file = new File(uri);
  const bytes = await file.arrayBuffer();
  const path = `${userId}/${stickerFileName()}`;

  const { error } = await supabase.storage
    .from('sticker-images')
    .upload(path, bytes, { contentType: 'image/png', upsert: false });

  if (error) throw new Error(`Cutout upload failed: ${error.message}`);

  // The native module wrote this into the temp directory. iOS will clear it
  // eventually, but a user scanning all afternoon shouldn't accumulate a
  // full-resolution PNG per scan waiting for that.
  try {
    file.delete();
  } catch {
    // Losing a temp file is not worth failing a scan over.
  }

  return path;
}

/**
 * A unique object name for this user's storage folder.
 *
 * Deliberately not a crypto UUID: Hermes has no global `crypto`, and Expo's
 * winter runtime polyfills FormData/TextDecoder/URL/fetch but not this — so
 * `crypto.randomUUID()` throws on device. Nothing here needs unguessability
 * either. The bucket's RLS already scopes every object to its owner, so a
 * guessed path grants nothing, and `upsert: false` means the worst a collision
 * could do is fail one upload rather than overwrite someone's sticker.
 */
function stickerFileName(): string {
  const stamp = Date.now().toString(36);
  const suffix = Math.random().toString(36).slice(2, 10);
  return `${stamp}-${suffix}.png`;
}

// ---------------------------------------------------------------------------
// Telemetry
//
// Aptabase is already wired up and has, until now, tracked exactly one event.
// The escalation rate and the mix of refusal reasons are the two numbers the
// whole cost and quality model rests on, so they get recorded from day one.
// ---------------------------------------------------------------------------
function reportCutout(result: CutoutResult, kind: SelectionKind) {
  if (result.ok) {
    trackEvent('cutout_local', {
      selection: kind,
      instances: result.instanceCount,
      selected: result.selectedCount,
      containment: round(result.containment),
      coverage: round(result.coverage),
      subjectArea: round(result.subjectAreaRatio),
      durationMs: result.durationMs,
    });
    return;
  }

  trackEvent('cutout_escalated', {
    selection: kind,
    reason: result.reason,
    instances: result.instanceCount ?? 0,
    containment: round(result.containment ?? 0),
    coverage: round(result.coverage ?? 0),
    durationMs: result.durationMs ?? 0,
  });
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
