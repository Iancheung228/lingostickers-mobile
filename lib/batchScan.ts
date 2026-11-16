// ---------------------------------------------------------------------------
// One photo's trip from "the user chose the object" to a finished draft —
// the same legs as app/(tabs)/scan.tsx's handleExtractFromPhoto (device
// cutout, upload, create-sticker), minus every piece of screen state, so the
// batch queue can run several at once in the background.
//
// scan.tsx keeps its own copy for the single-photo path on purpose: that path
// is the one every user takes today and is left exactly as it was.
// ---------------------------------------------------------------------------
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';
import { withThumbPath } from '@/lib/thumbnails';
import { ScanFailure, SCAN_ERRORS, classifyScanFailure } from '@/lib/scanError';
import { attemptLocalCutout, uploadCutout, cutoutPath, CUTOUT_DRY_RUN } from '@/lib/cutout';
import { getImportedPhotoMetadata } from '@/lib/photoMetadata';
import { debugLog, debugWarn } from '@/lib/debug';
import type { ExtractResult } from '@/components/PhotoExtractor';
import type { StickerDraft } from '@/lib/types';
import { parseAlternatives } from '@/lib/wordFix';
import type { SceneChip } from '@/lib/sceneCards';

export interface BatchPhoto { uri: string; width: number; height: number; assetId?: string }
/** `photoId`: cards cut from the same photo (several loops) share it. */
export interface BatchPayload { extract: ExtractResult; photo: BatchPhoto; photoId: number }
export interface BatchResult {
  draft: StickerDraft;
  croppedUri: string;
  /** The small scene photo (640px) the "More words from this photo" chips ask about. Dies with the item. */
  sceneBase64: string | null;
  /** Extra words the learner has picked from this photo; made into cards on Add. */
  chips: SceneChip[];
}

export const BATCH_MAX = 5;
export const BATCH_CONCURRENCY = 2;
// Same ceiling as a single scan (SCAN_TIMEOUT_MS in scan.tsx).
export const BATCH_TIMEOUT_MS = 60_000;
export const BATCH_TIMEOUT_MESSAGE =
  'The word service is taking too long right now. Try this one again, or skip it.';

class BatchError extends Error {}

async function resizedBase64(uri: string, width: number, height: number, maxSide: number, compress: number) {
  let ctx = ImageManipulator.manipulate(uri);
  const longSide = Math.max(width, height);
  if (longSide > maxSide) ctx = ctx.resize({ width: Math.round(width * (maxSide / longSide)) });
  const rendered = await ctx.renderAsync();
  const out = await rendered.saveAsync({ compress, format: SaveFormat.JPEG, base64: true });
  return out.base64 ?? null;
}

function removeFiles(paths: (string | null | undefined)[], what: string) {
  const list = paths.filter(Boolean) as string[];
  if (!list.length) return;
  supabase.storage.from('sticker-images').remove(list).then(({ error }) => {
    if (error) debugWarn(`Failed to clean up ${what}`, error);
  });
}

/**
 * Throws a finished card's uploaded files away — the same set flushPendingDiscard
 * in scan.tsx removes: the cutout, its list thumbnail (lesson 17) and the memory
 * photo. A skipped batch card is final (no Undo window), so this runs at once.
 */
export function disposeBatchResult(result: BatchResult) {
  const { imagePath, memoryPhotoPath } = result.draft;
  removeFiles([...(imagePath ? withThumbPath(imagePath) : []), memoryPhotoPath], 'a skipped batch card');
}

/**
 * Words for the learner. Same classification as a single scan (lib/scanError.ts,
 * lesson 3: never error.message), so a failed batch card reads like a failed
 * scan. The batch has no "type the word instead", so the copy stays at the title.
 */
export function describeBatchError(err: unknown): string {
  const kind = classifyScanFailure(err, { lookingUpWord: true, timedOut: false });
  return SCAN_ERRORS[kind].title;
}

export async function runBatchScan(
  { extract, photo }: BatchPayload,
  { userId, language, signal }: { userId: string; language: string; signal: AbortSignal },
): Promise<BatchResult> {
  if (signal.aborted) throw new BatchError('Stopped');
  const metadataPromise = getImportedPhotoMetadata(photo.assetId);

  const [memoryBase64, contextBase64, local] = await Promise.all([
    resizedBase64(photo.uri, photo.width, photo.height, 1280, 0.7),
    resizedBase64(photo.uri, photo.width, photo.height, 640, 0.6),
    attemptLocalCutout({
      uri: extract.segmentUri,
      polygon: extract.selectionPolygon,
      sourceWidth: extract.segmentWidth,
      sourceHeight: extract.segmentHeight,
      kind: extract.selectionKind,
      fullUri: extract.fullUri,
      fullWidth: extract.fullWidth,
      fullHeight: extract.fullHeight,
      fullPolygon: extract.fullSelectionPolygon,
    }),
  ]);

  let precutImagePath: string | null = null;
  let precutThumbPath: string | null = null;
  if (local.ok && !CUTOUT_DRY_RUN) {
    try {
      const upload = await uploadCutout(local.uri, cutoutPath(userId));
      precutImagePath = upload.path;
      precutThumbPath = upload.thumbPath;
    } catch (e: any) {
      // Same fallback as a single scan: the server cuts it out instead.
      debugWarn('[batch] cutout upload failed, falling back to server', e?.message);
    }
  }
  const dropPrecut = () => removeFiles(precutImagePath ? withThumbPath(precutImagePath) : [], 'an unused batch cutout');
  if (signal.aborted) { dropPrecut(); throw new BatchError('Stopped'); }

  const invoked = supabase.functions.invoke('create-sticker', {
    body: {
      image: `data:image/jpeg;base64,${extract.base64}`,
      userId,
      language,
      ...(memoryBase64 ? { memoryImage: `data:image/jpeg;base64,${memoryBase64}` } : {}),
      ...(contextBase64 ? { contextImage: `data:image/jpeg;base64,${contextBase64}` } : {}),
      ...(extract.lassoPolygon ? { lassoPolygon: extract.lassoPolygon } : {}),
      ...(precutImagePath ? { precutImagePath } : {}),
    },
    signal,
  });
  // As in scan.tsx: the signal alone does not stop the request on the device,
  // so race it, and clean up after a result that lands once we have given up.
  const stopped = new Promise<never>((_, reject) => {
    const onAbort = () => reject(new BatchError('Stopped'));
    if (signal.aborted) onAbort(); else signal.addEventListener('abort', onAbort, { once: true });
  });
  stopped.catch(() => {});
  invoked.then(({ data: late }) => {
    if (!signal.aborted) return;
    removeFiles(
      [...(late?.imagePath ? withThumbPath(late.imagePath) : []), late?.memoryPhotoPath, ...(precutImagePath ? withThumbPath(precutImagePath) : [])],
      'a stopped batch scan',
    );
  }).catch(() => {});

  let response;
  try {
    response = await Promise.race([invoked, stopped]);
  } catch (e) {
    if (!signal.aborted) dropPrecut();
    throw e;
  }
  const { data, error } = response;
  if (error) {
    dropPrecut();
    const status = (error as any).context?.status as number | undefined;
    // No status: the request never got an answer (offline), keep the original so
    // it classifies as offline.
    if (!status) throw error;
    const body = await (error as any).context?.json?.().catch(() => null);
    throw new ScanFailure(body?.error ?? 'This took too long and was cut off.', { status });
  }
  if (!data || data.error) {
    dropPrecut();
    throw new ScanFailure(String(data?.error ?? 'No word came back.'));
  }
  if (!String(data.word ?? '').trim()) {
    dropPrecut();
    throw new ScanFailure('Nothing recognised', { kind: 'nothing' });
  }
  debugLog('[batch] created', data.word);

  let discoveredAt = new Date().toISOString();
  let latitude: number | null = null;
  let longitude: number | null = null;
  let locationLabel: string | null = null;
  const meta = await metadataPromise;
  if (meta.discoveredAt) discoveredAt = meta.discoveredAt;
  if (meta.location) {
    latitude = meta.location.latitude;
    longitude = meta.location.longitude;
    locationLabel = meta.location.locationLabel;
  }

  const draft: StickerDraft = {
    language: data.language === 'ja' || data.language === 'yue' ? data.language : 'fr',
    word: String(data.word ?? ''),
    translation: String(data.translation ?? ''),
    reading: String(data.reading ?? ''),
    sentence: String(data.sentence ?? ''),
    sentenceTranslation: String(data.sentenceTranslation ?? ''),
    sentenceInsight: data.sentenceInsight ?? null,
    sentenceGloss: data.sentenceGloss ?? null,
    grammarKey: data.grammarKey ?? null,
    partOfSpeech: data.partOfSpeech ?? null,
    category: data.category ?? 'Other',
    alternatives: parseAlternatives(data.alternatives, String(data.word ?? '')),
    imagePath: String(data.imagePath ?? ''),
    // Only trusted when the server kept the device's cutout (as in scan.tsx).
    thumbPath: precutThumbPath && precutImagePath && data.imagePath === precutImagePath ? precutThumbPath : null,
    memoryPhotoPath: data.memoryPhotoPath ?? null,
    memoryPhotoColor: data.memoryPhotoColor ?? null,
    bgIssue: data.bgIssue ?? null,
    bgSource: data.bgSource === 'device' ? 'device' : 'server',
    localCutoutUri: null,
    discoveredAt,
    latitude,
    longitude,
    locationLabel,
  };
  return { draft, croppedUri: extract.uri, sceneBase64: contextBase64, chips: [] };
}
