# Pass B: interactions outside the core loop

Branch refine/production-polish. Contrast numbers are from `scratchpad/contrast.py` (WCAG 2.x). Nothing is device-verified. Pass A is taken as decided; **FLAG** marks what can't work as written.

1. **Offline:** neither `netinfo` nor `expo-network` is in `package.json` or `Podfile.lock`; both are native (rebuild, owner's yes). JS-only design in section 9.
2. **Banner "reviews will sync later"** promises a queue that doesn't exist; use the honest copy in section 9.
3. **Raised camera:** `_layout.tsx` says the bar clips its bounds; raising needs an overflow-visible wrapper with a 44pt+ hit area (pass C).
4. **Maestro 'FOUND':** keep the word "found" in the status line ("3 reviewed, 1 found today") or get re-approval.
5. **Delete-undo** delays the write ~5 s; a focus refetch would resurrect the card. Keep `pendingDeleteIds` in a Context provider, filter fetches through it, and flush on background.
6. **"Study ahead"** needs a query for not-yet-due cards; verify it exists in `lib/review`.

## 1. Home / Collection
- **Open:** cached list first (section 9), refetch on focus, never two fetches in flight (add a request ticket, lesson 11).
- **Due pill:** press scale .97 / 80 ms, `press` haptic, push study; at least 56pt tall.
- **Search:** always-visible field under the band, no autoFocus. In-memory filter on word, meaning and note, debounced 150 ms (no network, so no ticket). `returnKeyType="search"`, 44pt clear. No match: "No stickers match 'x'" and "Clear search".
- **Chips:** `select` haptic, 120 ms crossfade, selected chip scrolls into view. **Filter button** beside search opens a sheet: Sort (Newest, Oldest, Due soonest, A-Z), Show (All, Favourites, Due), Reset. A dot shows when non-default.
- **Long-press card (400 ms):** `press` haptic, action sheet (Favourite, Share, Add to board, Delete). The same actions are `accessibilityActions`.
- **Heart:** optimistic, `tap`; on failure revert plus error toast (today it reverts silently).
- **Pull to refresh:** keep the list on failure and toast; never swap a good list for the error page.
- **States.** First run (0 stickers): hide search/chips/filter; "Scan your first sticker. Point at anything around you. You get the word, a sentence and audio." with an "Open camera" button. Loading: six sand skeleton cards, 1.2 s pulse (static if reduced); spinner only for refetch. Filter empty: "Nothing in Kitchen yet" and "Show all". Cold error: keep today's copy and "Try again". Nothing due: "All caught up. Next card in 3 h" and "Study ahead".
- **Delete:** fade 160 ms, toast "Card deleted. Undo" (6 s).

## 2. Calendar and Day
- Tap a day with finds opens Day; reviews-only day shows "Reviewed N cards"; empty day shows an inline caption (no toast), `select` haptic. Swipe or chevrons change month (200 ms slide, crossfade if reduced).
- Cell: thumbnail, review dot, number; today gets a 2pt terra ring.
- Loading: chrome first, cells fill in. Error: inline "Try again". Empty month: "No stickers this month. Scan one."
- "Review N now" pinned above the tab bar, hidden when nothing is due. Day: back arrow, same long-press actions and undo toast. Pull to refresh on both.

## 3. Boards and wall editor
- Gear removed. New board: sheet, one field, `autoFocus`, `done`, 40-char cap, create disabled while empty or in flight; failure is an inline line under the field; success dismisses, scrolls to it, `success` haptic.
- Canvas: drag lifts (scale 1.06, `tap`), drop `tap`. Tap selects and shows a toolbar (Front, Resize, Remove). One coach mark.
- Long-press a board title: Rename (inline) / Delete. Delete is an undo toast (stickers stay); no confirm alert.
- If the Home wall survives as board #1, reuse the canvas and delete `HomeWallEditor` (555 lines).
- Empty: "Drag stickers here" and "Add stickers". Loading: sand placeholder. Error: retry card.

## 4. Profile and settings
- Entry: avatar on Home (push, back arrow). Photo: action sheet (Choose, Take, Remove; remove is undoable).
- Language first, segmented, `select` haptic, one sentence on what it changes. Stats: Cards, Reviewed, Streak; zero shows "0".
- Export (P1): `expo-sharing` and `expo-file-system` are installed; spinner on the row, toast on failure. Reminder (P1): toggle; on denial an inline "Notifications are off" row with "Open Settings".
- Any failed edit reverts the control and toasts mapped copy. Log out: one confirm. Delete account: two-step alert. Offline: rows say "Needs a connection".

## 5. Auth and first-run
- Sign-in unchanged (Maestro strings). Errors inline under the field via `lib/authErrors.ts`, live-region announced; `returnKeyType` next then go; `PasswordField`. Network failure: "Can't reach Tabi. Check your connection."
- Sign-up: Terms and Privacy links (44pt), password rules shown up front, submit disabled until valid, spinner in the button.
- Onboarding (first sign-up only, AsyncStorage flag keyed by user id): three paged cards, dots, "Skip" (44pt), "Next", "Get started" to camera. Copy: "Photograph a thing", "Get the word, a sentence and audio", "We'll remind you to review". 200 ms fade, none if reduced. AI consent follows as a sheet.

## 6. Navigation
- Tab bar: four labelled items (20pt icon, 11pt semibold label, cap 1.15). Item width 62 to 70, so the pill is 284pt. Keep the light haptic on change; re-tapping the active tab scrolls to top; `tabBarHideOnKeyboard`.
- Due badge on Collection: count (9+), `errorDeep` fill, part of the tab's own label ("Collection, 3 due").
- Avatar to Profile is the only gear replacement, Home only.

## 7. Toast spec
One `ToastProvider` in `app/_layout.tsx` (lesson 1); `useToast().show({kind, message, action})`. Today's `Toast` is mounted per screen (only scan uses it).
- **Kinds:** success, info, error, undo. **Look:** charcoal pill, white 16pt text (14.1:1), action in blush #E4A0A1 (6.6:1), 16pt icon (error icon #F2A5A8, 7.2:1). Radius full for one line, `radii.lg` for more.
- **Position:** `insets.bottom + TAB_BAR_CLEARANCE + 8` on tab screens, `insets.bottom + 16` elsewhere, above the keyboard on forms.
- **Queue:** one visible; a new one replaces it (150 ms crossfade); error is never replaced by success; max 2 waiting.
- **Duration:** 4 s info/success, 6 s error/undo, 10 s under VoiceOver; paused while touched. Tap or swipe down dismisses. Action is `minHeight: 44` (today about 40).
- **Motion:** slide up 12pt plus fade 200 ms in, fade 150 ms out; fade only if reduced. **Haptic:** success and error on show; `tap` on undo.
- **A11y/copy:** `announceForAccessibility` (exists); cap 1.5, up to 3 lines. Pattern: "Couldn't <verb> <object>. <Recovery>." No "Oops", no raw errors.

## 8. Modal vocabulary and the 61 `Alert.alert` sites
**Rule.** Alert: irreversible choice or permission redirect, two buttons, destructive in red. Sheet: 3+ actions or a short form. Push: own navigation or long form. Full-screen modal: camera, study, onboarding only. Toast: outcome needing no decision. Inline: error belonging to a field or block.

**Plan** (counts from grep, approximate):
- **Deferred, about 19:** friends, challenge, report, block (`FriendProfile` 6, `ReportSheet` 3, `friends.tsx` 3, `ChallengeScreen` 3, `FriendSearch` 2, `BlockedAccounts` 2). Friends is off in v1.
- **Stay as confirms, about 10:** Log out, Delete account (both steps), `FieldEditor` discard, `permissions.ts` x2 and `notifications.ts` (Open Settings), and any destructive confirm with no undo (crop discard).
- **Undo toasts, 3 groups:** delete card (`StudyCard` 689/708), delete board (`BoardCarouselPage` 159), remove cover (`HomeWallEditor` 158, `BoardCarouselPage` 292).
- **Inline, about 6:** `NewBoardSheet`, scan Save/Scan failed (error card with Retry, "Type the word instead", photo kept), `DiscoveryReveal` translation failures.
- **Toasts, about 23:** every "Couldn't ..." showing `error.message` (`profile` x6, `BoardCarouselPage` x5, `exportSticker` x3, `StudyCard` save and recording, crop, wall) and every success alert ("Saved to Photos").

All error copy goes through one `friendlyError(err, fallback)` that extends `lib/functionError.ts` and `lib/authErrors.ts` (lesson 3).

## 9. Offline (JS-only)
Today nothing handles it; each screen fails on its own.
1. `lib/connectivity.ts` Context store: `online`. Wrap `fetch` in `createClient({ global: { fetch } })`: a network rejection sets offline, any 2xx sets online; 15 s `AbortController` on non-function calls.
2. Probe while offline: GET `/auth/v1/health` with the anon key, 3 s timeout, every 5 s backing off to 30 s, plus once when `AppState` becomes active.
3. Banner: 32pt strip under the band, maroon on #F7E0E1, live region, 200 ms slide. Copy: "You're offline. Showing what's saved on this phone."
4. Read cache: after each good fetch store the sticker list (`image_path`, not signed URLs, lesson 17) in AsyncStorage; show it at cold start. Images come from the `expo-image` cache by the same `cacheKey`.
5. Disabled with a reason (press toasts): Scan ("Scanning needs a connection"), profile edits, board create.
6. Review writes (P1): queue `{cardId, rating, ts}`, flush in order on reconnect. Don't say "will sync" before this exists.
7. Later (rebuild, owner's yes): `expo-network` `useNetworkState` replaces 1-2.

## 10. Haptics (one `lib/haptics.ts`, throttle 80 ms)
- `tap` (Light impact): tab change, favourite, undo, drag lift/drop.
- `select` (selection): chips, filters, picker, calendar day, onboarding next.
- `press` (Medium impact): due pill, long-press menu, destructive confirm.
- `success` / `error` (notification): card added, board created / error toast.
No haptic on scroll, sheet snap or pull-to-refresh. Never the only feedback.

## 11. Motion and Reduce Motion
`lib/motion.ts`: `dur = {instant 0, fast 120, base 200, slow 320}`, `ease = out(cubic)`, `spring = {damping 18, stiffness 220}`. `useMotion()` returns `{reduced, ms(n), spring}`, reading reanimated `useReducedMotion()` and `AccessibilityInfo.isReduceMotionEnabled` plus its listener (for `Animated`). Reduced: movement 0, opacity 120 ms, springs become fades; pulses, parallax and wobble stop. Only StudyCard honours it today (about 42 other sites don't). Ban direct `withSpring`/`withTiming` imports outside the helper (grep check).

## 12. Dynamic Type caps (`maxFontSizeMultiplier`)
- Tab label, badge, chip, status caption: 1.15 (the 62pt pill doesn't grow).
- Buttons, inputs, rows, toast: 1.5; `minHeight` not `height` on due pill, chips, search, band.
- Reading copy (meaning, sentence, note, empty states): 2.0, scrolls.
- Headword and large numerals: 1.3, `adjustsFontSizeToFit`.
At `fontScale >= 1.5` the Home grid goes to one column and Calendar cells show number and dot only. Minimum size 12 (raise the 9-11px labels in `profile.tsx`, `_layout.tsx`, `HomeHeader`). Test at AX3.

## 13. Tap targets
Prefer a 44pt visual control over hitSlop (anisotropic, lesson 9); in icon rows `gap >= left_slop + right_slop`. Avatar, search clear, Cancel, back, chevrons, heart, speaker and toast action are 44x44 (the 40pt `SettingsButton` chip and 14pt search icons go up). Tab items are 62 tall. Chips are 36 tall with 8pt gaps and 4pt vertical slop. Every long-press has a visible equivalent.

## 14. VoiceOver
- **Tab bar:** "Collection, 3 due", "Calendar", "Scan a new sticker", "Boards"; selected state from expo-router.
- **Home order:** title (`header`), status, due pill ("Start reviewing, 1 card due"), search, filter, chips (`selected`), grid, tab bar.
- **Grid:** one element per card, "pomme, apple, due today"; heart, speaker, delete are `accessibilityActions`, not focus stops.
- **Calendar:** cell "14 November, 3 stickers, 2 due" (plus "today"); blank cells `accessible={false}`; month title `header`; "Previous month"/"Next month" buttons.
- **Board canvas:** each sticker "pomme, sticker 3 of 8", ordered by z. Actions: move up/down/left/right (20pt), bigger, smaller, bring to front, remove. Pages announce "Board 2 of 4, Kitchen" with next/previous actions.
- **Sheets:** `accessibilityViewIsModal`, a "Close" action, the scrim is not a stop. Errors in toasts persist 10 s.

## 15. Rose contrast fixes (measured)

Keep the look. Changes are token-level and JS-only.

| Token | Now → Fix | Result |
|---|---|---|
| `inkLight` (captions, placeholders) | #A98A8C → **#7E5559** | page 5.76, card 6.30, sand 5.46, tint #F2DCDC 4.82 (was 2.86 / 3.13) |
| `inkFaint` as text | text role removed | stays for disabled and decorative hairlines only (2.00) |
| text on the rose band | any caption or icon → **maroon #662B31** | 5.03. `inkLight` there is 2.95 and #833F46 is 3.56 (OK only at 24pt+). |
| tab icons on the band | white → **maroon #662B31** | 5.03 (white is 2.13). Active disc stays white with a #9D4D51 icon (5.81). |
| camera glyph | white on #9D4D51 | 5.81. Button vs band is only 2.72, so the glyph (not the edge) carries it. |
| badge fill | `error` #C4565B → **#A8434A** | white 5.89 (was 4.35 at 9px). Text 9 → 11 bold. |
| semantic text | err #A8434A; ok **#3F6E46**; gold **#7A5A1E** | on page / card / sand / tint 4.7 to 6.4 (err on #F7E0E1 4.68; ok on #E2EFE3 5.01; gold on sand 5.50) |
| terra text on tint #F2DCDC | #9D4D51 (4.44) → **#833F46** | 5.80 |
| input and chip borders | #EADFD6 (1.20) → **#957579** | 4.12 on card, 3.76 on page, 3.57 on sand. All pass 3:1. |
| toast | charcoal #33292A | text 14.08, action #E4A0A1 6.60 |

Cards keep their shadow-only edge (1.09 is decorative); inputs and chips get the border above. Meaning is never colour alone (badge text, today ring, filled heart).
