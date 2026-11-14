# Calendar reimagined — build spec (Nov 14 2026)

Source: owner's reference video of a sticker-diary calendar on a foldable
("iPhone Duo"). Feature teardown with clips:
https://claude.ai/artifact/SMnVJygncF3qAV4wjjQQQ1 — reference frames in `./ref/`.
The owner scoped in the five "high fit" features (#1, #2, #4, #5, #6). The
reference is a wide foldable; **Tabi ships on normal iPhones** (design width
390pt, must hold at 375pt and up to 440pt). Adapt, don't copy.

## Fixed constraints (do not relitigate)

- **Keep the production Rose look.** Cream `colors.sky` screen, `RoseBand`
  header, white month card with `e1`. No dark chrome, no side toolbar. Only
  tokens from `constants/theme.ts` (`npm run lint` rejects raw hex).
- **Keep the floating rose pill tab bar** untouched.
- Motion only through `lib/motion.ts` (`useMotion()`, `dur`, `ease`, `spring`).
  Under Reduce Motion: no rotation/translation, opacity fades ≤120 ms.
- Expo SDK 54 / reanimated as installed. Check versioned docs before new APIs.
- Sticker images: `listImagePath()` + `useSignedUrls` batch + `cacheKey`
  (skills.md #17). Never one sign request per cell.
- Keep existing testIDs working: `calendar-prev-month`, `calendar-next-month`,
  `calendar-day-YYYY-MM-DD`, `calendar-selected-day`, `calendar-review-cta`.
  `.maestro/*.yaml` (top level) are human-approved — never edit. Flows in
  `.maestro/agent/` may be updated if a deliberate change breaks them.
- Keep: selected-day summary row → `/day/[date]`, the "Review N now" CTA,
  `StudySessionHost`, pending-delete filtering, error/retry, review dot.
- No backend changes. All data already loads (every sticker of the user).

## Feature 1 — The sticker is the day (month grid)

- Sticker becomes the main thing in the cell: image box ≈ 82% of column
  width (≈36–38pt at 390pt), date number small above it (mono 11–12).
  Cell height grows to fit (≈ number 16 + sticker + 6 for the review dot);
  derive from column width, not a hard-coded 58.
- Days with several finds: show the first (as today) — a11y label keeps the
  count.
- Selected day: keep a clear selected state, but lighter than the current
  full terra-bordered box so it doesn't fight big stickers (e.g. terraLight
  rounded fill behind the cell, no heavy border). Today stays distinct.
- Sticker keeps `stickerShadow` (lifted look). No new die-cut border (that
  was feature #7, out of scope).
- Dropped from the reference: lunar/second date line (too cramped at 45pt).

## Feature 6 — Today, the empty slot, the future

- Today's number: filled `terra` circle with white digits (already exists;
  keep).
- Today with no find: a dashed `terra` circle the size of a sticker with a
  "+" inside. Tapping it opens Scan (`router.push('/(tabs)/scan')` or the
  existing navigation used elsewhere — check). testID
  `calendar-today-add`, a11y "Add today's sticker", role button. Tapping the
  rest of the cell still selects the day. Respect skills.md #9 (two actions on
  one surface: the "+" is the drawn control; hitSlop budget).
- Future days (after today): number at reduced emphasis (`inkFaint` is
  decoration-only, so use opacity on `inkLight` or similar that still meets
  3:1 for large-ish text — reviewer will check contrast); not selectable is
  NOT required, keep them tappable.

## Feature 2 — Year view

- A `Month | Year` segmented control at the top of the card (replacing
  nothing; the month header with chevrons stays in Month mode). testIDs
  `calendar-mode-month`, `calendar-mode-year`. Default Month.
- Year mode: card header "2026" with year chevrons
  (`calendar-prev-year` / `calendar-next-year`), then a 3-column × 4-row grid
  of mini months (phone adaptation of the reference's 3×4).
- Mini month: label ("Jan") above a 7-col tiny grid. Day with a find → a tiny
  sticker (≈ col width, ~11–13pt); day without → tiny mono number in
  `inkLight` at ~7–8pt. So busy months become a sticker mosaic, empty months
  stay a number grid. Current month label in `terra`; the month currently
  shown in Month mode sits on a `terraLight` rounded tile.
- Tap a mini month → switch to Month mode on that month, and its stickers
  cascade in (feature 5). testID `calendar-year-month-YYYY-MM`, a11y e.g.
  "October 2026, 23 stickers".
- Performance: one signed-URL batch for the whole year's day-icons; mini
  stickers use the same thumbnail path/cacheKey; memoise mini months.
  Up to ~365 small images must scroll/render without jank.
- Mosaics fade in (≤ dur.slow) when the year view mounts; no per-sticker flip
  in the year view (too many, too small).

## Feature 4 — Flip-in reveal

- Each month-grid sticker enters by rotating about Y from ~80° to 0° with
  perspective (~600), scaling 0.9→1, and fading a light overlay /
  opacity so edge-on reads pale and face-on reads full colour (the reference's
  "catching the light"). Per sticker ≈ 280 ms, `ease` out with slight
  overshoot via `spring` acceptable.
- Stagger in date order, ≈ 22 ms apart → a 31-day month fills in ≈ 1 s.
- Runs: on first load of the screen (once data is in), and on every month
  change (feature 5). Does NOT replay on refocus refetch, on selecting a day,
  or when data refreshes for the same month.
- Reduce Motion: all stickers fade in together, 120 ms, no rotation.
- Implemented on the UI thread (reanimated shared values / `withDelay`),
  one reusable component, e.g. `components/calendar/FlipSticker.tsx`.
- Light haptic? No — only the existing select haptic on month change.

## Feature 5 — Month switch: clear, then cascade

- Swipe and chevrons keep moving the date grid (existing slide), but the
  neighbour pages render **dates only, no stickers**. When the new month
  commits, its stickers flip in (feature 4). This is the reference's
  "dates swap, stickers cascade".
- Tapping a mini month in Year mode does the same (no slide; the month card
  swaps mode, then the cascade).
- A month change mid-cascade cancels the old cascade cleanly (no stale
  stickers, no stuck half-rotated stickers).

## Done means

- `npm run typecheck`, `npm run lint`, `npm test` pass.
- Visual verification on the Simulator via the `qa-tester` subagent with a
  new flow `.maestro/agent/calendar-reimagine.yaml` (month grid with big
  stickers, today "+" opens Scan, Year mode shows mosaics, tapping a mini
  month returns to that month), plus the existing calendar flows in
  `.maestro/agent/` still pass (`r4-calendar-tour`, `r5-calendar-check`,
  `ux-tour-calendar-boards-profile`, `a11y-selected-state`, `tap-targets`
  if they touch the calendar). Screenshots of light and dark if the app has
  a dark mode in use (`ux-tour-dark-tabs`).
- No commits — the owner decides. Leave changes in the working tree on
  branch `feature/calendar-reimagine`.
