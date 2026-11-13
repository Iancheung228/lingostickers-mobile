# Pass A: functional audit of everything except the study card

Branch refine/production-polish. Verified in code (collection, calendar, scan, wall, profile, day, auth, HomeHeader, tab layout, AiConsentGate, notifications, coachMarks) and in baseline plus App Store screenshots. Not verified on a device.

**Facts that shape the verdicts**
- No onboarding exists. Only a 450 ms wordmark (AuthIntro), the sign-up language pills and the AI-consent page.
- No offline handling anywhere (grep for NetInfo or "offline" finds nothing).
- Notifications are registered only for friends and challenges. Friends is off in v1, so nothing ever reminds anyone to review.
- No export. No bulk actions. No undo for any delete (Alert confirms only).
- Account deletion and Log Out exist on Profile, both with confirms. The app version is shown.
- The only coach mark is on boards.
- 61 `Alert.alert` call sites, many showing raw `error.message` (profile, scan "Save failed", NewBoardSheet).

## 1. Home / Collection

**Job.** Serious learner: see what is due, start review in one tap, find and manage a card. Casual capturer: browse and enjoy what they collected.

| Element | Verdict | Why |
|---|---|---|
| "GOAL 5" | cut | Not tappable, not configurable, and the "FOUND TODAY" it pairs with is the wrong metric. |
| "0 FOUND TODAY" big numeral | merge | Replace with one status line: "Today: 3 reviewed · 1 found". Reviews are the habit that matters, and a review-only day should not read 0. |
| Due pill "1 due · 1 min" | keep, promote | The primary action on the app. Hero of the band. Keep the Maestro string "Start reviewing — 1 card due". |
| "All caught up · next due in…" | keep | Good. Add a "Study ahead" tap. |
| Search icon in band | keep | Make it a visible search field at the top of the list. The magnifier hides a field that renders ~1.3 screens down (October P0). |
| Gear in band | move | See section 4: becomes the avatar/Profile button. |
| Wall card + "Arrange" + HomeWallEditor | cut from Home | A 330 pt hero showing one sticker, plus a 555-line editor, duplicates Boards. Keep the Home wall as a single "My wall" board on the Boards tab (JS-only: reuse `useHomeWall` as board #1, or just drop the card). Reclaims a full screen of scroll. |
| "Latest finds" rail | cut | Same card as the grid, plus sentence text and a "DAY 1" mono label. |
| "Latest stickers" nested box | cut | Third copy, and a nested scroll that clips rows. |
| Category chips (All, Kitchen…) | keep | Real filter. Fix overlap with sort. |
| Sort pill (on chips row) | move | Into a "⋯ / Filter" control beside the search field. Offer Newest, Oldest, Due soonest, A–Z. |
| Favourites heart filter | merge | Into that same filter control. |
| Grid card (big photo, word, gloss, speaker, heart) | keep, shrink | Use a two-column grid so 6+ cards fit per screen. |

**Home order after the change:** band (status + due pill) → search field + filter → chips → grid. Capture (camera tab) is always one tap away.

## 2. Calendar and Day

**Job.** Serious learner: "How consistent am I, what is coming?" Casual capturer: "Show me what I found on a given day, like a diary."

| Element | Verdict | Why |
|---|---|---|
| "N DUE IN 7 DAYS" | keep, reword | "Due this week: N". |
| Finds / Reviews toggle | cut | Two modes of the same grid. Show finds as the sticker thumbnail in the cell and reviews as a small dot beneath, in one view. Reviews mode currently has no drill-down. |
| "This week" bar chart | cut | The month grid shows the same week. If a chart stays, it should be a forecast (next 7 days due), which the grid cannot show. |
| Month grid | keep | The core. Make the empty month show a one-line message. |
| "Review N now · N min" CTA | keep | The only on-screen path to review besides Home. |
| Gear | move | Same as Home. |
| "Shot at: Not recorded" | cut | Show the row only when it has a value. |

## 3. Scan → result → add

**Job.** Turn a thing in front of me into a card with the least effort. The serious learner also wants a typed word with no photo.

| Element | Verdict | Why |
|---|---|---|
| Title "What did you find?" + subtitle | keep, re-lay | It collides with the frame and the gear. Move into the safe area. |
| Gear on camera | cut | Profile is reachable elsewhere. |
| Frame hint "Pinch to zoom · Tap frame to focus" | cut after first view | Make it a coach mark (the `useCoachMark` store exists). It overlaps the frame today. |
| "Type a word" floating text | move | Promote to a labelled secondary button next to the shutter. For the serious learner, typing is the main path. |
| AI consent as a full page | move | Show once as a bottom sheet over the live camera, after the camera permission. Keep the "Agree & Start Scanning" string. |
| Box/Lasso extractor | keep | The "Extract Sticker" title and button are the same label. Make the title "Pick the object". |
| ScanProgress checklist | keep | Add a Cancel, and a visible timeout. |
| SceneWords picker | keep, protect | Best moment in the product. Do not touch the flow. |
| Add result sheet / "Add 3 cards" | keep | After add, go to a toast with "View" and "Scan another". Today it drops you onto a black camera with no feedback. |
| Error alert "Couldn't find the word" | replace | Inline error card with Retry and "Type the word instead". Kept photo, no loss. |

## 4. Boards and wall editor

**Job.** Casual: make a pretty page of my stickers. Serious: no job. This is the most expendable tab.

| Element | Verdict | Why |
|---|---|---|
| Boards gear (under the status bar) | cut | Unreachable today. |

Boards stays as tab 4. A cheaper tab-4 alternative, a "Browse/Library" tab, is not JS-small. Keep the tab and absorb the Home wall (section 1).

## 5. Profile and settings

**Job.** Pick language, manage account, get help. Not a destination people visit daily.

| Element | Verdict | Why |
|---|---|---|
| Stats "Captured / Favorites" | replace | Show Cards, Reviewed total, current streak, retention if cheap. Favorites is trivia. |
| "Welcome back to your cozy corner!" blurb | cut | Dead copy. |
| Learning language | keep | Make it the first section. |
| Scanner (consent withdrawal) | keep | App Store requirement. |
| Delete Account | keep | Exists, double confirm. Good. |

## 6. Auth, onboarding, consent
Keep sign-in/up/reset as is (Maestro strings stay).

| Element | Verdict | Why |
|---|---|---|
| Raw errors ("Invalid login credentials") | replace | Plain-language copy via `lib/authErrors.ts`. |
| No Terms/Privacy line on sign-up | add | Required. |
| First-run explanation | add | See P0 list. |

## Missing functionality

| Pri | Item | Feasibility |
|---|---|---|
| P0 | **First-run onboarding**: 3 cards after sign-up ("Photograph a thing → get the word, sentence and audio → we remind you to review"), plus an empty Home that says "Scan your first sticker" with a camera button. Fire once, via AsyncStorage. | JS |
| P0 | **Scan error recovery**: inline error with Retry, "Type the word instead", and the photo kept. Client timeout. Replace "Couldn't find the word" on photo failures. | JS |
| P0 | **Delete undo** for card delete (remove from state, delay the write ~5 s, "Undo" toast). Today only a confirm exists, and the card has a delete button in the review header. | JS (soft delete would be better but is backend) |
| P0 | **Offline state**: a banner "You're offline: reviews will sync later" and disabled scan with a reason. At minimum, catch fetch failures with the existing Try Again. Review writes queued locally. | JS, adds the `@react-native-community/netinfo` package, which needs a native rebuild unless already bundled in Expo Go/dev client: **verify**. Fallback JS-only: detect failed fetches. |
| P0 | **Terms / Privacy line on sign-up**, support@ address, raw `error.message` removed from alerts. | JS |
| P1 | **Daily review reminder**: local notification, opt-in after the first review ("Remind me at 9:00"), time picker on Profile. `expo-notifications` is already installed and the permission ask is already timed properly. | JS (local scheduling) |
| P1 | **Toasts replace alerts** for success and non-destructive errors (the Toast component exists). | JS |
| P1 | **Export** CSV of cards from Profile via share sheet. Trust feature for Anki users. | JS (`expo-sharing`/file system: verify installed) |
| P1 | **Nothing-due / session-end loop**: next due time, "study ahead", streak. | JS |
| P2 | Bulk select in Collection (delete, favourite, move to board). | JS |
| P2 | Soft-delete / trash (30 days). | **Backend** |

## Navigation

- **Keep 4 tabs, floating pill, raised camera.** The production identity requires it, and it is a sound structure: Collection / Calendar / Scan / Boards.
- **Make the camera actually raised.** The code comment says the tab bar clips its bounds so the button stays in-line. The brief says raised. Verify; a raised button needs `overflow: visible` on the bar, which is JS.
- **Profile lives behind one avatar button**, top right of Home only, as a small circle. It replaces the gear. Remove the gear from Calendar, Scan, Boards and Day. The Settings route (`/profile`) stays a pushed screen with a back arrow. This also fixes the clipped Boards gear.
- **Review now from anywhere:**
  1. Home band due pill (primary).
  2. Calendar CTA (keep).
  3. Add a small due-count badge on the Collection tab icon (mirrors the existing friends badge). This makes "review now" visible on every screen, including Scan and Boards. JS.

## Information architecture decisions, ranked by user impact

1. **Cut Home to one card list.** Remove Latest finds, Latest stickers and the wall hero. Biggest clarity win and the fix for "same card three times".
2. **Add first-run onboarding and a real empty Home.** Without it new users bounce at a blank camera or an empty list.
3. **Fix scan failure and add the typed-word path** as an equal. Recovery inline, photo kept, "Type the word instead".
4. **Make reviewing the Home headline**: due pill first, status line "reviewed / found", and a due badge on the tab bar.
5. **One Profile entry (avatar on Home), kill the repeated gears**, including the unreachable Boards one.
6. **Calendar: one grid, one mode**. Drop the Finds/Reviews toggle and the weekly bar chart.
7. **Safety net:** undo on delete, offline banner, toasts instead of alerts, plain-language errors.
8. **Retention:** opt-in daily reminder, session-end "next due".
9. **Profile trimmed:** drop blurb and blocked accounts; add stats that matter, export, and account edits.
10. **Boards stays but shrinks in ambition**: absorb the Home wall, remove the duplicate New control.

**Maestro caution.** Strings that sit on the screens above: 'WELCOME BACK', 'Not Now', 'FOUND', 'Start reviewing — 1 card due.*'. Replacing the "FOUND TODAY" numeral breaks the **'FOUND'** match. Either keep a "FOUND" label in the status line or ask the owner to re-approve.
