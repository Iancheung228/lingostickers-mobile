# Interaction & Motion (iOS HIG), round 1

Tags: [JS] = JS-only/OTA, [NATIVE] = needs rebuild. Libraries present: reanimated 4.1, gesture-handler 2.28, expo-haptics, expo-image, screens 4.16, lucide icons. NOT present: expo-blur, expo-symbols, keyboard-controller, expo-glass-effect, Lottie/Skia.

## 1. Five biggest vibe-coded tells
1. **The Boards gear is dead because it is mis-placed, not mis-wired.** `app/(tabs)/wall.tsx:155` `emptySettings: {position:'absolute', top:0}` has no safe-area inset, so the 40pt disc sits under the status bar/battery (baseline/07a). Also: gear lives in 6 different hand-built headers (calendar.tsx:396, scan.tsx:944, BoardCarouselPage.tsx:428, HomeHeader.tsx:55, day/[date].tsx:101, wall.tsx:74), each differently sized and styled (white chip on one, bare on a band). Fix by one shared header, not by nudging.
2. **No navigation hierarchy, only custom chrome.** Every screen draws its own title row (02a "FOUND TODAY", 05a "The long view", 07a none, 08a custom back circle). No large titles, no native back-swipe affordance, no scroll-collapse. It reads as five apps.
3. **Floating pill tab bar sits on top of content** (02a, 04b ss4): it covers cards (bottom of 02a is a clipped card behind the pill), the pill is salmon on salmon band, active state is a white disc = same weight as the Scan disc, so two "selected" things compete. Scan is in the centre but is also a tab, so it has a selected state and a destination state.
4. **Modal vocabulary is inconsistent.** One custom BottomSheet (BottomSheet.tsx, SPRING damping 22/stiffness 260, EXIT 210ms), a hand-rolled PanResponder dismiss in StudyCard.tsx:348 (190ms timing), native `Alert.alert` for 61 call sites (06h: a system glass alert over a rose-branded screen says "Something went wrong on our side"), pageSheet for Profile? (it is `presentation: card`). Same gesture, four physics.
5. **Feedback is sparse and flat.** Haptics in ~20 files but tab press is the only one in the shell; grade buttons (04b) are four equal-weight rectangles with different *fill logic* (Again solid red, Hard outline, Good pale, Easy solid green) and no press scale; Toast is a 4000ms timer with no gesture; processing (06g) and error (06h) are a spinner and an OS alert; empty states (07a) are a floating icon + two CTAs ("New board" button AND a dashed "+ New" tile, both doing the same thing).

## 2. Proposal

### Navigation model (decision)
- **Keep 4 tabs, but make Scan a true centre action, not a tab.** Collection | Calendar | [Scan +] | Boards. Tapping Scan presents a full-screen modal (`presentation:'fullScreenModal'`, slide-up 380ms, ease-out cubic) with an X at top-left; it never has a "selected" state, so the bar shows only one active item. Gets the camera away from the tab stack (which keeps camera session alive) and gives scan->add a clean dismiss. [JS: expo-router route move + custom tabBarButton]
- **Replace the floating salmon pill with a standard-height bottom bar** (49pt + inset, hairline top border, content scrolls above it, `contentInset` bottom = bar height). Active tab = filled icon in action colour + 11pt label beneath; inactive = outlined icon in cap colour. Labels ON (serious learners and a11y; icon-only is the unthoughtful part). Centre Scan is a 52pt filled circle raised 10pt above the bar, 1 level of shadow. [JS]
- **Profile lives in ONE place: a 36pt avatar (initials) button, top-right of the Collection and Boards large-title headers; Calendar and Day get it too via the shared header.** Not a gear: it is "you + settings", avatar signals that. One `<ScreenHeader>` component owns safe-area, title, trailing slot. Delete all six bespoke gear placements. [JS]
- Profile = native `presentation:'formSheet'` / pageSheet with detents [0.6, 1] (SDK 54 / screens 4.16 support `sheetAllowedDetents`), grabber visible, swipe down dismisses. Today it's a pushed card with a custom back circle. [JS, verify on device]
- Large titles: Collection "Stickers", Calendar "Calendar", Boards "Boards", 34pt/bold collapsing to 17pt inline over 44pt of scroll (reanimated scroll handler, no layout jump). Drop band-header colour fill; gradient pageTop only behind the large title. [JS]

### Per tab
- **Collection**: header = large title + avatar; a "Due" row directly beneath as the one primary action (`Review 3 due · ~2 min`, full-width 52pt, spec'd below). Search becomes a pull-down search field (scroll reveals at top, native feel) replacing the icon. Sort/filter: single "Sort" control and filter chips stay; sort uses a native-style context menu (long-press not required: tap shows popover) [JS; true UIMenu = NATIVE via @expo/ui, skip]. Card long-press = lift (scale 1.03, 120ms) + haptic Medium, menu: Review, Favourite, Move, Delete (destructive in red). Press state on every card: scale 0.97, spring {damping:18, stiffness:400}, 90ms equivalent.
- **Calendar**: segmented control (Finds/Reviews) sits under the title as a real segmented control (thumb slides with spring {damping:20,stiffness:300}); gear removed. Day tap pushes Day screen with a shared date-cell->header transition only if cheap; otherwise standard push. Month swipe horizontal (pan, 250ms settle) in addition to chevrons.
- **Scan**: modal as above. Camera screen: shutter 72pt, haptic Medium on capture, 120ms white flash. Consent (06b) moves to first-run only, a sheet not a full page. Gallery/type-a-word as two secondary buttons flanking the shutter.
- **Boards**: empty state = one CTA only; delete the dashed "+ New" tile when empty. Rail "New" tile stays when boards exist. Board carousel page-snap with haptic Selection on settle.

### Study (the Anki-grade surface)
- Card flip: keep 3D flip but set 320ms (today FLIP_MS 420 is sluggish for 100-card sessions), `Easing.out(Easing.cubic)`; reduced-motion = 120ms crossfade (already honoured, StudyCard:747).
- **Grading gestures (opt-in default ON for back side only):** swipe left = Again, right = Good, up = Easy, down-stays = dismiss. Threshold 72pt or 600pt/s velocity; card follows finger with 8deg rotate max and a colour wash at the edge. Haptic: crossing threshold = Selection; commit = Light(Good/Easy) / Warning notification (Again). Buttons remain visible for discoverability and a11y, and carry the intervals (Maestro strings kept: "Good — next review in…" labels must remain in accessibility label). Replace vertical-swipe dismiss with a visible X + drag-down only on the front. [JS]
- Grade buttons: equal height 56, same weight, colours are the ramp red->amber->green->deep green; press scale 0.96; after commit, next card enters from right 260ms spring {damping:24,stiffness:300}, no fade-through-blank. Show an "Undo" snackbar for 5s (undo of last grade is expected by Anki users). [JS, scheduler undo needs a lib/review.ts change, no backend]
- Progress: thin 3pt bar under the nav row replacing "1 / 1" mono text.
- Session done: confetti is forbidden (serious learner); use a count-up of reviewed cards 600ms, haptic Success, and "Next due in 3h".

### Card detail / edit
- Detail opens from Collection with a **shared-element zoom of the sticker image** (reanimated shared transitions are experimental on 4.1: use a manual measure -> animate-clone, 340ms spring {damping:26,stiffness:220}); fallback standard modal. [JS, risky; stage 2]
- Close X on the left, share/download/delete collapse into a single ellipsis menu (3 icon discs in 04b is chrome); delete requires confirmation as a destructive action sheet.
- Edit sheets (03c): keep the BottomSheet but fix keyboard handling: sheet should translate with the keyboard (Keyboard.addListener 'keyboardWillChangeFrame', duration from event, animate `translateY` with the same duration/curve) rather than the keyboard covering a fixed-position sheet. `returnKeyType="done"` + submit on return; autofocus with 250ms delay after open settles. [JS]

### Onboarding / auth
- Sign-in is one screen with an inline mode switch; keyboard `KeyboardAvoidingView behavior="padding"` + `keyboardDismissMode="interactive"`; field order Email -> Password with `returnKeyType next/go` (Maestro strings kept: WELCOME BACK, Email, Password, Sign In, Not Now).

### Loading / empty / error states
- Scan processing (06g): replace spinner with a staged progress line (Uploading -> Finding -> Cutting out) using real step events, determinate bar 2pt, Cancel visible after 8s. 
- Errors: **no OS Alert for recoverable failures.** Inline error card in the screen with a Retry primary and a plain-language reason; 06h "Something went wrong on our side" becomes "Couldn't read that photo. Try again or type the word." with both buttons. Keep Alert only for destructive confirmation.
- Skeletons (shimmer 1200ms linear, 0.5->1 opacity) for list/grid first load; never a blank cream screen.
- Toast: add swipe-down dismiss, 3200ms default, 5000ms when it has an action, enter 220ms spring up, a11y live region. [JS]

### Motion + haptics system (one table, put in constants/motion.ts)
| token | value |
|---|---|
| press | scale 0.97, spring {damping:18,stiffness:400} |
| sheet in | spring {damping:22,stiffness:260} (existing, keep) |
| sheet out | timing 210ms, cubic-out (existing, keep) |
| push/pop | native stack default (350ms) |
| modal | 380ms ease-out cubic |
| flip | 320ms |
| fade | 160ms |
| tab switch | no animation, haptic Light only |
Haptics: Selection = picker/segment/chip/page settle/threshold cross; Light = tab press, favourite on/off, card commit Good/Easy; Medium = shutter, long-press lift; Success (notification) = sticker saved, session done; Warning = Again commit, destructive confirm; Error = failed scan only. Never haptic on scroll or on every keystroke. Respect `AccessibilityInfo.isReduceMotionEnabled` for all springs.

### Icons
Stay on lucide (consistent stroke 1.75, 24pt). SF Symbols would need expo-symbols = NATIVE rebuild and would clash with a Klee/Newsreader face; not worth it for v1.

## 3. Rose or Powder
**Powder**, from interaction: the peach action (#F2A27A) with navy ink is the only candidate where the primary button is clearly a different hue from selected/tint states; in Rose, action, header band, selected disc and tab bar are all the same family, which is exactly why the tab bar (03) and grade buttons (05) blur together. Confirm contrast by script (peach with #24406B ink, and any peach text on white fails: use navy for text). Dark mode must desaturate peach.

## 4. What I'd cut
- Six gear buttons; the salmon pill bar; "1 / 1" counter text; the dashed "+ New" tile in empty Boards; the "GOAL 5" label crowding the home header (move into Profile); Arrange button overlay on the hero wall (move to long-press/menu); share+download+trash discs on card detail; the OS Alerts for non-destructive errors; vertical-swipe-to-dismiss on a card whose back is scrollable (conflicts with scroll).

## 5. Expected disagreements
- **Visual/brand**: will want the pill bar and the tape/hero wall as signature; I say a standard bar and 1-level shadow; the hero wall is a Home-only flourish, not chrome.
- **Study/learning role**: may resist swipe grading as gimmick; mitigate: setting in Profile, buttons always shown.
- **Engineering**: scan as modal and formSheet profile need testing on-device; shared-element zoom is the first to drop.
- **Type**: large titles at 34pt need a UI face with tall x-height; Newsreader at that size is fine only for Collection.
- Maestro: all required strings preserved; scan route move changes tab accessibility labels ("Scan a new sticker" kept as button label).
