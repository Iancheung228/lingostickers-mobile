# Tabi Stickers: product inventory (code-grounded)

Repo: `/Users/school/lingostickers-mobile/lingostickers-mobile` · HEAD `59f753c` (2026-10-29) · 82 commits, Jun 13 to Oct 29 2026.
Expo SDK 54, RN 0.81, expo-router 6, Reanimated 4, Supabase. iOS only in practice (`supportsTablet: false`; native cutout module is `platforms: ["ios"]`; no Android EAS profile in use).
Method: read the routes, components, hooks, lib, migrations and edge functions, and grepped for wiring. Nothing was run on a device. Claims about runtime config (secrets, deployed state) are inferred from the code defaults and are flagged where that applies.

---

## 0. Navigation map

Root `app/_layout.tsx`: GestureHandlerRoot → `AuthProvider → ProfileProvider → FriendsProvider → ChallengesProvider`. Also: ErrorBoundary crash screen (:37), font loading with a fallback when fonts fail (:62), clearing the badge when the app comes to the foreground (:84), auth deep links for password recovery (:96), the auth redirect guard (:112), push-token sync and pending-avatar flush on session (:139), and cold-start notification-tap routing via `useLastNotificationResponse` → Friends (:165).

Floating rose pill tab bar (`app/(tabs)/_layout.tsx`), labels hidden, 5 tabs:
`collection` (BookOpen, the home screen) · `calendar` · **`scan`** (raised deep-rose CTA) · `wall` (titled "Boards") · `friends` (badge = pending challenges + incoming requests).
Stack routes outside the tabs: `profile` (gear `SettingsButton` on each tab), `day/[date]`.

---

## 1. Features by screen

### 1a. Auth and onboarding — `app/(auth)/*`
- **Sign-up** `sign-up.tsx` (397 lines): username (live availability check via `hooks/useUsernameAvailability.ts`), email, password (`components/PasswordField.tsx` with a reveal toggle), learning-language pick (migration 039 `signup_language`), optional avatar. The avatar is queued in `lib/pendingAvatar.ts` and uploaded on the first session.
- **Sign-in**, **check-email** (email confirmation), **forgot-password**, **reset-password**. The reset uses Universal Links to the domain, `docs/reset-password.html`, and token_hash verification (`lib/deepLinks.ts`). Recovery mode has an escape hatch.
- `components/AuthIntro.tsx` is the branded intro on the auth screens. `CozyBackground` (an illustrated moon/hills/trees scene from `components/illustrations/BackgroundScene.tsx`) appears **only** on forgot/reset password.
- **No post-signup onboarding/tutorial.** The only coach mark in the app is `useCoachMark('board-drag')` in `BoardCarouselPage.tsx:116`. A new user lands on an empty Collection that says "Tap the Scan tab to discover your first word!"

### 1b. Scan — `app/(tabs)/scan.tsx` (1149 lines)
- **AI consent gate** (`components/AiConsentGate.tsx`, `lib/aiConsent.ts`). Shown before the camera on first use. It discloses Google, Replicate and remove.bg. Stored in **AsyncStorage per user per device** (`aiConsent:v1:`), not on the server, and there is no way to revoke it.
- Camera: 3:4 viewfinder, rule-of-thirds grid, pinch zoom with a % pill, tap to focus, torch, and gallery import (`ImagePicker`). Copy: "What did you find? / Take a photo to learn!"
- **Live capture skips the selection step** (`handleCapture` :552). It crops to 3:4 and sends a whole-frame selection to segmentation, which picks the dominant object.
- **Gallery import** opens `components/PhotoExtractor.tsx`, which has two modes (`ToolModeSwitch`): a **box** (`CropBoxOverlay`, defaults to the whole photo) or a **lasso** (`LassoOverlay`, with scissors drawn at the tip). The imported photo's own EXIF date and GPS are used (`lib/photoMetadata.ts`). A live capture uses the current GPS instead (`lib/location.ts`).
- **Cutout pipeline** (`lib/cutout.ts`, `modules/subject-cutout/`):
  1. On device: Apple Vision `VNGenerateForegroundInstanceMaskRequest` (iOS 17+; the podspec floor is 15.1, so iOS 15/16 gets `isAvailable() = false`). The Swift side covers instance selection by lasso/box scoring (`SubjectSegmenter.swift`), lasso matting (`LassoMatter.swift`), a fast guided-filter matte refinement at 1/4 scale (`MatteRefiner.swift`), and border and shadow styling (`StickerStyler.swift`). The gate thresholds live in TS (`GATE`, cutout.ts:51). It retries on the full photo when the crop finds nothing, and falls back to a cut from the lasso polygon itself.
  2. The device result is uploaded to `sticker-images/{uid}/…` and passed as `precutImagePath`. The server skips background removal.
  3. Server fallback in `create-sticker`: **Replicate `cjwbw/rembg`** (alpha matting, `Prefer: wait=10`) → **remove.bg** → otherwise the raw JPEG plus a `bgIssue` banner. The server adds a pure-JS border (UPNG).
  - Parallel legs: memory photo (1280 px), context photo for the LLM, and the cutout. All are timed.
- `components/ScanProgress.tsx` names the stage being worked on. `components/GhostCutoutReveal.tsx` crossfades the cropped photo into the cutout, then hands off to:
- **DiscoveryReveal** (`components/DiscoveryReveal.tsx`, "New Discovery"): cutout, word, reading, TTS, sentence plus `SentenceGloss`, insight, and an inline edit of word and English sentence that re-translates through `translate-word` / `translate-sentence`. Buttons: **Add to Collection**, **Retry Extraction** (reopens box/lasso on the same photo; the earlier draft comes back if cancelled), **Discard** (confirm, then deletes storage).
- Save is a client-side `insert` into `stickers` (`handleAdd` :646). A trigger stamps `origin_author_id` (042).

### 1c. AI card generation — `supabase/functions/create-sticker` + `_shared/`
- One vision call per scan, with the crop and scene images. Provider adapter in `_shared/llm/`: **Gemini `gemini-3.1-flash-lite`** primary (thinking budget 0, env-tunable), **Groq `qwen/qwen3.6-27b`** fallback (on unless `LLM_FALLBACK=off`). Up to 3 attempts, backoff capped at 6 s, no failover on `invalid` or `blocked`.
- Fields come from one registry (`_shared/cardSchema.ts`), and their order is enforced: `word, translation, part_of_speech, reading, category, sentence, sentence_translation, gloss, grammar_key, sentence_insight`. `part_of_speech` and `category` are JSON-schema enums.
- **Reading**: fr = English phonetic respelling ("luh ka-fay"), ja = romaji with macrons, yue = Jyutping with tone numbers.
- **Syllabus** `_shared/syllabus.ts`: 65 grammar targets (fr 22 / ja 22 / yue 21) in 3 CEFR-ish bands. The band comes from the collection size (`bandFor`: <15 / <50 / 50+). The prompt offers two targets, and the model's choice comes back as `grammar_key`. `_shared/learner.ts` reads the last 40 rows and avoids repeating a key from the last 6.
- **Gloss** (`_shared/gloss.ts`, `lib/gloss.ts`): word-by-word segmentation. It is checked against the sentence on the server and again at render, and the whole gloss is dropped if it doesn't reconstruct the sentence.
- **Insight**: a single teaching note about the chosen structure.
- Other model calls: `translate-word`, `translate-sentence`, and `send-challenge` (accepted synonyms for a challenge).
- Test and lab scripts: `npm test` (`scripts/test-sentence-logic.mts`, `scripts/test-llm.mts`), `test:live`, `prompt`, and `scripts/prompt-lab.mts`.

### 1d. Collection (home) — `app/(tabs)/collection.tsx`
Top to bottom, as one FlatList:
- `HomeHeader`: finds today against `DAILY_GOAL = 5`, due count with estimated minutes, a **Start review** CTA, and a search icon.
- `MiniStickerWall`: an arrangeable "home wall" of cutouts on a user background photo. Editing happens in `HomeWallEditor`, stored in `home_stickers` (031), with `BackgroundCropper`.
- `FeedRail`: the 12 most recent finds, with a language filter chip row and the author avatar (`useStickerAuthors`).
- `LatestStickers`: a recent list with a sort-cycle control and voice-note play.
- 2-column grid of `StickerCard` (heart, speak, play own voice). Category chips (Kitchen/Animals/Study/Nature/Other), sort (tap to cycle, long-press for a menu: Latest/Oldest/Recently added), and a favourites-only filter.
- **Search** (`collection.tsx` ~:115): client-side over word, translation, reading and notes. It does *not* search the sentence or `location_label`.
- Pull to refresh. Separate error and empty states.
- Tapping a sticker opens **StudyCard in `browse` mode**: no grading, and the schedule is untouched.

### 1e. Study / SRS — `components/StudyCard.tsx` (1485 lines), `components/StudySessionHost.tsx`, `lib/review.ts`
- **Front** (`FrontFace` :890): the photo or cutout with the answer hidden (VoiceOver too), a hint, a "what happened that day" note, and WHERE/WHEN footer fields.
- **Back** (`BackFace` :1031): fields WORD, SAY IT (reading, TTS speaker, play own take, **press-and-hold mic** recording via expo-audio with metering and trim, `lib/audioTrim.ts`), meaning and part of speech, IN USE (sentence, gloss, translation, insight), and a "SHOT AT" footer.
- In browse mode a pencil on each field opens `FieldEditor` (a `BottomSheet`), with an optional "regenerate word and reading to match". Changing the sentence clears the gloss, insight and grammar_key.
- Header actions: Share (`expo-sharing`), Save to Photos (`expo-media-library`) via `lib/exportSticker.ts`, Delete.
- **Grading** (review mode): Again/Hard/Good/Easy on a red→sand→pale-green→green ramp, each with a preview of its interval.
- **Scheduler** `lib/review.ts`: SM-2 plus Anki-style learning steps (1 m, 10 m), a relearning step (10 m), graduating at 1 d, Easy at 4 d. Review cards are due at local midnight. Migrations 028, 029 and 040 add `due_at` and `learning_step`. New cards rest 1 day (`NEW_CARD_REST_DAYS`).
- `StudySessionHost` re-queues anything due within `LEARN_AHEAD_MIN = 20`, carries the patch forward, and ends with `ReviewSummary`.
- Review is **one direction only: image to recall**. There is no typed production, listening or cloze mode.
- Entry points: HomeHeader "Start review" (all due cards, optionally filtered by language) and the Calendar review CTA.

### 1f. Calendar — `app/(tabs)/calendar.tsx` ("The long view"), `app/day/[date].tsx`
- Segmented **Finds | Reviews** month grid. Finds shows the cutout/day icon of what was found that day. Reviews shows due-count rings and marks the week's heaviest day.
- `WeekActivityTracker`: a week-ahead or activity bar strip.
- Month paging, a review CTA that launches `StudySessionHost`, and a "COULDN'T LOAD · TAP TO RETRY" state.
- Tapping a day opens `day/[date]`: a grid of StickerCards (with favourite toggle) for that local day, opening StudyCard on tap.

### 1g. Boards (the `wall` tab) — `app/(tabs)/wall.tsx`, `BoardCarouselPage.tsx`, `BoardCanvas.tsx`, `BoardRail.tsx`, `BoardMenu.tsx`, `NewBoardSheet.tsx`, `hooks/useBoards.ts`
- Named boards in a horizontal carousel with a thumbnail rail. Created through `NewBoardSheet`.
- Stickers are added from `StickerPickerModal`, dragged freely on a canvas (positions in `board_stickers`), and removed by dragging to a trash zone. `lib/boardLayout.ts` auto-lays them out with seeded-random scatter.
- Board menu popover: rename, tidy up, cover/background photo (crop plus a 0–100 dim slider, migrations 025, 026 and 032), delete.
- Background: a user photo or a default **cork** (`CorkBackground` inside `WallBackground`). Display style is `framed` or `cutout`, set in Profile.
- Tapping a sticker opens StudyCard (with `onRemoveFromBoard`).

### 1h. Friends + challenges — `app/(tabs)/friends.tsx`, `hooks/useFriends.ts`, `hooks/useChallenges.ts`
- Sections: an inbox (incoming requests and pending challenges, `InboxRow` accept/decline), a friend rail (`FriendRail`), and a feed of solved challenges (`SolvedRow`). `FriendsEmpty` handles the first run ("Learn alongside someone").
- `FriendSearch`: username search (debounced, results ordered by request sequence) with incoming and sent request lists. Uses the `send-friend-request` and `respond-friend-request` edge functions, which send Expo push.
- `FriendProfile`: "Friends since", **Send a Challenge** (`StickerPickerModal` → `send-challenge`), Remove friend, Report, Block.
- **Challenge** (`ChallengeScreen`): the receiver sees the friend's photo (via `get-challenge-image`, a service-role signed URL), the English meaning, and the sentence with the word blanked. They get a letter count and an optional "Show first letter" hint, then type the answer. Answers are normalized for case and diacritics and checked against synonyms. Retries are unlimited and attempts are counted.
- **Win** (`submit-challenge-answer`): the sticker files are copied into the winner's folder and a new row is created (`source='challenge'`, `origin_author_id` = sender). `ChallengeSuccess` ("You got it!") flips to show the memory photo.
- There is no way to browse a friend's collection. Interaction between friends is limited to challenges.

### 1i. Profile — `app/profile.tsx`
- Avatar (pick, replace, remove), stats (Captured, Favorites).
- LEARNING LANGUAGE (fr/ja/yue). This sets the default for new scans. The collection mixes languages and filters by them.
- WALL DISPLAY (framed/cutout). CUTOUT BORDER (shadow/outline/none), shown only when the display is cutout.
- SAFETY: Blocked accounts (`BlockedAccounts`), Report a problem (mailto).
- ABOUT: Scanner row with an ON DEVICE / CLOUD badge, and a Privacy link (`docs/privacy.html`).
- Log out. Delete account, with a double confirm, through the `delete-account` function, which purges storage.
- **No notification toggle, no AI-consent revoke, no data export, no daily-goal setting.**

### 1j. Cross-cutting
- **Notifications** (`lib/notifications.ts`): **remote push only**, for friend request, friend accepted and challenge. Permission is asked in context (when accepting a friend or sending a challenge), not at sign-in. The badge is cleared on foreground. There are **no local review reminders**: no `scheduleNotificationAsync` anywhere.
- **TTS**: on-device `expo-speech` (`lib/speech.ts`, at a slower learning rate).
- **Voice notes**: per sticker, in the `sticker-voice-notes` path, with trim (012, 016). Playback through `useTrimmedVoicePlayback`.
- **Moderation**: `user_blocks`, `content_reports` (with preserved evidence, 037), a `moderation_queue` view (038), and `ReportSheet` with a draft that survives a swipe-dismiss. There is no in-app admin. Review happens in the Supabase dashboard.
- **Sharing/export**: a single sticker can be shared or saved to Photos. There is no collection export or deck export.

---

## 2. Core loop today

**Capture (returning user, live camera): 3 taps.**
1. Tap the Scan tab (1).
2. *(First time only: accept AI consent (1) and grant camera (1 + system).)*
3. Tap the shutter (1). The progress stages play while the on-device cutout, memory photo and context photo run in parallel. Then `create-sticker` makes the vision LLM call (plus Replicate if the device declined). Code comments put the full scan at "~10-20s" in the worst case; the Gemini migration notes give vocab p50 at ~2.3 s.
4. The ghost crossfade plays, then DiscoveryReveal. Tap **Add to Collection** (1).
→ After saving, the user stays on the camera. **Nothing routes the user onward** (to the card, the collection or a board).

**Gallery import:** Scan → Gallery (1) → pick (1) → adjust box/lasso and tap Extract (1–2) → Add (1). That is 4–5 taps.

**Review: 1 + 2n taps.** On Collection (the home tab), tap **Start review** (1). For each card: tap to flip (1), then grade (1). The summary closes the session. A card saved today is **not due until tomorrow** (1-day rest), so the "learn" half of the loop starts the next day.

**Arrange:** Boards tab, open the picker, choose stickers, drag. This is a separate manual step with no prompt after capture.

**Social:** Friends → friend → Send a Challenge → pick a sticker (4 taps). The friend gets a push → types a guess → wins a copy.

**Where it is slow or leaky**
- The wait between shutter and reveal is network-bound, and a failure here is a full-screen `Alert` ("Scan failed" or "Daily limit reached").
- Each scan uses up 1 of **10 daily create-sticker quota** *before* any work is done. Retry Extraction and Discard still cost quota (`create-sticker/index.ts:88`).
- After Add, there is no "now study it / place it" handoff. The capture and study loops are only connected by the next day's due count.
- With no review reminders, a returning user's only external pull is a friend's push.
- An abandoned draft (the app is killed on DiscoveryReveal) leaves cutout and memory files in storage with no row pointing at them. Cleanup only exists for Discard and Retry.
- A new user gets no tutorial, no sample sticker, and an empty home screen whose wall, feed and rails all depend on having content.
- The daily goal (5 finds) is hard-coded, and there is no streak.

---

## 3. Languages and data model

**Languages:** `fr` French, `ja` Japanese, `yue` Cantonese (written colloquial, Traditional, Jyutping) in `lib/languages.ts`. The UI and teaching language is English only. There is no app localization.

**Tables:** `profiles`, `stickers`, `friendships`, `sticker_challenges`, `boards`, `board_stickers`, `home_stickers`, `push_tokens`, `api_usage`, `user_blocks`, `content_reports`, and the view `moderation_queue`. Storage bucket `sticker-images` is private and per-owner-folder. The avatars bucket is public.

**Sticker row** (`lib/types.ts`, from 42 migrations):
- identity and content: `id, user_id, language, word, reading, translation, part_of_speech, category(enum 5)`
- sentence: `sentence, sentence_translation, sentence_insight, sentence_gloss(jsonb), grammar_key`
- media: `image_path` (cutout PNG), `memory_photo_path` (≤1280 px full scene), `memory_photo_color`, `voice_note_path, voice_note_start_ms, voice_note_end_ms`
- story: `discovered_at, created_at, latitude, longitude, location_label`
- user: `is_favorite, notes`
- provenance: `source ('scan'|'challenge'), origin_author_id`
- SRS: `review_count, last_reviewed_at, ease_factor, interval_days, lapses, due_at, learning_step`

**Profile:** `username, avatar_path, target_language, wall_display_style, cutout_border_style, home_background_path, home_background_dim, home_wall_arranged`.

**Not stored:** a review log or history (only the current schedule state, so the "Reviews" calendar mode can only show what is due, not what was done); time-of-day; tags; any server-side record of AI consent.

---

## 4. Visual design system

- **Fonts:** Newsreader 400/500 (serif display and reading text) plus JetBrains Mono 500/700 (readings, stats, uppercase section labels). They are imported by subpath on purpose, to avoid bundling all 30 weights. CJK uses the system faces Hiragino Sans (ja) and PingFang HK (yue) on iOS (`wordFontFor` / `sentenceFontFor`).
- **Palette** (`constants/theme.ts`): warm cream page (`#FAF4EA`), dusty-rose band and tab pill (`#E4A0A1`), deep-rose CTA (`#9D4D51`), rose-brown headings, warm charcoal body text, sand accents, plus semantic error and success colours with "Deep" variants for white text. There are also radii, spacing (including a 12 px `ms` step), shadows tinted with the ink colour, and `chipBase`.
  - **Token naming has drifted:** `sky` is cream, `sage` is sand, and `skyDeep`, `blush` and `rust` overlap with each other and with `terra`. Several aliases share one hex value. Illustration-only tokens (`moonGold`, `hillGreen`, `treeTrunk`) survive for a single scene.
- **Backgrounds:** `CozyBackground` (an SVG night scene, only on 2 auth screens), `CorkBackground` (the default board), `WallBackground` (a user photo with crop and dim, or cork). The home band is a rose masthead that the wall and month cards overlap ("lift into").
- **Illustrations:** one SVG scene (`BackgroundScene.tsx`). Icons are Lucide throughout. There is no mascot and no custom empty-state art. The app icon is still pending (memory: "pick still pending").
- **Motion:** about 118 Reanimated/Animated references. Signature moments: the ghost-cutout crossfade, the 3D card flip, the gesture sheets (`BottomSheet`), the board drag with a growing trash zone, and the lasso scissors. **Haptics:** 51 calls across 17 files (tab press, capture, grade with a rigid feel for Again, success and error on save).
- **Designed vs default:** custom work covers the tab bar, the home masthead, the study card, the calendar (measured from a 430 pt mock), and DiscoveryReveal and the reveal. Defaults remain in system `Alert.alert` for every error and confirm (scan failure, delete, logout, block), RN `Modal` sort menu, `ActivityIndicator` spinners, and plain empty states.

---

## 5. Half-built, dead or inconsistent

- **ROADMAP not done:** Phase 4 manual tags and the time-of-day badge. The Story/chapters view was built and then **deleted** (2026-09-08). Phase 5b live sticker/video. Phase 6 search is **partly done** (client search exists but skips sentence and location, so ROADMAP's unchecked box is out of date). Phase 2 "reading as a real romanization" is not done for fr. Teochew is future work. ROADMAP still says target languages are "fr + ja", but yue is shipped.
- **Android:** an app.json android block exists, but there is no on-device cutout (server only), no build profile in use, and it is untested.
- **iOS 15/16:** the server cutout path only.
- **`profiles.home_background_dim`:** the column exists, but Collection passes `backgroundDim="none"`. Boards moved to a 0–100 per-board dim, and the home wall still uses the old enum.
- The `CUTOUT_DRY_RUN` flag is still in `lib/cutout.ts:82` (false), along with dev diagnostics badges.
- **Copy inconsistency:** StudyCard's front says "WHERE" and the back says "SHOT AT" for the same `location_label`. The tab is titled "Boards" but the route is `wall`. The repo, bundle ID and package name are "lingostickers" while the product is "Tabi Stickers".
- **TODO/FIXME:** none in app, components, hooks, lib, modules or functions.
- **harness/feature_list.json** is about test drivability, not product: six items (testIDs and a simulator cutout fixture), all with status `None` (not passed). The `harness/drivable` branch is checked out in a worktree. Maestro flows exist for sign-in and study grading only.
- Leftover branches: `dev`, `feature/block-and-report`, `feature/on-device-cutout`, `feature/photo-import-extraction`.
- `rembg-server/` (Fly.io) is mentioned in ROADMAP as parked. It is not present in the repo root listing.

---

## 6. Monetization and analytics

- **Monetization: absent.** No IAP, RevenueCat, paywall, subscription, "Pro" tier or ads. Version 1.0.0.
- **Analytics:** Aptabase (`lib/analytics.ts`, disabled if `EXPO_PUBLIC_APTABASE_APP_KEY` is unset). **Only 6 events exist:** `app_launched`, `cutout_local`, `cutout_escalated`, `cutout_upload_failed`, `sticker_shared`, `sticker_saved_to_photos`.
  - Nothing tracks sign-up, scan started, completed or failed, sticker saved, discard, retry, review started or completed, grades, friend added, challenge sent or won, or rate-limit hits. The funnel and retention can't be measured.
- `docs/privacy.html` has no mention of analytics or Aptabase.

---

## 7. Launch risks

1. **Undisclosed AI processor.** Groq is on by default as the LLM fallback (`_shared/llm/index.ts`, unless `LLM_FALLBACK=off` is set in prod; I did not check the deployed secret). It receives the user's photos, but it is **not** in the AI consent list (`lib/aiConsent.ts` AI_PROCESSORS) **nor** in `docs/privacy.html`. Groq's vision models are also Preview-grade.
2. **Analytics not in the privacy policy** (Aptabase). This is relevant to App Store privacy labels.
3. **AI cost exposure:** the cap is per user per day (create-sticker 10, translate-word 30, translate-sentence 30, send-challenge 30; env-overridable). It fails closed with a 503, which is good. **But there is no global or app-wide ceiling.** Spend grows linearly with accounts, and sign-up only needs a confirmed email. Per scan: one Gemini call, plus about $0.004 Replicate when the device declines (every iOS 15/16 user and every Android user).
4. **Quota UX:** 10 scans a day, with discards and retries counting. An enthusiastic first session can hit "Daily limit reached".
5. **Crash and memory risk areas:** full-resolution native image work (`MatteRefiner.swift`, `StickerStyler.swift`, `SubjectSegmenter.swift`, ~1,300 lines of Swift) running alongside an open camera session (skills.md §7). `StudyCard.tsx` at 1485 lines manages an audio recorder lifecycle, with comments about a released native object. `scan.tsx` at 1149 lines has many interleaved async states. A root ErrorBoundary exists, but there is **no crash reporting** (no Sentry or Crashlytics).
6. **Edge function timeouts:** a comment records an "EarlyDrop" runtime cutoff mid-request. Replicate's wait is shortened to 10 s to fail fast.
7. **Storage orphans** from abandoned drafts. They grow slowly and nothing garbage-collects them.
8. **AI consent is device-local.** A reinstall re-asks (harmless), and there is no server audit trail of consent.
9. **Testing:** unit tests cover only the prompt, gloss and LLM logic. No app unit tests, and only 2 Maestro flows. Vision cannot run on the Simulator (a fixture is pending in the harness).
10. **Content safety:** Gemini model-level filtering is deliberately lowered (`gemini.ts:40` comment). Moderation is user reports reviewed by hand in the dashboard.

---

## Cartographer's observations

- The *capture → card* half is deep and carefully engineered (promptable on-device cutout, a syllabus-steered sentence, a validated gloss). The *come back tomorrow* half has no hooks at all: no reminders, no streaks, and the daily goal is fixed at 5.
- A new sticker can't be studied until tomorrow, and the save doesn't hand off anywhere. The scan loop and the study loop touch only through the next day's due count.
- Three places show the "diary": the home wall, Boards and the calendar Finds view. They overlap, and all three need manual arranging or browsing. The Story/chapters view that delivered the scrapbook vision automatically was removed.
- The social layer is a single mechanic (guess-the-word challenges). You can't browse a friend's stickers, so "learn alongside someone" is thin.
- With 6 analytics events and no product events, nobody can currently answer "do people come back?"
- No monetization exists, while every scan costs money, capped only per user. A pricing or quota story is needed before any growth push.
- The consent and privacy disclosures are behind the code (Groq, Aptabase). This is the most concrete pre-submission risk found in this pass.
- The design language is consistent and warm (Newsreader/Mono, cream and rose), but errors and confirms fall back to system Alerts, and illustration is nearly absent (one auth-only scene).
- Review is recognition only (image → word). The voice recording and gloss assets aren't used for production or listening drills.
- Documentation (ROADMAP, skills.md, lessons.md) is unusually rich but partly stale (languages, Phase 6, Story view). The codebase is cleaner than its roadmap.
