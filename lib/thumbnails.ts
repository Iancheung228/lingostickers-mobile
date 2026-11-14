import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { Sticker } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { debugWarn } from '@/lib/debug';

// ---------------------------------------------------------------------------
// Sticker thumbnails
//
// A cutout is stored as a PNG up to 1280px on its long side, ~435KB on
// average (measured 2026-11-11 on the demo account, 177KB-984KB). Every list
// surface draws it at tile size: the collection grid is two columns, ~180pt,
// so ~540px at 3x. On a fresh install, with an empty image cache, a collection
// was downloading ten times the bytes it could show, and that is most of why
// first launch felt slow.
//
// So each new cutout also gets a 512px WebP (lossy, alpha kept, typically
// 20-40KB), and list surfaces draw that. Full-size surfaces (the study card,
// boards, export) keep using image_path.
//
// thumb_path is null for anything without one: stickers made before this,
// server-side cutouts, and typed/scene cards with no picture. Readers fall
// back to image_path, so a missing thumbnail costs speed, never correctness.
// ---------------------------------------------------------------------------

export const THUMB_MAX_SIDE = 512;
const THUMB_QUALITY = 0.8;

/**
 * Where a cutout's thumbnail lives: beside it, same folder, so the bucket's
 * owner-folder RLS covers it unchanged. Deterministic, so a cleanup path that
 * only knows image_path can still remove the thumbnail (removing a file that
 * was never written is a no-op in Storage).
 */
export function thumbPathFor(imagePath: string): string {
  return imagePath.replace(/\.[a-z0-9]+$/i, '') + '.thumb.webp';
}

/**
 * True when the sticker is a transparent cutout, which is the only thing the
 * Calendar draws as "the day" (never a full rectangular photo). Decided by the
 * file extension: device cutouts upload `.png` (lib/cutout.ts), server cutouts
 * are `.png` (create-sticker validatePrecutPath / encodePng). Rectangular
 * images are `.jpg`: create-sticker uploads the original jpeg when background
 * removal fails, and scene cards are `${id}-scene.jpg` (lib/sceneCards.ts).
 */
export function isCutout(sticker: Pick<Sticker, 'image_path'>): boolean {
  return !!sticker.image_path && /\.png$/i.test(sticker.image_path);
}

/** A day's icon: its first cutout find, or null when none of its finds is a cutout. */
export function firstCutout(list: readonly Sticker[] | undefined): Sticker | null {
  return list?.find(isCutout) ?? null;
}

/**
 * The path a list surface should sign, load and cache under. Use the same
 * value for all three: expo-image caches by cacheKey, so caching a thumbnail
 * under image_path would later show it, blurry, on the full-size study card.
 */
export function listImagePath(
  sticker: Pick<Sticker, 'thumb_path' | 'image_path'>,
): string | null {
  return sticker.thumb_path ?? sticker.image_path ?? null;
}

/** A file's own path plus its thumbnail's, for removing both together. */
export function withThumbPath(imagePath: string): string[] {
  return [imagePath, thumbPathFor(imagePath)];
}

/**
 * Render and upload the thumbnail for a local cutout. Never throws: a sticker
 * without a thumbnail still works, so a failure here must not fail the scan.
 * Returns the stored path, or null when there is none.
 */
export async function uploadThumbnail(localUri: string, imagePath: string): Promise<string | null> {
  let tempUri: string | null = null;
  try {
    const full = await ImageManipulator.manipulate(localUri).renderAsync();
    const longSide = Math.max(full.width, full.height);
    let context = ImageManipulator.manipulate(full);
    if (longSide > THUMB_MAX_SIDE) {
      const scale = THUMB_MAX_SIDE / longSide;
      context = context.resize(
        full.width >= full.height
          ? { width: THUMB_MAX_SIDE, height: Math.round(full.height * scale) }
          : { width: Math.round(full.width * scale), height: THUMB_MAX_SIDE },
      );
    }
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ format: SaveFormat.WEBP, compress: THUMB_QUALITY });
    tempUri = saved.uri;

    const bytes = await new File(saved.uri).arrayBuffer();
    const path = thumbPathFor(imagePath);
    const { error } = await supabase.storage
      .from('sticker-images')
      .upload(path, bytes, { contentType: 'image/webp', upsert: true });
    if (error) throw error;
    return path;
  } catch (err: any) {
    debugWarn('[thumb] could not make a thumbnail; lists will use the full image', err?.message);
    return null;
  } finally {
    if (tempUri) {
      try { new File(tempUri).delete(); } catch { /* temp file; iOS clears it */ }
    }
  }
}
