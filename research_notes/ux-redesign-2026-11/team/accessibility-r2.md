# Accessibility, round 2 (measured: scratchpad/r2.py; ΔE76 normal/deuteranopia/protanopia)

## 1. Colour: I change my vote to Powder
New measurement that moves me. In Rose the primary action `#9D4D51` vs Again `#A8434A` is ΔE 9 / 5 / 3: the same colour. Learning is right, and it is worse than "too close"; under CVD the Rose primary button and the Again button are indistinguishable. Darkening Again to `#8F2F3A` only gets ΔE 12/8/10. The brief's Rose cannot keep "brand colour out of the ramp" (lessons #12) because the brand colour is red.

Powder peach `#F2A27A` vs Again `#A8434A`: ΔE 39/33/39; vs Hard sand 40/32/31; vs Good tint 53/47/42. So learning's worry (peach too close to Again/Hard) does not hold. Peach is separated by lightness (L* ~76 vs ~40) and survives CVD.

**Blue Easy `#2B6CB0` (white text 5.42):**
- vs peach ΔE 83/88/72; vs Again 71/67/49 (green Easy today: 7 deuteranopia). It settles the ramp.
- Against Powder chrome: vs head navy `#24406B` only ΔE 23 (contrast 1.92), vs sand/pageTop ΔE 61-64. It is related but not confusable, because navy is text and selection ink while Easy is a filled button. Rule: **in Powder, Easy is the only mid-blue fill; selected/active states use navy or peach, never `#2B6CB0`**. Don't use the Easy blue for links.
- In Rose, blue is a cool outlier (ΔE 63 from action). Acceptable but another argument for Powder.
- Alternatives fail: teal `#17707A` collapses to ΔE 20 for protanopia; green `#3F6E46` to 7.

**Powder action rules (final):** fill `#F2A27A`, ink `#1B3359` (6.14), ring `#C4602F` (4.0 on page) only on the lone primary on a light page; white never. Dark: peach on card `#18233A` is 7.63, ink `#1B2336` on peach 7.63. Dark ramp: Again `#E5737A` (5.27 on card), Easy `#6FA8E8` (6.30), ΔE 71/62/45.

## 2. Grading
4 buttons, Hard and Easy secondary (designer/critic-casual: "Hard 6m" is homework). Accessible version: Again and Good carry weight; Hard/Easy are outlined with the 3:1 border (Hard border `#7A5A1E` 6.35, not `#A9803E`). Swipe is an extra path only. VoiceOver cannot swipe-grade, so the four buttons must stay present, labelled "Again — next review in 1 minute", and swipe actions exposed as `accessibilityActions`. Undo needs an announcement. Interaction: agreed on undo; disagree if swipe replaces the buttons.

## 3. Home order
Due card first with N due and Start (learning), then the sticker pile (casual); duplicates cut. Words: "7 stickers want a hello" is fine only if the Start button carries the count in its label (Maestro 'Start reviewing — 1 card due.*').

## 4. Calendar
Forecast and diary on one screen fail on size: tiny dots plus bars can't carry both. Put the forecast in Profile/Stats and a Home line ("Tomorrow: 7"). Calendar = diary, with a sticker per day and "on this day". Day cells need VoiceOver labels ("14 November, 3 stickers, 2 due").

## 5. Navigation
Labelled tab bar: strongly agree (icon-only fails; labels at >=11 semi-bold, cap 4.5:1). Scan as full-screen modal: fine, give it an X of 44pt and a spoken name. Avatar top-right: 44pt visual, label "Profile". No objection.

## 6. Study card
Strip share/delete from review (learning is right; also removes a destructive tap-slip target for motor-impaired users). The memory lives behind one "Memory" row on the back, below the sentence, with the user note as a one-line peek. The front stays photo plus prompt. Reduced motion: flip is a 160ms fade (already built).

**Single change that matters most:** one token layer with real dark mode and a 4.5:1-checked Powder palette, applied everywhere, so every screen shares one contrast-safe voice.
