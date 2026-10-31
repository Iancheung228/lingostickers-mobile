
## collection-search-visible
- collection.tsx: while searching, the search bar is pinned above the list (testIDs collection-search-input/-cancel) and hero / Latest finds / Latest stickers are hidden; Cancel restores them.
- QA: .maestro/agent/collection-search-visible.yaml PASS, full harness/qa.sh PASS. Screenshot 01 shows field with "pom", Cancel, "1 result", pomme card on screen; hero/Latest hidden.
- GAP: no software keyboard appeared in the screenshot (Simulator likely has hardware keyboard connected), so "above the keyboard" is only true structurally (bar is at top), not proven visually. Human: enable I/O > Keyboard > toggle Software Keyboard (Cmd+K) to confirm.

## signin-keyboard
- No app change: sign-in.tsx already had keyboardShouldPersistTaps="handled" in KeyboardAvoidingView. Added .maestro/agent/signin-keyboard.yaml (wrong password -> banner -> real password -> FOUND).
- QA: new flow PASS, full harness/qa.sh PASS. Shots 01-03 show Sign In visible with and without the error banner.
- GAP: no software keyboard was drawn (hardware keyboard connected), so "above the keyboard" is NOT proven; assertVisible doesn't check occlusion. Human: Simulator I/O > Keyboard > uncheck Connect Hardware Keyboard, rerun the flow, check shots 01-03.

## collection-search-visible (re-verify)
- No app change; code was already in place. QA status had gone stale, so reran: flow PASS, full harness/qa.sh PASS (5 flows). Shots 01 (search bar pinned, hero/Latest hidden) and 02 (Cancel restores) judged OK. No new bugs.

## auth-error-copy
- New lib/authErrors.ts (getAuthErrorMessage, isEmail). sign-in.tsx maps errors (incl. resend) to friendly copy and disables Sign In until the email looks like an address; forgot-password.tsx disables Send Reset Code until isEmail.
- QA: new flow .maestro/agent/auth-error-copy.yaml PASS, full harness/qa.sh PASS (6 flows). Shot 02 judged: 'notanemail' leaves Send Reset Code faded, subtitle unchanged. Shot 01 asserted by text only, not viewed.
- Surprising: iOS "Save Password?" sheet appears over sign-in/forgot-password; flows need an optional "Not Now". signin-keyboard.yaml asserted the old raw copy, updated to the friendly text. Resend-failure fallback copy says "signing in" (minor wording).

## username-format
- New lib/username.ts (isValidUsername, normalizeUsername, USERNAME_RULE). sign-up.tsx lowercases as typed, shows "Use 3–20 letters, numbers, _ or ." in the hint slot for invalid names, skips the availability check for them, and disables Create Account. DB CHECK constraint requested in HUMAN_REQUESTS.md.
- QA: new flow .maestro/agent/username-format.yaml PASS, full harness/qa.sh PASS (7 flows). Shot 01 judged: "a b!tabc" with the red rule hint, no "Username available".
- GAP: Create Account's disabled state is below the fold and not asserted/screenshotted; the positive case (valid name -> "Username available") isn't covered by a flow.

## profile-cleanup
- app/profile.tsx: header spacer no longer draws a circle (headerSpacer), copy says "sticker(s)", "App version X" row (testID profile-version, expo-constants) at bottom, Log Out icon/text in colors.error. components/FriendsEmpty.tsx: Find a friend CTA is white text/icon on rose.
- QA: new flow .maestro/agent/profile-cleanup.yaml PASS, full harness/qa.sh PASS (9 flows). Shots judged: profile top (no circle, "1 sticker"), bottom (red Log Out, "App version 1.0.0"), Friends empty (filled rose CTA).
- Note: flow branches on Find a friend visibility, so passes either way; colour judged by eye only. Commit also includes the pending StudyCard.tsx / hide-card-id.yaml changes already in the tree.

## collection-sort-menu
- collection.tsx: sort control is now a pill (testID collection-sort) showing the current mode; tap opens a BottomSheet ("Sort by", check on current) instead of cycling; labels renamed to "Photo date — newest/oldest", "Date added — newest". Old long-press Modal removed. Also commits the pending favourites-empty change (collection-filter-empty).
- QA: new flow .maestro/agent/collection-sort-menu.yaml PASS, full harness/qa.sh PASS (12 flows). Shots judged: default pill, sheet open with check/scrim/grabber, label updated after picking "Date added — newest".
- Surprising: the pill is wide and crowds the category chip row (third chip clipped). Acceptable but cramped; consider a shorter label or moving the control. LatestStickers header sort label still taps cycleSort (cycles, doesn't open sheet).

## scan-consent-layout
- components/AiConsentGate.tsx: footer padding is now insets.bottom + TAB_BAR_CLEARANCE (applied at render), more gap between Agree and Privacy link; optional agreeTestID/privacyTestID props, passed from scan.tsx (scan-consent-agree / scan-consent-privacy).
- QA: new flow .maestro/agent/scan-consent-layout.yaml PASS, full harness/qa.sh PASS (13 flows). Shot judged: Agree button and Privacy link both above the tab bar, ~23pt apart (estimated from image, not measured); Agree never tapped.
- Note: the Scan tab's accessibility label is "Scan a new sticker" (not "Scan"); flows must use that.

## tap-targets
- HomeHeader.tsx: testIDs home-search / home-settings (SettingsButton gained an optional testID prop), vertical slop 15 (=45pt tall). calendar.tsx: month arrows hitSlop 14 (=44x44) with testIDs calendar-prev-month / calendar-next-month. No visual change.
- QA: new flow .maestro/agent/tap-targets.yaml PASS, full harness/qa.sh PASS (14 flows). Shots judged: home and calendar layout unchanged; search opened from a tap 10pt left of the glyph, month changed from taps 10pt outside the arrows.
- GAP: home icons are only ~35pt wide (slop capped by the 12pt gap, skills #9), not 44; the 6pt inner slop is untested. Flow date assertions assume the simulator is in October 2026.

## a11y-selected-state
- app/profile.tsx: language, wall-style and border-style rows get accessibilityRole="button" + accessibilityState={{ selected: active }}. PhotoExtractor.tsx: header title has accessibilityLabel "Crop your sticker"; button keeps "Extract Sticker".
- QA: new flow .maestro/agent/a11y-selected-state.yaml PASS, full harness/qa.sh PASS (15 flows). Shots judged: profile with French row selected, crop screen with title + button, no extraction run.
- GAP: sim photo library has no seeded sticker, so flow picks the first library photo; selected assertion is a regex over language names (proves some row is selected, not the account's own).

## add-cards-confirmation
- components/Toast.tsx (new, "N cards added" + View, announces to VoiceOver, 4 s). scan.tsx shows it after handleAdd; View navigates to Collection. Toast is lifted to insets.bottom + TAB_BAR_CLEARANCE: first version sat under the floating tab bar and View tap hit the Boards tab.
- QA: new flow .maestro/agent/add-cards-confirmation.yaml PASS, full harness/qa.sh PASS (16 flows). Shots judged: toast above tab bar, Collection tab active after View.
- Surprising: toast overlaps the lower edge of the shutter and nearly touches "Flash Off". One full run failed with a transient "Extraction failed" alert (passed on rerun). Another loop session was using the same Simulator and harness/logs concurrently.

## iteration note (no feature)
- Orient showed tap-targets FAIL (screenshot: "Couldn't load your collection", a network error). No code changed. Fresh qa-tester rerun: tap-targets PASS (alone and in a full run); the full run's one failure was add-cards-confirmation ("Extraction failed" alert, the same transient as before), which PASSed on a single rerun.
- GAP: the last qa run was single-flow, so qa-status.json holds only add-cards-confirmation. The most recent full run was 15/16 with that flow the only failure. No app code changed since, and no full run was repeated.
- Both flaky failures are backend/network transients, not app bugs. Another unattended loop was running on the same Simulator/Metro, so collisions are possible. Next feature is new-card-found-today.

## new-card-found-today
- findsToday() (lib/review.ts), the Latest finds feed sort (collection.tsx) and the Latest stickers "time ago" (LatestStickers.tsx) now use created_at. discovered_at is untouched for calendar, Day screen, DAY n stamp and the scheduler.
- QA: new flow .maestro/agent/new-card-found-today.yaml PASS, full harness/qa.sh PASS (17 flows). Shots judged: "0 FOUND TODAY" before; after adding a 2018-dated photo, "1 FOUND TODAY" with the new card first in the rail and "just now" in Latest stickers.
- Surprising: header numbers are separate accessibility labels ("0","FOUND","TODAY"), so flow asserts them separately. The rail's card still shows the photo's weekday/date and DAY n (kept on purpose). A foreground full qa.sh exceeds the 600s limit; it needs to run in the background.

## type-a-word-entry
- No typed-word UI existed (only the create-card edge function), so added components/TypeWordSheet.tsx (input → create-card → preview → Add, saves source 'text', image_path null) and a "Type a word" link (testID scan-type-word) above the capture row in scan.tsx. Reuses the "N cards added" toast.
- QA: new flow .maestro/agent/type-a-word-entry.yaml PASS, full harness/qa.sh PASS (18 flows). Shots judged: preview for "chat" (discuter), Latest stickers showing it "just now". Lint fix (&apos;) after QA was copy-escape only.
- APP BUG (not fixed): picture-less cards show a spinner where the image goes in Latest stickers / Latest finds; should be a placeholder. Also Look up button a11y label "Look up word" vs visible "Look up". Keyboard-return submit not covered by the flow.
