# Tabi Stickers redesign: team brief (2026-11-13)

## The ask, in the owner's words
"Based off what is currently in production, make the app look finished from a
UI/UX perspective. Right now my app looks and interacts in a manner that gives
off a vibe-coded, unthoughtful, unpolished vibe." The team should produce one
final proposal that improves all four tabs, the interactivity and the user
experience.

The owner gave full autonomy. Anything can change: layout, navigation,
structure, copy, motion, colour. The work happens on branch
`redesign/finished-ui`.

## Who it's for (both, at once)
1. **The serious learner** who would otherwise use Anki. They want real
   spaced repetition, fast review, control over cards, every part of speech
   and idioms, and no friction or gimmicks.
2. **The casual learner** who likes capturing personal moments: a photo of a
   real thing becomes a sticker and a word. They want warmth, memory and
   delight.

The design must serve both without turning into two apps. Settle that
tension explicitly.

## Fixed decisions (build on these, don't reopen them)
- **Fonts for the language being learned:** "Teacher's hand". Klee One
  SemiBold for French and Japanese, Iansui for Cantonese (measured coverage
  27/27). The UI chrome typeface is open. The last study's pick was Figtree to
  replace the JetBrains Mono uppercase labels, with Newsreader for
  headings/buttons today. The team decides the UI face.
- **Colour:** **Rose or Powder.** The team picks one of the two and must
  argue the choice. The owner says colour and shade are extremely important,
  so the pick needs a full tonal system: light and dark mode, elevation and
  shadow levels, and semantic colours, all meeting WCAG AA contrast (check it
  with a script; don't eyeball it).
  - Rose (today, refined): page #FAF4EA, pageTop #F5E3DD, card #FFFFFF, sand
    #F6EEDD, tint #F7E3E3, head #833F46, body #4A4340, cap #8A6266, action
    #9D4D51, shadow tint rgb(131,63,70).
  - Powder (white + light blue, with a peach action taken from the app icon):
    page #F8FBFF, pageTop #E4F0FB, card #FFFFFF, sand #EEF5FC, tint #FFE9DD,
    head #24406B, body #2E3A4E, cap #5B6B85, action #F2A27A (ink #24406B on
    it), shadow tint rgb(36,64,107).
  - The prior depth study (0–4 levels of layered shadow) is in `prior/`. The
    earlier recommendation was depth 2 everywhere.
- **No physical-world metaphor.** The owner rejected the travel-notebook,
  stamps and washi-tape look. Aesthetics come through customisation instead.
- **Friends is off for v1** (the tab exists but is hidden). Leave it out of
  scope.
- The four visible tabs are **Collection** (home), **Calendar**, **Scan** and
  **Boards**, plus Profile (from a header button), the study session, card
  detail/edit, scan → add flow, auth/onboarding/consent, and the Day screen.

## Constraints
- Expo SDK 54, React Native. Read https://docs.expo.dev/versions/v54.0.0/ for
  any API.
- For each change, label whether it is **JS-only** (can ship as an OTA
  update once a build with expo-updates is out) or **needs a native
  rebuild**. Builds are rationed (15/month). Prefer libraries already in
  package.json, e.g. react-native-reanimated, expo-haptics, expo-blur, and
  react-native-gesture-handler if present. Check package.json.
- The backend must stay compatible with the live App Store build (1.0.0).
  UI-only changes are fine.
- The approved Maestro flows `.maestro/sign-in.yaml` and
  `.maestro/study-grade.yaml` match these strings, so keep them or flag them
  explicitly: 'WELCOME BACK', 'Email', 'Password', 'Sign In', 'Not Now',
  'FOUND', 'Start reviewing — 1 card due.*', 'Tap to reveal.*', 'What did you
  call this\?', 'Good — next review in.*', 'Again — next review in.*', 'Easy
  — next review in.*', '2 / 2', 'Close this card', 'Session done', '1 card
  reviewed', 'Done'. If the redesign really wants new copy there, say so;
  the owner can re-approve the flows.
- Lessons from bugs already hit are in `skills.md` (index) and
  `docs/lessons.md` (full). Read the ones your area touches. Bottom sheets
  (#8), tap targets (#9), forms (#11) and grading (#12) matter for UI.

## Evidence (read before arguing)
- `baseline/`: fresh Simulator screenshots of every screen and state, light
  and dark, taken from the code currently in production (UI unchanged since
  the 1.0.0 build). The QA account has one card ('pomme'), so the screens
  are sparse.
- `../app-store-launch/screenshots/ss*.png`: populated screens from the
  production build (Nov 1) with real stickers: card, scene, review,
  collection, calendar, home.
- `../ux-polish-2026-10/FINDINGS.md`: the October UX sweep's findings. Many
  were fixed by the harness loop (the `.maestro/agent/*` flows show which).
- `prior/*.dc.html`: last week's design studies (palettes, depth, B
  direction, study card lab). They're HTML; read them as specs.
- The code: `app/`, `components/`, `constants/theme.ts`, `lib/review.ts`
  (scheduler).

## Output format for each team member (round 1)
Write `team/<role>.md`, at most ~900 words:
1. **The 5 biggest things that make it feel vibe-coded**, from your seat. Each
   one names the screenshot file and/or `file:line`.
2. **Your proposal**: concrete changes per tab (Collection, Calendar, Scan,
   Boards) plus study, card detail, onboarding and the cross-cutting system
   (type, colour, spacing, motion, haptics). Specific values beat adjectives.
3. **Rose or Powder**, and why, from your discipline.
4. **What you'd cut.** Features or chrome that should go or be hidden.
5. **Where you expect to disagree** with the other roles.
