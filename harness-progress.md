
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
