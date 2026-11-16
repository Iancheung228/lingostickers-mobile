import * as MediaLibrary from 'expo-media-library';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { isScreenshot, randomWindows, sampleDistinct } from './photoSelection';

// The in-app picker's view of the photo library. All the pure rules (selection
// cap, sampling, used-asset list) live in photoSelection.ts / usedAssets.ts;
// this file is the thin expo-media-library layer around them.

export type LibraryAccess = 'full' | 'limited' | 'denied';

/** What the grid needs to draw and select one photo. `uri` is ph:// on iOS: a thumbnail source, NOT what the scan flow reads. */
export interface LibAsset { id: string; uri: string; width: number; height: number; created: number }

/** The shape both existing flows (single + batch) already take. */
export interface PickedPhoto { uri: string; width: number; height: number; assetId: string }

export type PickerSource =
  | { kind: 'new' }
  | { kind: 'favorites'; albumId: string | null }
  | { kind: 'album'; albumId: string; title: string }
  | { kind: 'shuffle' };

export interface Page { assets: LibAsset[]; cursor: string | null; hasMore: boolean }

const PAGE = 60;
/** Screenshot / used-photo filters can empty a whole page; stop after this many so a call stays fast. */
const MAX_PAGES_PER_CALL = 6;
const SHUFFLE_TARGET = 36;
const SHUFFLE_WINDOWS = 10;
const YEAR_MS = 365 * 86_400_000;

/** Reads the current permission without prompting. */
export async function getLibraryAccess(): Promise<LibraryAccess> {
  try {
    const p = await MediaLibrary.getPermissionsAsync();
    if (!p.granted) return 'denied';
    return p.accessPrivileges === 'limited' ? 'limited' : 'full';
  } catch {
    return 'denied';
  }
}

const toLib = (a: MediaLibrary.Asset): LibAsset => ({ id: a.id, uri: a.uri, width: a.width, height: a.height, created: a.creationTime });
const keep = (a: MediaLibrary.Asset) => !isScreenshot(a.mediaSubtypes);

interface Range { createdAfter?: number; createdBefore?: number }

/**
 * Newest-first pages, screenshots dropped, optionally minus `skip` (used ids).
 * Pages are fetched until `want` survive the filters or the library ends; the
 * cursor is the last *fetched* asset so the next call carries on correctly.
 */
async function fetchFiltered(opts: { album?: string; after?: string | null; want: number; skip?: ReadonlySet<string>; range?: Range }): Promise<Page> {
  const out: LibAsset[] = [];
  let cursor = opts.after ?? null;
  let hasMore = true;
  for (let i = 0; i < MAX_PAGES_PER_CALL && hasMore && out.length < opts.want; i++) {
    const res = await MediaLibrary.getAssetsAsync({
      first: PAGE,
      after: cursor ?? undefined,
      album: opts.album,
      mediaType: 'photo',
      sortBy: [['creationTime', false]],
      createdAfter: opts.range?.createdAfter,
      createdBefore: opts.range?.createdBefore,
    });
    for (const a of res.assets) {
      if (keep(a) && !opts.skip?.has(a.id)) out.push(toLib(a));
    }
    cursor = res.endCursor || cursor;
    hasMore = res.hasNextPage;
  }
  return { assets: out, cursor, hasMore };
}

/** The recent strip: the newest ~30, screenshots excluded. */
export async function fetchRecent(count = 30): Promise<LibAsset[]> {
  return (await fetchFiltered({ want: count })).assets.slice(0, count);
}

/** One page of the grid for a source. Shuffle is a sample, not a feed: it returns everything at once with hasMore false. */
export async function fetchSourcePage(source: PickerSource, after: string | null, used: ReadonlySet<string>): Promise<Page> {
  switch (source.kind) {
    case 'new': return fetchFiltered({ after, want: PAGE, skip: used });
    case 'favorites':
      if (!source.albumId) return { assets: [], cursor: null, hasMore: false };
      return fetchFiltered({ album: source.albumId, after, want: PAGE });
    case 'album': return fetchFiltered({ album: source.albumId, after, want: PAGE });
    case 'shuffle': return { assets: await sampleLastYear(), cursor: null, hasMore: false };
  }
}

/**
 * A random sample from the last 12 months without loading the library: ten random
 * one-week windows, one small query each, then sample the pooled results. Memory
 * and cost are bounded by SHUFFLE_WINDOWS * 40 assets however large the library.
 * A sparse library (few photos in the chosen weeks) falls back to one query over
 * the whole year.
 */
export async function sampleLastYear(now = Date.now(), rng: () => number = Math.random): Promise<LibAsset[]> {
  const windows = randomWindows(now, rng, SHUFFLE_WINDOWS, 7);
  const pages = await Promise.all(windows.map((w) =>
    MediaLibrary.getAssetsAsync({
      first: 40, mediaType: 'photo', sortBy: [['creationTime', false]],
      createdAfter: w.after, createdBefore: w.before,
    }).catch(() => null)));
  let pool = pages.flatMap((p) => (p ? p.assets.filter(keep).map(toLib) : []));
  if (pool.length < 12) {
    const res = await MediaLibrary.getAssetsAsync({
      first: 150, mediaType: 'photo', sortBy: [['creationTime', false]], createdAfter: now - YEAR_MS,
    });
    pool = pool.concat(res.assets.filter(keep).map(toLib));
  }
  return sampleDistinct(pool, SHUFFLE_TARGET, rng, (a) => a.id);
}

// iOS smart albums are only identifiable by their (localised) title here:
// expo-media-library does not expose PHAssetCollectionSubtype.
const FAVORITES_TITLES = new Set([
  'favorites', 'favourites', 'favoriten', 'favoris', 'favoritos', 'preferiti', 'favorieten',
  'お気に入り', '个人收藏', '個人收藏', '最愛', '즐겨찾기', 'избранное',
].map((s) => s.toLowerCase()));

export interface AlbumInfo { id: string; title: string; count: number }

/** User albums (smart albums excluded) with photos, biggest first, plus the Favorites smart album id if one is found. */
export async function loadAlbums(): Promise<{ albums: AlbumInfo[]; favoritesId: string | null }> {
  try {
    const all = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
    const fav = all.find((a) => a.type === 'smartAlbum' && FAVORITES_TITLES.has(a.title.trim().toLowerCase()));
    const albums = all
      .filter((a) => a.type !== 'smartAlbum' && a.type !== 'moment' && a.assetCount > 0)
      .map((a) => ({ id: a.id, title: a.title, count: a.assetCount }))
      .sort((a, b) => b.count - a.count);
    return { albums, favoritesId: fav && fav.assetCount > 0 ? fav.id : null };
  } catch {
    return { albums: [], favoritesId: null };
  }
}

/** iOS limited access: let the person add more photos to what the app can see. */
export async function allowMorePhotos(): Promise<void> {
  try { await MediaLibrary.presentPermissionsPickerAsync(['photo']); } catch { /* not limited / unsupported: nothing to do */ }
}

/**
 * The same {uri, width, height, assetId} the system picker gives. A ph:// uri is
 * not readable by the scan flow, so resolve the local file, then re-encode as
 * JPEG: that applies EXIF orientation (PHAsset width/height are pre-rotation),
 * turns HEIC into what the pipeline already receives from ImagePicker, and
 * yields the true pixel size.
 */
export async function resolvePhoto(a: LibAsset): Promise<PickedPhoto> {
  const info = await MediaLibrary.getAssetInfoAsync(a.id);
  const local = info.localUri ?? info.uri;
  try {
    const rendered = await ImageManipulator.manipulate(local).renderAsync();
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 1 });
    return { uri: saved.uri, width: saved.width, height: saved.height, assetId: a.id };
  } catch {
    return { uri: local, width: info.width || a.width, height: info.height || a.height, assetId: a.id };
  }
}
