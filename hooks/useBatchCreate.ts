import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';
import { BatchQueue, nextToReview, batchProgress, type BatchItem } from '@/lib/batchQueue';
import { loopCapacity, sceneAvoidWords } from '@/lib/batchLimits';
import {
  BATCH_CONCURRENCY, BATCH_MAX, BATCH_TIMEOUT_MESSAGE, BATCH_TIMEOUT_MS,
  describeBatchError, disposeBatchResult, runBatchScan,
  type BatchPayload, type BatchPhoto, type BatchResult,
} from '@/lib/batchScan';
import type { ExtractResult } from '@/components/PhotoExtractor';
import { addSceneCards, newSceneId, type SceneChip } from '@/lib/sceneCards';
import type { StickerDraft } from '@/lib/types';
import { canCorrect, regenerateCard } from '@/lib/regenerateCard';
import type { Correction } from '@/lib/wordFix';
import { markAssetsUsed } from '@/lib/usedAssetsStore';

type Item = BatchItem<BatchPayload, BatchResult>;

interface Options {
  userId: string | undefined;
  language: string;
  /** The whole batch is resolved; `added` is how many cards were saved. */
  onFinished: (added: number) => void;
  /** Extra words from a card's scene failed to save (the card itself was). */
  onSceneFailed: (failed: number, total: number) => void;
}

// Batch create: pick up to BATCH_MAX photos, choose the object in each one
// after another, and let the cards make themselves in the background while the
// learner keeps choosing. Then review them one at a time (Add / Skip).
//
// Three phases, all driven from here so scan.tsx only wires UI:
//   choosing  — the extractor is showing photo N of M
//   making    — (overlaps choosing) queue runs create-sticker, 2 at a time
//   reviewing — a sheet per card; closing it leaves the rest queued
export function useBatchCreate({ userId, language, onFinished, onSceneFailed }: Options) {
  const latest = useRef({ userId, language, onFinished, onSceneFailed });
  latest.current = { userId, language, onFinished, onSceneFailed };

  const [queue, setQueue] = useState<BatchQueue<BatchPayload, BatchResult> | null>(null);
  const [photos, setPhotos] = useState<BatchPhoto[]>([]);
  // 2+ photos picked, intro screen showing, nothing made yet.
  const [introPhotos, setIntroPhotos] = useState<BatchPhoto[] | null>(null);
  const starting = useRef(false);
  const [launching, setLaunching] = useState(false);
  const launchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [choosingIndex, setChoosingIndex] = useState<number | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [retranslating, setRetranslating] = useState(false);
  const [retranslatingSentence, setRetranslatingSentence] = useState(false);
  const addedCount = useRef(0);
  // Ids being saved right now: a second tap on Add (or Add racing Skip) must
  // not insert the card twice.
  const busyIds = useRef(new Set<number>());
  const queueRef = useRef(queue);
  queueRef.current = queue;

  const noItems = useMemo(() => [] as readonly Item[], []);
  const subscribe = useCallback(
    (fn: () => void) => (queue ? queue.subscribe(fn) : () => {}),
    [queue],
  );
  const getSnapshot = useCallback(() => (queue ? queue.getSnapshot() : noItems), [queue, noItems]);
  const items = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Leaving the screen stops the requests still in flight (a result that lands
  // later would have nowhere to go). Finished cards are left alone.
  useEffect(() => () => {
    if (launchTimer.current) clearTimeout(launchTimer.current);
    queueRef.current?.shutdown();
  }, []);

  const makeQueue = useCallback(() => {
    return new BatchQueue<BatchPayload, BatchResult>({
      concurrency: BATCH_CONCURRENCY,
      timeoutMs: BATCH_TIMEOUT_MS,
      timeoutMessage: BATCH_TIMEOUT_MESSAGE,
      run: (payload, signal) => {
        const { userId: uid, language: lang } = latest.current;
        if (!uid) return Promise.reject(new Error('Not signed in'));
        return runBatchScan(payload, { userId: uid, language: lang, signal });
      },
      describeError: describeBatchError,
      dispose: disposeBatchResult,
    });
  }, []);

  const start = useCallback((chosen: BatchPhoto[]) => {
    if (!chosen.length) return;
    queueRef.current?.shutdown();
    addedCount.current = 0;
    busyIds.current.clear();
    const q = makeQueue();
    setQueue(q);
    setPhotos(chosen);
    setChoosingIndex(0);
    setReviewOpen(false);
  }, [makeQueue]);

  // Step 0: the learner picked 2+ photos. Show what happens next before making anything.
  const offer = useCallback((picked: BatchPhoto[]) => {
    const chosen = picked.slice(0, BATCH_MAX);
    if (chosen.length < 2) return;
    starting.current = false;
    setIntroPhotos(chosen);
  }, []);

  // Cancelling here throws nothing away: no card exists yet.
  const cancelIntro = useCallback(() => {
    if (starting.current) return;
    setIntroPhotos(null);
  }, []);

  const begin = useCallback(() => {
    if (starting.current || !introPhotos) return;
    starting.current = true;
    setLaunching(true);
    const chosen = introPhotos;
    setIntroPhotos(null);
    // The intro is a modal sliding away; iOS drops a modal presented while
    // another is still animating, and the extractor is one. Wait it out.
    launchTimer.current = setTimeout(() => {
      starting.current = false;
      setLaunching(false);
      start(chosen);
    }, 600);
  }, [introPhotos, start]);

  const unresolved = items.filter((i) => i.status !== 'added' && i.status !== 'skipped');

  // Everything resolved (and nothing left to choose): the batch is over.
  const finishIfDone = useCallback((q: BatchQueue<BatchPayload, BatchResult>, stillChoosing: boolean) => {
    if (stillChoosing || nextToReview(q.getSnapshot())) return;
    const added = addedCount.current;
    addedCount.current = 0;
    setReviewOpen(false);
    setChoosingIndex(null);
    setPhotos([]);
    setQueue(null);
    if (added > 0) latest.current.onFinished(added);
  }, []);

  // iOS silently drops a modal presented while another is still animating
  // away, and the extractor is a full-screen modal. Wait it out.
  const openReviewAfterModal = useCallback(() => {
    setTimeout(() => setReviewOpen(true), 600);
  }, []);

  // One photo's selection: one ExtractResult, or one per lasso loop. Each is its
  // own create-sticker request, queued in order.
  const confirmSelection = useCallback((extracts: ExtractResult | ExtractResult[]) => {
    const q = queueRef.current;
    if (!q || choosingIndex == null) return;
    const photo = photos[choosingIndex];
    if (!photo) return;
    const list = Array.isArray(extracts) ? extracts : [extracts];
    // Never more cards than the batch can hold, whatever the caller sent.
    const room = loopCapacity(BATCH_MAX, q.getSnapshot().length, photos.length - choosingIndex - 1);
    for (const extract of list.slice(0, room)) q.enqueue({ extract, photo, photoId: choosingIndex });
    if (choosingIndex + 1 < photos.length) {
      setChoosingIndex(choosingIndex + 1);
    } else {
      setChoosingIndex(null);
      openReviewAfterModal();
    }
  }, [choosingIndex, photos, openReviewAfterModal]);

  // A single photo with 2+ lasso loops, from the ordinary single-photo
  // extractor: no intro (the learner chose it), straight to review.
  const startFromLoops = useCallback((photo: BatchPhoto, extracts: ExtractResult[]) => {
    const list = extracts.slice(0, BATCH_MAX);
    if (!list.length) return;
    queueRef.current?.shutdown();
    addedCount.current = 0;
    busyIds.current.clear();
    const q = makeQueue();
    setQueue(q);
    queueRef.current = q;
    setPhotos([photo]);
    setChoosingIndex(null);
    setReviewOpen(false);
    for (const extract of list) q.enqueue({ extract, photo, photoId: 0 });
    openReviewAfterModal();
  }, [makeQueue, openReviewAfterModal]);

  // Closing the extractor part-way: photos not yet chosen are dropped, the ones
  // already sent keep going, and the learner is taken to review them.
  const stopChoosing = useCallback(() => {
    const q = queueRef.current;
    setChoosingIndex(null);
    if (!q) return;
    if (q.getSnapshot().length) openReviewAfterModal();
    else finishIfDone(q, false);
  }, [finishIfDone, openReviewAfterModal]);

  const current: Item | null = nextToReview(items);
  const currentIndex = current ? items.findIndex((i) => i.id === current.id) : -1;
  // While photos are still being cut the queue is still filling up, so the
  // total is the number picked; afterwards it is what was actually sent.
  // With lasso loops one photo can make several cards, so while cutting it is
  // the cards so far plus one for every photo still to come.
  const total = choosingIndex != null ? items.length + (photos.length - choosingIndex) : items.length;
  const label = `${currentIndex + 1} of ${total}`;

  const skip = useCallback(() => {
    const q = queueRef.current;
    const c = q ? nextToReview(q.getSnapshot()) : null;
    if (!q || !c || busyIds.current.has(c.id)) return;
    q.skip(c.id);
    finishIfDone(q, false);
  }, [finishIfDone]);

  const retry = useCallback(() => {
    const q = queueRef.current;
    const c = q ? nextToReview(q.getSnapshot()) : null;
    if (q && c) q.retry(c.id);
  }, []);

  const add = useCallback(async () => {
    const q = queueRef.current;
    const c = q ? nextToReview(q.getSnapshot()) : null;
    const uid = latest.current.userId;
    if (!q || !c || c.status !== 'done' || !c.result || !uid) return;
    if (busyIds.current.has(c.id)) return;
    busyIds.current.add(c.id);
    setSaving(true);
    const draft = c.result.draft;
    // Same as handleAdd in scan.tsx: the extra words share a scene_id with the
    // scanned card and are written in the background after it is saved.
    const sceneBase64 = c.result.sceneBase64;
    const extras = sceneBase64 ? c.result.chips : [];
    const sceneId = extras.length ? newSceneId() : null;
    try {
      // origin_author_id is deliberately not sent — see handleAdd in scan.tsx.
      const { error } = await supabase.from('stickers').insert({
        user_id: uid,
        scene_id: sceneId,
        language: draft.language,
        word: draft.word,
        translation: draft.translation,
        reading: draft.reading,
        sentence: draft.sentence,
        sentence_translation: draft.sentenceTranslation,
        sentence_insight: draft.sentenceInsight,
        sentence_gloss: draft.sentenceGloss,
        grammar_key: draft.grammarKey,
        part_of_speech: draft.partOfSpeech,
        category: draft.category,
        image_path: draft.imagePath,
        thumb_path: draft.thumbPath,
        memory_photo_path: draft.memoryPhotoPath,
        memory_photo_color: draft.memoryPhotoColor,
        discovered_at: draft.discoveredAt,
        latitude: draft.latitude,
        longitude: draft.longitude,
        location_label: draft.locationLabel,
      });
      if (error) return { error: error.message as string };
      // Counted like announceAdded does for a single card: the scanned word plus
      // the extras the learner chose, whether or not the extras later succeed.
      if (q.markAdded(c.id)) addedCount.current += 1 + extras.length;
      void markAssetsUsed([c.payload.photo.assetId]);
      finishIfDone(q, false);
      if (extras.length && sceneId && sceneBase64) {
        addSceneCards({
          userId: uid, language: draft.language, sceneBase64, sceneId,
          chips: extras, discoveredAt: draft.discoveredAt,
        }).then(({ failed }) => {
          if (failed) latest.current.onSceneFailed(failed, extras.length);
        }).catch(() => latest.current.onSceneFailed(extras.length, extras.length));
      }
      return { error: null };
    } finally {
      busyIds.current.delete(c.id);
      setSaving(false);
    }
  }, [finishIfDone]);

  // Corrections to a finished card's word / sentence, same calls as the single
  // path. They write into the queue item, so a correction survives closing and
  // reopening the review.
  const setChips = useCallback((chips: SceneChip[]) => {
    const c = queueRef.current ? nextToReview(queueRef.current.getSnapshot()) : null;
    if (!c || c.status !== 'done') return;
    queueRef.current?.updateResult(c.id, (r) => ({ ...r, chips }));
  }, []);

  // "Not a …?" / a typed meaning: re-asks create-sticker about this card's
  // already-uploaded cutout and replaces the whole card (see regenerateCard).
  // The close-up it needs is the one the card was made from, still in its
  // queue payload.
  const correct = useCallback(async (correction: Correction) => {
    const c = queueRef.current ? nextToReview(queueRef.current.getSnapshot()) : null;
    if (!c || c.status !== 'done' || !c.result) return;
    setRetranslating(true);
    try {
      const next = await regenerateCard({
        draft: c.result.draft,
        cropBase64: c.payload.extract.base64 ?? null,
        contextBase64: c.result.sceneBase64,
        correction,
      });
      queueRef.current?.updateResult(c.id, (r) => ({ ...r, draft: next }));
    } finally {
      setRetranslating(false);
    }
  }, []);

  const editSentence = useCallback(async (newSentence: string) => {
    const c = queueRef.current ? nextToReview(queueRef.current.getSnapshot()) : null;
    if (!c || c.status !== 'done') return;
    setRetranslatingSentence(true);
    try {
      const { data, error } = await supabase.functions.invoke('translate-sentence', {
        body: { englishSentence: newSentence, language: latest.current.language },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      queueRef.current?.updateResult(c.id, (r) => ({
        ...r,
        draft: {
          ...r.draft,
          sentence: String(data.sentence ?? r.draft.sentence),
          sentenceTranslation: newSentence,
          sentenceInsight: data.sentence_insight ?? r.draft.sentenceInsight,
          sentenceGloss: data.gloss ?? null,
          grammarKey: null,
        },
      }));
    } finally {
      setRetranslatingSentence(false);
    }
  }, []);

  return {
    /** A batch exists and has unfinished cards (or photos still to choose). */
    active: launching || !!introPhotos || (!!queue && (choosingIndex != null || unresolved.length > 0)),
    /** The intro screen is up: these photos are waiting for Start. */
    intro: introPhotos ? { count: introPhotos.length } : null,
    offer, begin, cancelIntro,
    progress: {
      ...batchProgress(items, total),
      ...(choosingIndex != null ? { photoIndex: choosingIndex, photoCount: photos.length } : {}),
    },
    startFromLoops,
    max: BATCH_MAX,
    // Choosing phase
    choosing: choosingIndex != null && photos[choosingIndex]
      ? { photo: photos[choosingIndex], maxLoops: loopCapacity(BATCH_MAX, items.length, photos.length - choosingIndex - 1), label: `Photo ${choosingIndex + 1} of ${photos.length}`, isLast: choosingIndex + 1 === photos.length }
      : null,
    confirmSelection,
    stopChoosing,
    // Review phase
    reviewOpen: reviewOpen && choosingIndex == null,
    openReview: useCallback(() => setReviewOpen(true), []),
    closeReview: useCallback(() => setReviewOpen(false), []),
    pendingCount: unresolved.length,
    current: current
      ? {
          id: current.id,
          label,
          state: (current.status === 'done' ? 'ready'
            : current.status === 'failed' ? 'failed' : 'pending') as 'ready' | 'failed' | 'pending',
          draft: (current.result?.draft ?? null) as StickerDraft | null,
          canCorrect: !!current.payload.extract.base64 && !!current.result && canCorrect(current.result.draft),
          error: current.error,
          sceneBase64: current.result?.sceneBase64 ?? null,
          chips: current.result?.chips ?? [],
          isLast: unresolved.length === 1,
          avoid: sceneAvoidWords(items.map((i) => ({
            id: i.id,
            photoId: i.payload.photoId,
            status: i.status,
            word: i.result?.draft.word ?? null,
            chipWords: i.result?.chips.map((c) => c.word) ?? [],
          })), current.id),
        }
      : null,
    add, skip, retry, setChips, correct, editSentence,
    saving, retranslating, retranslatingSentence,
  };
}
