# Board backgrounds: saved library and picker sheet

Branch `feature/board-backgrounds` (from `feature/calendar-reimagine`). Built in a
cloud run: no Simulator, no Supabase access. Nothing was applied, deployed or built.

## What changed

1. **Copy.** "Cover photo" is now "Background" everywhere on Boards: menu items
   "Add a background" / "Change background" / "Reposition background" /
   "Remove background", the undo toast, error toasts, the cropper title and its
   a11y labels. DB column names are unchanged. The Home mini-wall editor
   (`HomeWallEditor.tsx`) still says "cover photo"; it is a different surface
   (see decisions).
2. **Library.** Migration `048_saved_backgrounds.sql` creates
   `public.saved_backgrounds` (owner-only select/insert/delete RLS, index on
   `(user_id, created_at desc)`). Files: `{uid}/backgrounds/{id}.jpg` (source,
   long side <= 2048, same cap as the board source) and
   `{uid}/backgrounds/{id}.thumb.webp` (360px grid thumbnail, derived by
   convention like lesson 17). A photo is saved when its crop is confirmed on a
   board (not when merely picked), unless it came from the library or is a
   reposition. Saving is best effort and runs after the board is written.
3. **Picker sheet.** `components/BackgroundPickerSheet.tsx` on `BottomSheet`:
   "Choose from Photos" tile, "None" tile (only offered when the board has a
   background, or in New board once one is chosen), then saved backgrounds
   newest first. Empty library: just the two tiles and one line explaining
   where saved backgrounds appear. Choosing closes the sheet first and acts in
   `onClosed` (iOS drops a Modal presented while another is leaving).
   Choosing a saved one downloads the source and opens the existing
   `BackgroundCropper`, then the existing upload writes `board-{id}-background.jpg`,
   `board-{id}-background-source.jpg` and `background_crop`, exactly as before.
   Old app builds therefore render these boards unchanged. Dim slider is the
   existing one.
4. **Delete.** Long-press a saved tile, or the VoiceOver "Delete this saved
   background" custom action, shows a confirm. Boards keep their own copy
   (verified in `handleCropConfirm`: board paths are `board-{boardId}-...`,
   never library paths), so deleting cannot blank a board. As a belt-and-braces
   guard `remove()` still checks `boards.background_path = path` and keeps the
   file if anything references it.
5. **Entry points.** Board "..." menu item opens the sheet. `NewBoardSheet` has
   a "Background" row (thumbnail, None/Chosen); the choice is staged and
   cropped on the new board's own canvas when it opens (the crop needs the
   canvas size, which doesn't exist before the board). The sticker picker
   auto-open waits until that crop finishes or is cancelled.
6. **Shared state (lesson 1).** `SavedBackgroundsProvider` in `app/_layout.tsx`;
   `useSavedBackgrounds()` is read by the sheet and New board sheet.
   Thumbnails: the path signed, loaded and used as `cacheKey` is the same
   (`libraryThumbPathFor(path)`), lesson 17. A row exists only if both files
   uploaded, so a tile never needs a full-size fallback.

## Files

- New: `supabase/migrations/048_saved_backgrounds.sql`, `lib/backgroundLibrary.ts`,
  `lib/pickBackgroundPhoto.ts`, `hooks/useSavedBackgrounds.tsx`,
  `components/BackgroundPickerSheet.tsx`, `scripts/test-background-library.mts`
  (added to `npm test`), `.maestro/agent/board-backgrounds.yaml`, this doc.
- Edited: `components/BoardCarouselPage.tsx`, `components/NewBoardSheet.tsx`,
  `components/BackgroundCropper.tsx` (copy), `app/(tabs)/wall.tsx`,
  `app/_layout.tsx`, `package.json` (test list).

## Migration: apply to STAGING only

```
scripts/deploy.sh staging db
```
(RELEASING.md, "Backend changes"). It is additive: new table and policies, nothing
existing altered, so it is safe for released app builds. Do not run
`scripts/deploy.sh production ...` until staging QA passes and you decide to ship;
that is your call per lesson 18.

## RLS reasoning

- Table: three policies, all `user_id = (select auth.uid())`; insert uses
  `WITH CHECK` so a user can't write rows for someone else. No update policy
  (rows are immutable); no policy for anon.
- Storage: `046_storage_policies_in_repo.sql` scopes `sticker-images` to
  `auth.uid()::text = (storage.foldername(name))[1]`. For `{uid}/backgrounds/x.jpg`
  `foldername` is `{uid, backgrounds}`, so element 1 is the uid: select, insert,
  update and delete are already allowed for the owner and nobody else. No storage
  policy change.
- A client could insert a row whose `path` points at another user's file; that
  only produces a tile that never loads for them (signing is RLS-gated), and
  delete only removes files in their own folder. No cross-user exposure.

## Verified here

`npm run typecheck`, `npm run lint` (0 errors; pre-existing warnings only),
`npm test` (pure helpers: id shape, path/thumbnail convention, `isLibraryPath`,
ordering).

## Unverified (needs the Simulator / staging)

- The migration has never been run (no Postgres here).
- All UI: layout of the 3-column grid, dark mode, Reduce Motion.
- A Modal opening over `NewBoardSheet`'s Modal (the Background row), and the
  system photo picker / cropper after the sheet closes: timing on iOS.
- Long-press vs tap on tiles, and the VoiceOver custom action.
- WebP thumbnail via `expo-image-manipulator` on device (same call as
  `lib/thumbnails.ts`, which already ships).
- `File.downloadFileAsync` of a library source, then crop.
- The Maestro flow was written, not run; it stops before the system picker.

## Simulator test steps (staging QA account)

1. Boards, open a board, "..." > "Add a background" > sheet shows
   "Choose from Photos" and the empty-library line (no None tile).
2. Choose from Photos, pick, crop, confirm. Board shows it. Re-open the sheet:
   the photo is a saved tile; "None" now appears.
3. Make a second board, "Add a background", tap the saved tile: crop opens on
   that photo, confirm, board shows it. No new library tile appears.
4. Long-press the saved tile, Delete. Tile disappears; both boards still show
   their background. Check Storage: `{uid}/backgrounds/*` gone, `board-*` intact.
5. New board: Background row > pick saved > Create board: crop opens on the new
   board, then the sticker picker.
6. "None" in the sheet removes the background with the undo toast.
7. Dark mode, VoiceOver delete action, Reduce Motion.
8. `harness/qa.sh .maestro/agent/board-backgrounds.yaml`.

## Owner decisions

- **Home wall editor copy**: still "cover photo". Rename too, or leave? (It also
  does not use the library.)
- **Existing board backgrounds** are not back-filled into the library; they are
  added only when a photo is next picked (or kept as-is). A backfill needs the
  sources, which only exist for backgrounds saved after migration 032.
- **No cap** on library size. Each entry is roughly 1MB + a small thumbnail;
  say if you want a limit (e.g. 30).
- **Library dedupe**: the same photo picked twice saves twice.
- "None" is hidden when a board has no background (nothing to clear) and in the
  empty New board row; say if you want it always visible.
- An extra upload: the source goes to storage twice (board source + library
  copy). Could use server-side `storage.copy` later.
