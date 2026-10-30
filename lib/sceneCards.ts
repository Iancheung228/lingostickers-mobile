import { supabase } from '@/lib/supabase';
import { getFunctionErrorMessage } from '@/lib/functionError';
import { Language } from '@/lib/types';

/**
 * Scene prompts — one photo, many words (see supabase/functions/_shared/
 * scenePrompts.ts for the prompts themselves and the server's rules).
 *
 * The flow is two steps on purpose. Asking a prompt only returns chips, which
 * is one short call (~2s). Sentences are written only for the chips the
 * learner keeps, after they tap Add, so nobody waits on or pays for cards
 * they skipped.
 */

/** The prompts offered after a scan, in the order shown. Labels match the server. */
export const SCENE_PROMPTS = [
  { id: 'happening', label: "What's happening?" },
  { id: 'like', label: "What's it like?" },
  { id: 'what-is-it', label: 'What else is here?' },
  { id: 'where', label: 'Where is it?' },
  { id: 'how', label: 'How?' },
  { id: 'local', label: 'Say it like a local' },
  { id: 'say-here', label: 'What would you say here?' },
] as const;

export type ScenePromptId = (typeof SCENE_PROMPTS)[number]['id'];

export interface SceneChip {
  word: string;
  translation: string;
  part_of_speech: string;
  reading: string;
}

export async function fetchSceneWords(
  sceneBase64: string,
  promptId: ScenePromptId,
  language: Language,
  avoid: string[],
): Promise<SceneChip[]> {
  const { data, error } = await supabase.functions.invoke('scene-words', {
    body: { scene: `data:image/jpeg;base64,${sceneBase64}`, promptId, language, avoid },
  });
  if (error) throw new Error(await getFunctionErrorMessage(error));
  if (data?.error) throw new Error(String(data.error));
  return Array.isArray(data?.candidates) ? data.candidates : [];
}

/**
 * Makes one card per chosen chip and saves them, all in parallel.
 *
 * Each card gets its own copy of the scene photo as its picture. Shared files
 * would be simpler, but deleting a card deletes its files, and one card's
 * delete must never blank another card's picture.
 */
export async function addSceneCards({
  userId, language, sceneBase64, sceneId, chips, discoveredAt,
}: {
  userId: string;
  language: Language;
  sceneBase64: string;
  sceneId: string;
  chips: SceneChip[];
  discoveredAt: string;
}): Promise<{ added: number; failed: number }> {
  const bytes = base64ToBytes(sceneBase64);
  const results = await Promise.allSettled(chips.map(async (chip) => {
    const { data: card, error } = await supabase.functions.invoke('create-card', {
      body: {
        text: chip.word,
        language,
        scene: `data:image/jpeg;base64,${sceneBase64}`,
        chosen: { translation: chip.translation, part_of_speech: chip.part_of_speech },
      },
    });
    if (error) throw new Error(await getFunctionErrorMessage(error));
    if (card?.error) throw new Error(String(card.error));

    const imagePath = `${userId}/${storageId()}-scene.jpg`;
    const upload = await supabase.storage
      .from('sticker-images')
      .upload(imagePath, bytes, { contentType: 'image/jpeg', upsert: false });
    if (upload.error) throw new Error(upload.error.message);

    const { error: insertError } = await supabase.from('stickers').insert({
      user_id: userId,
      language,
      source: 'scene',
      scene_id: sceneId,
      word: String(card.word ?? chip.word),
      translation: String(card.translation ?? chip.translation),
      reading: String(card.reading ?? chip.reading ?? ''),
      part_of_speech: card.part_of_speech ?? chip.part_of_speech ?? null,
      forms: card.forms ?? null,
      sentence: String(card.sentence ?? ''),
      sentence_translation: String(card.sentence_translation ?? ''),
      sentence_insight: card.sentence_insight ?? null,
      sentence_gloss: card.gloss ?? null,
      grammar_key: card.grammar_key ?? null,
      category: card.category ?? 'Other',
      image_path: imagePath,
      discovered_at: discoveredAt,
    });
    if (insertError) {
      await supabase.storage.from('sticker-images').remove([imagePath]);
      throw new Error(insertError.message);
    }
  }));
  const failed = results.filter((r) => r.status === 'rejected').length;
  return { added: chips.length - failed, failed };
}

/**
 * A v4-shaped UUID for `scene_id` (a UUID column). Not crypto: Hermes has no
 * global `crypto` (see lib/cutout.ts), and this only groups sibling cards.
 */
export function newSceneId(): string {
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${'89ab'[Math.floor(Math.random() * 4)]}${hex(3)}-${hex(12)}`;
}

function storageId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
