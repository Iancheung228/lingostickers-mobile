# Brief v2: refine production into a production-grade app (2026-11-13)

## What changed
The owner **rejected the Powder redesign** (PROPOSAL.md, on branch `redesign/finished-ui`).

The new direction, in their words: "keep the color and main theme of current production version, make refinements to make sure the user experience is flawless, also scrutinize what should be kept and perhaps what should go, especially on the card screen (from a language learning perspective). Think through the best experience for each possible interaction in the app. Three things: think from a functional perspective, think from a user interaction perspective, finally nail down the look to add more detail and thought. The final product should be a production-grade app."

Work happens on branch `refine/production-polish`, cut from the production UI.

## Fixed
- **Keep the production identity.** That means the Rose palette (cream page #FAF4EA, dusty-rose band #E4A0A1, deep rose action #9D4D51, rose-brown headings #833F46; see `constants/theme.ts`), the warm cosy feel, the rose header band and the floating pill tab bar with the raised camera. Refine, don't replace.
  - Colours may be **tuned** to pass contrast. `team/accessibility.md` already measured Rose: captions #A98A8C fail (2.86), and #7E5559 passes. Semantic text needs err #A8434A, ok #3F6E46 and gold #7A5A1E. Rose's action vs Again are near-identical (ΔE 9), so the grade row needs its own answer.
- **Fonts:**
  - Learning-language words use "Teacher's hand", the owner's own pick: Klee One SemiBold for fr and ja, Iansui for yue.
  - The UI keeps the production faces (Newsreader + JetBrains Mono). Using the mono less is a valid refinement; replacing the faces isn't.
- **No physical metaphor** (no stamps, washi or notebook styling).
- Friends stays hidden for v1.
- Audience, both at once: the serious learner who'd otherwise use Anki, and the casual learner capturing personal moments.

## Palette-independent findings to reuse (verify, don't trust blindly)
Read `team/*.md` (round 1 and r2) and `team/moderator-notes.md`, but **ignore everything about Powder, Figtree, killing the band or killing the pill**. Still-valid findings:
- Home shows the same card three times ("Latest finds", "Latest stickers", grid), and the sort pill overlaps the chips (baseline 02a).
- Study has share/download/**delete** in the review header; "SHOT AT · Not recorded" appears as content; there are five mono uppercase labels; the grade buttons mix filled and outlined styles; and the card flip is 420ms.
- The Boards gear sits under the status bar and can't be tapped (`wall.tsx:155`). Gears are repeated per tab.
- Scan: the title collides with the frame, the hint overlaps it, consent is a full page, the photo error says "Couldn't find the word", and there are 61 `Alert.alert` sites.
- Calendar: a week chart plus a month grid (time shown twice), mostly empty air.
- Reduce Motion is honoured only in StudyCard. Fixed-height chrome will clip under Dynamic Type. Icon buttons rely on hitSlop.
- The scheduler (`lib/review.ts`) is Anki-faithful SM-2. Learning found no change needed there.
- The scene-word picker is the product's best moment (both critics).

## Evidence
- `baseline/*.png`: production UI on the Simulator (QA account, one card 'pomme').
- `../app-store-launch/screenshots/ss*.png`: populated production screens.
- `../ux-polish-2026-10/FINDINGS.md`: the October sweep.
- The code: `app/`, `components/`, `constants/theme.ts`, `lib/`.

## Constraints
- Expo SDK 54 (docs: https://docs.expo.dev/versions/v54.0.0/). JS-only changes are preferred; label anything needing a native rebuild.
- The backend must stay compatible with the live 1.0.0 build.
- Approved Maestro strings must keep working: 'WELCOME BACK', 'Email', 'Password', 'Sign In', 'Not Now', 'FOUND', 'Start reviewing — 1 card due.*', 'Tap to reveal.*', 'What did you call this\?', 'Good — next review in.*', 'Again — next review in.*', 'Easy — next review in.*', '2 / 2', 'Close this card', 'Session done', '1 card reviewed', 'Done'. If a change truly needs new copy there, flag it; the owner can re-approve.
- Lessons in `skills.md` / `docs/lessons.md` apply. Read the sections in your area.

## Three passes
1. **Functional (pass A):** what each screen is *for*, what stays, what goes, what's missing. Card screen first.
2. **Interaction (pass B):** for every interaction, the best experience in every state: first-run, loading, empty, error, offline, success, undo, edge cases, accessibility.
3. **Look (pass C):** within the Rose identity, add detail and thought (hierarchy, spacing, depth, type use, iconography, micro-detail, motion).

Each pass writes to `v2/`. Later passes read earlier ones.
