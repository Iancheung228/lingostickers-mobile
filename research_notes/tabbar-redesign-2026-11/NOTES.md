# Tab bar redesign: research notes (2026-11-14)

Design stage only; no app code changed. Open `index.html`. Mockups regenerate with `node src/gen.mjs` / `src/shoot.sh a b c d`, and the page with `node src/build-index.mjs`.

## Sources actually read (and what they gave)
- Apple HIG, Tab bars (https://developer.apple.com/design/human-interface-guidelines/tab-bars): page is JS-rendered; the fetch returned only the title. Nothing below is cited to it. Apple conventions used (outline to filled on selection, short labels, few tabs, sparing badges) are from general knowledge and are marked as such.
- WWDC25 session 323 notes (https://wwdcnotes.com/documentation/wwdc25-323-build-a-swiftui-app-with-the-new-design/): iOS 26 tab bar floats over content; `tabBarMinimizeBehavior` shrinks it on scroll; bottom accessory; separate search-tab role (the precedent for a separate bubble, used in direction D).
- Create with Swift, collapsing tab bar (https://www.createwithswift.com/making-the-tab-bar-collapse-while-scrolling/): minimise-on-scroll behaviour, re-expands on reverse scroll.
- Apple Developer Forums, "iOS 26 UITabBar size issue" (https://developer.apple.com/forums/thread/796299): reports the 83 pt bar as large on small devices. User report, not a spec.
- Babich, Bottom tab bar design (https://babich.biz/blog/bottom-tab-bar-design): iOS container 390 x 49, icon 25 x 25 (square glyphs 23), compact 18, label SF 10 pt Medium; argues actions such as "Create" do not belong in a tab bar (the owner has fixed the five slots, so this only informed D and A's choice of an inline, not raised, centre).
- UX Planet / UXD World bottom-tab guides (https://uxplanet.org/bottom-tab-bar-navigation-design-best-practices-48d46a3b0c36, https://uxdworld.com/2024/03/01/bottom-tab-bar-navigation-design-best-practices/): pair filled and outline icons; active state should combine colour with a non-colour change; 3-5 tabs; a raised centre button is the common pattern for apps with one create action.

## Not verified by sources (from my own knowledge, treat as informed opinion)
Searches did not return teardowns of Instagram, Threads, Duolingo, Airbnb, Pinterest, TikTok, Snapchat, Cash App, Revolut, Arc Search, Things or Bear. Statements about them in `index.html` (Instagram/TikTok inline create control, Duolingo and Airbnb tinted active state, icon sizes in the 24-26 pt range, labels hidden on image-led apps, no heavy shadows on strong apps) are recalled, not cited. Check them against the live apps before quoting them to anyone.

## Measurements from this repo
- Current bar: 68 pt pill, 14 pt disc overhang, 30 pt floor (`constants/tabBar.ts`); 32 pt gradient fade above (`_layout.tsx`); e2 shadow 24 blur / 0.20 (`constants/theme.ts`).
- Contrast (WCAG, computed): terra on blush 2.72; terra on cream 5.31; #85666A on cream 4.67 and on #FFFCF7 5.00; maroon on blush 5.03; #7A383E on blush 4.00 (fails AA for 11 pt text, one reason C was dropped); inkLight on cream 5.76.
- Installed (package.json): react-native-svg 15.12.1, react-native-reanimated ~4.1.1, react-native-safe-area-context ~5.6.0, expo-haptics. Not installed: expo-blur (needed for any real glass), so mockups use opaque fills.
- Fonts: Newsreader 400/500, JetBrains Mono 500/700 (from @expo-google-fonts); copied to `fonts/` for the mockups.

## Mockup method
Backdrops are the repo's real screenshots (`research_notes/ux-redesign-2026-11/final/01, 11, 13, 15`) scaled to 393 pt wide and cropped above the old bar; the area under the cut is page cream. The 4th frame's extra cards are cropped copies of real card pixels to show content scrolling behind the bar. Frame is 393 x 852 with a 134 x 5 home indicator; screenshots are 2x.

## Round 2 (2026-11-14)
The owner rejected round 1 (docked, cream, split, quiet) and asked to keep the floating rose pill with the distinctive raised camera. `index.html` is now round 2 (R1 same bar done right, R2 ringless disc + tinted capsule, R3 crest silhouette); round 1 is `v1.html`. Round 2 is a design exercise on the repo's own screenshots and code, with no new external sources. Contrast figures were computed (WCAG): #5A2429 on #EBAEAF 6.5, on #E09A9B 5.4; #3A1519 on #E4A0A1 7.6; cream on #662B31 9.8; terra on blush 2.7. Regenerate with `node src/gen2.mjs` (or `src/shoot2.sh 1 2 3`) then `node src/build-v2.mjs`.

## Round 3 (2026-11-14)
The owner chose R3 Crest. `v3.html` is the final polish (geometry, surface, centre piece, indicator, label study, motion, spec); `v3-motion.html` is a spring demo. Crest curvature continuity was measured numerically (see `src/geom.mjs`, `src/probe.mjs`) and shown with curvature combs. Contrast: white on #92454A 6.6:1; #3A1519 on #E4A0A1 7.6:1. react-native-svg 15.12.1 exports FeDropShadow/FeGaussianBlur (checked in node_modules); filter rendering on device is NOT verified. Icons plug in through `src/icons-slot.mjs`; regenerate everything with `src/render-all.sh`.
Round 3b: the icon artist's set (icons-v3/icons.json) is integrated into all round-3 mockups via src/icons-slot.mjs. Changes by the bar designer: Profile head/bust enlarged (ink 98 to 111), knockout re-sampled to #E5A1A2, badge offset to slot centre + 9, camera at 26 pt. Measure glyph ink with `node src/ink.mjs`.
Round 3c (2026-11-14): after an independent image-only critic (CRITIC-v3.md), the bar was flattened (pill = colors.blush, disc = colors.blushDeep), the slot pitch set to 64, the active indicator removed, a cream badge and a 28 pt cream fade added, the crest widened to about +-47. Everything is in v3.html; regenerate with src/render-all.sh. Final icons: icons-v3/icons.json (artist) with the Profile tweak noted in meta.changes.
