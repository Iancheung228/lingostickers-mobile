# Photo picker (branch `feature/photo-picker`)

Built from `feature/calendar-reimagine`. Cloud run: **nothing here has been run on a device or Simulator.** Typecheck, lint (0 errors) and `npm test` (169 pass) are green.

## Native / build implications — **no new build needed**

`expo-media-library` is already in `app.json` plugins (with `isAccessMediaLocationEnabled`), is in `package.json` (~18.2.1) and was already imported by `lib/photoMetadata.ts`, `lib/exportSticker.ts`, `lib/avatars.ts` and two components. `expo-image` (thumbnails), `expo-image-manipulator` and AsyncStorage are likewise already installed. I added **no** dependency and **no** config plugin. A dev build made from this branch's base already contains everything; JS hot-reloads. I did not run `eas`.

Caveat to confirm: the Simulator dev build must itself have been built after `expo-media-library` was added to the plugins (the `fingerprint` runtime policy would flag a mismatch).

## What changed

**Recent strip** (`components/RecentPhotosStrip.tsx`): newest 30 photos, screenshots excluded, above the Gallery/shutter row. Tap toggles (numbered badge in tap order), max `BATCH_MAX` (5). Header line shows "Recent photos" / "N selected" / "Up to 5 at a time" and, once something is selected, **Clear** and **Use 1 photo / Make N stickers**. A "See all" tile ends the row. Thumbs have 8pt gaps and only vertical hitSlop (lesson 9).

**Picker sheet** (`components/PhotoPickerModal.tsx`, pageSheet): chips **New** (default), **Favorites**, **Albums** (list -> album grid), **Shuffle: past year** (+ Reshuffle). Paged 60 at a time, 4-column grid, expo-image thumbnails sized to the cell. Footer: **All Photos** (falls back to the system picker) and the confirm button. Screenshots are hidden in every source.

**Hand-off**: 1 photo -> existing single flow (extractor); 2-5 -> `batch.offer` -> existing intro. `lib/photoLibrary.ts resolvePhoto` turns the asset into `{uri, width, height, assetId}`: `getAssetInfoAsync` -> `localUri` -> re-encoded to JPEG with ImageManipulator (applies EXIF rotation, converts HEIC, gives true pixel size, matches what ImagePicker returns).

**Permissions**: Gallery still runs the existing `requestMediaLibraryPermissionsAsync` + `alertPermissionDenied` (denied -> explanation + Settings). Access is then read with `MediaLibrary.getPermissionsAsync`. Full or limited -> our picker; otherwise the system picker as before. Limited access shows a banner with **Allow more photos** (`presentPermissionsPickerAsync`). The strip is hidden unless access is full/limited.

**Used-photo tracking ("New")**: `lib/usedAssets.ts` (pure) + `lib/usedAssetsStore.ts` (AsyncStorage key `tabi.used-asset-ids`, newest 5000 ids, writes serialised). Written when a card from an imported asset is **saved**: `handleAdd` in scan.tsx (single) and `useBatchCreate.add` (batch; `payload.photo.assetId`). **Per-device**: not synced, empty on a new phone or reinstall, doesn't know about stickers made before this shipped (those photos will show as New). Camera shots have no assetId and aren't tracked. No DB change.

**Shuffle** (`sampleLastYear`): 10 random 7-day windows in the last 365 days, one `getAssetsAsync` (max 40) per window using `createdAfter/createdBefore`, pooled, de-duplicated, 36 sampled. Never pages the library; memory/cost bounded. Sparse library (<12 found) falls back to one query of the past year. `getAssetsAsync` has no offset, only a cursor, which is why random windows rather than random indices.

**Selection state** lives in `hooks/usePhotoLibrary.ts` in the Scan screen, shared by strip and sheet (lessons 1, 10): swiping the pageSheet away loses nothing.

### scan.tsx footprint (another branch edits this file)
Imports; 3 state lines; `handleImportPhoto` split into `acceptPhotos` / `launchSystemPicker` (the old system-picker body, moved unchanged in behaviour) + new `openPicker`, `confirmLibrarySelection`, `pickerToSystem`, `useFocusEffect` refresh; one `markAssetsUsed` line in `handleAdd`; `<RecentPhotosStrip>` in the controls view and `<PhotoPickerModal>` before `<PhotoExtractor>`. `DiscoveryReveal` untouched. Expect a textual conflict around `handleImportPhoto` if wrong-word-fix touched it.

## Files
New: `lib/usedAssets.ts`, `lib/usedAssetsStore.ts`, `lib/photoSelection.ts`, `lib/photoLibrary.ts`, `hooks/usePhotoLibrary.ts`, `components/PhotoThumb.tsx`, `components/RecentPhotosStrip.tsx`, `components/PhotoPickerModal.tsx`, `scripts/test-photo-picker.mts` (wired into `npm test`), `.maestro/agent/photo-picker.yaml`.
Edited: `app/(tabs)/scan.tsx`, `hooks/useBatchCreate.ts` (1 line + import), `package.json` (test script).

## Unverified (needs a Simulator / device)
- Everything visual: strip spacing against the shutter row on small phones, dark mode, Dynamic Type.
- expo-image rendering `ph://` thumbnails at cell size (it sets a thumbnail pixel size from the view; I read the source, didn't run it).
- **Favorites**: expo-media-library doesn't expose the smart-album subtype, so the Favorites album is found by (localised) title from a list in `photoLibrary.ts` (en, de, fr, es, it, nl, ja, zh-Hans/Hant, ko, ru). On another locale the chip is simply hidden. Using the smart album id as `album` in `getAssetsAsync` is expected to work (id lookup) but untested.
- Screenshot detection relies on `asset.mediaSubtypes` containing `screenshot` (iOS). The `mediaSubtypes` query option is include-only, so exclusion is client-side after fetching.
- Limited-access flow and `presentPermissionsPickerAsync`.
- 450 ms wait between dismissing the sheet and presenting the extractor/intro (same idea as BatchIntro's 600 ms); may need tuning.
- First run: until the user has granted photo access once (tap Gallery), the strip is hidden, by design.
- Resolving 5 full-res photos (JPEG re-encode) before the batch intro: a short delay with the confirm button disabled; no spinner on the strip's confirm.
- Not checked: Android.

## Simulator test steps
1. `env -u CI npx expo start --dev-client`; boot the Simulator with the Tabi Stickers dev build.
2. Seed photos: `xcrun simctl addmedia booted scripts/fixtures/.cache/{bicycle,cat_mug,breakfast}.jpg`. For Shuffle to show something, seed photos whose creation date is within the last year (simctl uses the file's metadata; set `DateTimeOriginal` with exiftool to spread them out). For a screenshot: `xcrun simctl io booted screenshot x.png` then `addmedia x.png`; it should be absent everywhere.
3. Sign in, open Scan, tap **Gallery** once and Allow (full). Relaunch/refocus: the strip appears.
4. Tap 2 photos: badges 1, 2; button reads "Make 2 stickers"; tap -> batch intro; Cancel.
5. Tap 1 photo -> "Use 1 photo" -> the single extractor opens.
6. Try a 6th selection: header says "Up to 5 at a time", nothing added.
7. **See all** (and Gallery): sheet opens on **New**; chips switch; Albums -> album -> back; Shuffle -> Reshuffle changes the set; **All Photos** opens the iOS picker; Cancel; swipe the sheet down with 2 selected: reopen, selection kept.
8. After saving a card from a photo, reopen the sheet: that photo is gone from New (still in other tabs with a check mark).
9. Settings > Tabi > Photos > Limited: banner + Allow more photos. Denied: Gallery shows the existing alert with Open Settings and no strip.
10. `harness/qa.sh .maestro/agent/photo-picker.yaml` (flow made no AI calls).

## Owner decisions
- "New" is per-device and starts empty: OK, or worth adding a `source_asset_id` column later (would also work across devices)?
- Strip is not filtered by "New" (shows the 30 newest, used ones carry a small check). Should it hide used photos instead?
- Shuffle samples 10 random weeks, so a very busy week is as likely as a quiet one; fine for rediscovery, say if you want even-by-photo sampling (needs paging the year).
- Used-photo cap is 5000 ids (~200 KB).
