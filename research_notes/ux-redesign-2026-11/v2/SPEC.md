# Build spec: production polish (refine/production-polish)

This is the source of truth for builders. It points into the four pass documents and settles where they disagree. Read them in this order:

1. **A-card.md**: what the card shows, per mode.
2. **A-app.md**: what each screen keeps, cuts and adds.
3. **B-core.md**: interactions for scan → reveal → study → detail.
4. **B-app.md**: interactions for everything else, plus the app-wide system (toasts, haptics, motion, Dynamic Type, VoiceOver, Rose contrast fixes, offline).
5. **C-look.md**: the exact tokens, type scale, layout and components. The mockups are `C-mockups.html`; the owner sees them at https://claude.ai/artifact/MDyiLUvNejpcgZVg534Eu1.

Where a later document refines an earlier one, the later one wins (C > B > A), except where this file says otherwise.

## Settled decisions (override the pass documents)
| topic | decision |
|---|---|
| Identity | Production Rose: cream page, rose band, floating pill tab bar with camera disc, Newsreader + JetBrains Mono. C-look's tuned tokens apply. |
| Learning fonts | Klee One SemiBold (fr, ja) and Iansui (yue) via `wordFontFor`/`sentenceFontFor`, on all platforms. This is harness feature `teachers-hand-fonts` in harness/feature_list.json; follow its description. |
| Streaks | **None.** Profile stats are Cards · Reviewed · Due tomorrow (C-mockups shows "Day streak"; replace it). |
| Tab bar (owner, 2026-11-13) | **Five slots, symmetric: Collection · Calendar · [Scan] · Boards · Profile.** The camera disc sits dead centre, raised, with a "Scan" label. Four items with the camera third was "not balanced". Profile is a tab now, so **no avatar button and no gear anywhere**. Pill width 344, item 68.8. Overflow-visible wrapper (C-look). |
| Home band copy (owner, 2026-11-13) | The band shows **only "Collection" + the due pill**. The pill reads **"Review N"** + an arrow disc (40pt, no minutes, no "due"). It is **hidden when nothing is due**, with no caught-up line. Its accessibilityLabel stays 'Start reviewing — N card(s) due, about M minutes'. Band height 140pt. The "N FOUND TODAY · N REVIEWED" subline is **cut**. With the owner's approval, the approved flows now wait for visible "Collection" instead of "FOUND". |
| Sticker wall (passed harsh review, round 6; reference `v2/wall-study.html`) | **Geometry:** the band bottom radius is 24, the wall radius is 24, and the wall overlaps the band by exactly 24 (concentric). Inset 20, height 224. Shadow: inset 0 1px 0 rgba(255,255,255,.7), 0 2px 4px rgba(102,43,49,.08), 0 12px 24px rgba(131,63,70,.14).<br>**Field:** radial gradient #FCF8F0 → #F6EEDD → #EEE1C9 (130%×100% at 50% 30%). Or the user's photo with a cream top wash (rgba(250,244,234,.38) → 0 at 70%) and a rose bottom scrim (transparent 60% → rgba(102,43,49,.22)).<br>**Cut from production:** tape strips, ruled-paper background, the "✨ new" badge, the floating Arrange pill, the "breathing" idle animation, and any footer/title/count.<br>**Stickers:** the user's cutout with its border setting plus an attached contact shadow (ellipse at 82% of height, blur 5, rgba(102,43,49,.20)). Rotation ±6° max. 12pt safe inset. Nothing within 16pt of the Arrange chip.<br>**Auto arrangement** (until the user arranges; ≤6; offsets from centre x and cy = 45% of height, then size):<br>• 1: (−8,−6) 150<br>• 2: (−50,8) 118 / (58,14) 96<br>• 3: hero (0,12) 112, flankers (±104, 22–24) 84<br>• 4–6: hero (0,16) 108, flankers (±104, 24–26) 80, back row 56 at (±74,−42) and (0,−60)<br>Newest = hero. Tilts [0,−6,5,−3,4,6]. Hero z on top; the back row behind.<br>**Arrange:** one chip bottom-right, 28pt visible / 44pt hit, cream rgba(255,251,244,.82), 1px inset ring rgba(149,117,121,.28), no shadow, move icon 14pt stroke 2, label 13pt Newsreader. Long-press on the wall also opens Arrange.<br>**Empty (new account):** "Nothing stuck yet" / "Photograph something near you. It becomes a sticker and a word." (max-width 240, balanced) + a primary "Take a photo" opening Scan.<br>**Tap a sticker** → its card detail. |
| Home layout (owner, 2026-11-13) | **Keep the sticker wall on Home** as the hero, with its Arrange button (A-app's cut is overruled). **Remove the category chips** (All/Kitchen/…), because they add little. The layout follows the mockup's two Home states:<br>• Band (152pt): "Collection" title + due pill ("7 due ~7 min →", top-right, accessibility label unchanged), with the subtitle "N FOUND TODAY · N reviewed" (mono overline keeps the 'FOUND' Maestro match).<br>• The sticker wall card (196pt) overlaps the band edge.<br>• Toolbar: "Your words N" + search button + filter button. Filter is a sheet: sort, favourites only, due only.<br>• 2-column grid (108pt wells).<br>• **On scroll:** the wall scrolls away, the band collapses to a slim bar (title + due pill), and the toolbar sticks under it.<br>Cut: "Latest finds", "Latest stickers", the date, GOAL and the chips. |
| Grade row | C-look: Again = tint + ccw icon; Hard = gold tint; Good = the only solid (#3F6E46); Easy = green tint + icon. Form, icon and label carry the meaning (colour-blind caveat in C-look). The accessibility labels "Again — next review in…" etc. are unchanged. |
| Swipe grading | On the back only. Left = Again, right = Good. Threshold per B-core (96pt). Toggle in Profile. |
| Simple grading | A Profile toggle that shows two buttons ("Again" / "Good", keeping those labels so the scheduler and Maestro strings stay intact). A-card's "Not yet / Got it" copy is **not** used. |
| Undo | Grade undo per B-core (full snapshot). Delete card / discard draft / delete board: an undo toast instead of a confirm (B-core, B-app), with `pendingDeleteIds` so a refetch can't resurrect an item. |
| Mic | Cut from study. In detail it becomes "Compare" (TTS, then your take), with no scoring. |
| New-card limit | 10/day default, stored on the device (AsyncStorage), editable in Profile. The GOAL display goes. |
| Suspend / review log / leech | **Deferred**: they need a backend column, and production deploys need the owner. Reset progress uses existing columns, so it ships. |
| Early exit summary | The title becomes "Stopped early"; "Session done" stays for a finished session (the approved flow). |
| 'FOUND' (Maestro) | Home's band subtitle must contain visible "FOUND" text matching the approved flow. Check `.maestro/sign-in.yaml` for exact-vs-regex/case before changing wording. If it can't fit naturally, keep a small "N FOUND TODAY" mono overline (the one allowed per screen). |
| Daily reminder | JS-only via the installed expo-notifications (local scheduled notification). Off by default; a Profile toggle asks for permission at that moment. |
| Export | CSV via the installed expo-file-system + expo-sharing, from Profile. |
| Offline | B-app's JS-only plan: a wrapped fetch → online state, a banner, disabled actions with a reason, and a read cache. **No** "will sync later" copy (there's no write queue). |
| Dark mode | Out of scope (it needs a native build). |
| Alerts | B-app's plan for the 61 `Alert.alert` sites. Friends/challenge sites are left alone (Friends is hidden). |
| Onboarding | First run: a 3-screen explainer (photo → sticker + word → review), then a language pick, then land on the camera. JS-only. Don't show it to existing users (gate on a local flag plus "has 0 stickers"). |

## Build phases (sequential; each leaves the app working)
- **R1 System:** tokens/typography (C-look) in constants/theme.ts, keeping the old export names; learning fonts; `lib/haptics.ts`, `lib/motion.ts` (Reduce Motion), a `ToastProvider` + `friendlyError()`, and small shared primitives where C-look specifies components (buttons, chips, inline error, empty state, row, sheet wrapper around BottomSheet). Guard: a lint check against new hex literals.
- **R2 Chrome:** pill tab bar (labels, raised camera, due badge), band refinement per screen, avatar → Profile, removal of every gear (the Boards gear bug).
- **R3 Card:** a shared CardView: study front/back, hint fix, grade row, swipe, undo, requeue, summary; card detail (opens on the answer, Test me, Compare, Progress block, reset progress, "…" menu with delete + undo); the new-card reveal after a scan; the new-card limit.
- **R4 Home + Calendar + Day.**
- **R5 Scan:** camera, consent sheet, processing states with timeouts, inline errors, result sheet, Type a word.
- **R6 Boards, Profile (stats, settings, reminder, export), auth + onboarding, the alert sweep, offline.**
- **QA:** full Simulator tour, then a fix pass.

## Rules for every phase
- Read AGENTS.md, skills.md and the docs/lessons.md sections in your area. Use Expo SDK 54 APIs (https://docs.expo.dev/versions/v54.0.0/).
- Approved Maestro flows (`.maestro/sign-in.yaml`, `.maestro/study-grade.yaml`) must pass at the end of each phase: `.maestro/run.sh .maestro/sign-in.yaml .maestro/study-grade.yaml`. Never edit `.maestro/*.yaml`, run.sh, seed.mjs or harness/. Agent flows in `.maestro/agent/` may be updated when the UI they test changed on purpose.
- Gate: `harness/init.sh` ends GATE GREEN.
- No native config changes, deploys, eas commands, pushes or backend migrations.
- Visually check your screens on the Simulator (Metro :8081 serves this repo; Tabi Dev on the booted iPhone 18 Pro, EDDD98CB-E1A0-44C6-B4A5-A628CC9089B1). Use `xcrun simctl io booted screenshot`, save to `research_notes/ux-redesign-2026-11/v2/shots/<phase>-<screen>.png`, and look at each one yourself. Compare against C-mockups.html.
- The staging AI backend currently has no GEMINI_API_KEY, so scans and lookups fail with a server error. Use that to check the error states. Don't try to fix the backend.
- Commit at the end with `Polish R<n>: <what>` plus the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
