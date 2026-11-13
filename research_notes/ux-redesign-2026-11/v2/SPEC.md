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
| Tab bar | Labels on all four items. The camera disc is raised, with a "Scan" label under it. Overflow-visible wrapper (C-look). |
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
