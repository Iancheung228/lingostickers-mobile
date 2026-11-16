import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';
import { BatchQueue, nextToReview, type BatchItem } from '@/lib/batchQueue';
import {
  BATCH_CONCURRENCY, BATCH_MAX, BATCH_TIMEOUT_MESSAGE, BATCH_TIMEOUT_MS,
  describeBatchError, disposeBatchResult, runBatchScan,
  type BatchPayload, type BatchPhoto, type BatchResult,
} from '@/lib/batchScan';
import type { ExtractResult } from '@/components/PhotoExtractor';
import type { StickerDraft } from '@/lib/types';

type Item = BatchItem<BatchPayload, BatchResult>;

interface Options {
  userId: string | undefined;
  language: string;
  /** The whole batch is resolved; `added` is how many cards were saved. */
  onFinished: (added: number) => void;
}

// Batch create: pick up to BATCH_MAX photos, choose the object in each one
// after another, and let the cards make themselves in the background while the
// learner keeps choosing. Then review them one at a time (Add / Skip).
//
// Three phases, all driven from here so scan.tsx only wires UI:
//   choosing  — the extractor is showing photo N of M
//   making    — (overlaps choosing) queue runs create-sticker, 2 at a time
//   reviewing — a sheet per card; closing it leaves the rest queued
export function useBatchCreate({ userId, language, onFinished }: Options) {
  const latest = useRef({ userId, language, onFinished });
  latest.current = { userId, language, onFinished };

  const [queue, setQueue] = useState<BatchQueue<BatchPayload, BatchResult> | null>(null);
  const [photos, setPhotos] = useState<BatchPhoto[]>([]);
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
  useEffect(() => () => { queueRef.current?.shutdown(); }, []);

  const start = useCallback((picked: BatchPhoto[]) => {
    const chosen = picked.slice(0, BATCH_MAX);
    if (!chosen.length) return;
    queueRef.current?.shutdown();
    addedCount.current = 0;
    busyIds.current.clear();
    const q = new BatchQueue<BatchPayload, BatchResult>({
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
    setQueue(q);
    setPhotos(chosen);
    setChoosingIndex(0);
    setReviewOpen(false);
  }, []);

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

  const confirmSelection = useCallback((extract: ExtractResult) => {
    const q = queueRef.current;
    if (!q || choosingIndex == null) return;
    const photo = photos[choosingIndex];
    if (!photo) return;
    q.enqueue({ extract, photo });
    if (choosingIndex + 1 < photos.length) {
      setChoosingIndex(choosingIndex + 1);
    } else {
      setChoosingIndex(null);
      openReviewAfterModal();
    }
  }, [choosingIndex, photos, openReviewAfterModal]);

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
  const total = items.length;
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
    try {
      // origin_author_id is deliberately not sent — see handleAdd in scan.tsx.
      const { error } = await supabase.from('stickers').insert({
        user_id: uid,
        scene_id: null,
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
      if (q.markAdded(c.id)) addedCount.current += 1;
      finishIfDone(q, false);
      return { error: null };
    } finally {
      busyIds.current.delete(c.id);
      setSaving(false);
    }
  }, [finishIfDone]);

  // Corrections to a finished card's word / sentence, same calls as the single
  // path. They write into the queue item, so a correction survives closing and
  // reopening the review.
  const editWord = useCallback(async (newWord: string) => {
    const c = queueRef.current ? nextToReview(queueRef.current.getSnapshot()) : null;
    if (!c || c.status !== 'done') return;
    setRetranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke('translate-word', {
        body: { englishWord: newWord, language: latest.current.language },
      });
      // Thrown as-is: DiscoveryReveal runs it through friendlyError (lesson 3).
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      queueRef.current?.updateResult(c.id, (r) => ({
        ...r,
        draft: {
          ...r.draft,
          word: String(data.word ?? r.draft.word),
          translation: String(data.translation ?? newWord),
          reading: String(data.reading ?? r.draft.reading),
          category: data.category ?? r.draft.category,
        },
      }));
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
    active: !!queue && (choosingIndex != null || unresolved.length > 0),
    max: BATCH_MAX,
    start,
    // Choosing phase
    choosing: choosingIndex != null && photos[choosingIndex]
      ? { photo: photos[choosingIndex], label: `Photo ${choosingIndex + 1} of ${photos.length}`, isLast: choosingIndex + 1 === photos.length }
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
          error: current.error,
        }
      : null,
    add, skip, retry, editWord, editSentence,
    saving, retranslating, retranslatingSentence,
  };
}
