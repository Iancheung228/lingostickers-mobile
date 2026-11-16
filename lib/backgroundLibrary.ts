// Pure helpers for the saved-backgrounds library (migration 048). No React
// Native or Supabase imports, so they run under `npm test`.

export interface SavedBackground {
  id: string;
  user_id: string;
  /// `${userId}/backgrounds/${id}.jpg`, the uncropped source.
  path: string;
  width: number | null;
  height: number | null;
  created_at: string;
}

export interface PickedPhoto {
  uri: string;
  width: number;
  height: number;
}

/// What the user chose in the background sheet. `photos` is a request to open
/// the system picker, which the caller runs after the sheet has left.
export type BackgroundChoice =
  | { kind: 'none' }
  | { kind: 'photos' }
  | { kind: 'saved'; saved: SavedBackground };

/// A background chosen but not yet cropped onto a board: what the New board
/// sheet hands to the board it creates.
export type StagedBackground =
  | { kind: 'saved'; saved: SavedBackground }
  | { kind: 'photo'; asset: PickedPhoto };

export const LIBRARY_THUMB_SIDE = 360;

/// Not a crypto UUID: Hermes has no global `crypto` (see lib/cutout.ts). The
/// shape is v4 so Postgres accepts it for the uuid column; unguessability is
/// not needed, the bucket's RLS scopes every object to its owner.
export function newBackgroundId(rand: () => number = Math.random): string {
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join('');
  const variant = (8 + Math.floor(rand() * 4)).toString(16);
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${variant}${hex(3)}-${hex(12)}`;
}

export function libraryPathFor(userId: string, id: string): string {
  return `${userId}/backgrounds/${id}.jpg`;
}

/// The grid thumbnail, beside the source (same convention as lib/thumbnails.ts
/// thumbPathFor, repeated here so this file stays dependency-free).
export function libraryThumbPathFor(path: string): string {
  return path.replace(/\.[a-z0-9]+$/i, '') + '.thumb.webp';
}

/// Every storage object a library entry owns.
export function libraryFilesFor(path: string): string[] {
  return [path, libraryThumbPathFor(path)];
}

export function isLibraryPath(userId: string, path: string): boolean {
  return path.startsWith(`${userId}/backgrounds/`);
}

/// Newest first, without mutating the input (the table's own index order is the
/// same, this keeps optimistic inserts in order too).
export function newestFirst<T extends { created_at: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
}
