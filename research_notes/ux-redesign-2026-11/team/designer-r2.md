# Designer, round 2

## 1. Colour: Powder stands, with two concessions
- **Accessibility is right on ink.** I adopt navy ink **#1B3359** on peach (6.14:1, was 5.06) and on pressed #EE9769 (5.57, was 4.59, which failed). Plus a 1px #1B3359@24% edge on the primary button so it is a visible shape on the page (the fill alone is 1.98:1).
- **Learning's objection (peach near Again/Hard) is answered by the grade row, not by the palette.** Peach never appears there. Hard becomes **sand + 1.5px #8A5A00 border + navy ink** (not amber fill; peach vs amber is 1.31 in luminance, so I agree they would blur). Learning, check the row on a device; I will not move to Rose for this.
- **Blue Easy: yes, I concede.** Green Easy dies for 8% of men (ΔE 6). In Powder a mid-blue #2B6CB0 (white on it 5.42) reads as "calm, done", and navy chrome is darker and desaturated enough to not clash. The only collision is my focus/info blue #2F6FD0: I retire it. Focus ring = 2px navy #1B3359 with 2px page-colour gap; info = navy. Add accessibility's glyphs (arrow-counter / minus / check / double-check). In Rose a blue Easy would be the lone cool hue and look like a stray; another point for Powder.
- Dark mode is where Powder wins (peach 7.6 to 8.8 on navy), and Rose has no dark story anyone has defined.

## 2. Grading: one design for both
Four buttons, always visible, all four 56px, **Again and Good are the large pair (flex 1.3), Hard and Easy flex 1** and lighter in weight (Hard sand/border, Easy blue fill). Intervals 13px tabular. Swipe (left Again, right Good) is a progressive layer: on by default, colour wash plus haptic, never replaces buttons. I side with Learning over Interaction on up=Easy: rarer actions get a drawn control (lesson 9). Casual's "2 buttons" is served by the visual weight, not by removing intervals. Undo toast 5s.

## 3. Home, top to bottom
Title row (Collection + avatar) > **Due card** (number, "Start", ~min; collapses to a one-line "All caught up, next in 2h" when zero, so it never nags) > **Memory strip**: one horizontal row, 3 recent stickers big, with a single "On this day" tile when one exists (Casual's reason to open) > chips > grid. This ends the triple duplication. The hero wall goes to Boards. Serious gets Start in the first 200px; casual gets stickers in the next 200px. Critic-casual: the cutout pile is the pitch, so the strip uses E2 elevation and 96px stickers, not thumbnails.

## 4. Calendar
One screen, Casual's job first: month grid of **sticker-per-day** at 44px, tap = Day screen. The forecast is **not** the calendar's job: Learning's 14-day bar chart moves to a "Stats" row in Profile and its next-7 summary to the Home Due card. I disagree with Learning here; time-as-diary and time-as-forecast on one grid is exactly the "time appears twice" tell. Finds/Reviews segmented control stays (reviews tint intensity).

## 5. Navigation
No objection to Interaction. Labelled full-width bar, Scan as raised centre action opening a full-screen modal (no selected state), Profile via the avatar in the shared header. Condition: Profile as formSheet only if verified on device; else a normal push.

## 6. Study card, memory details
Review face carries only: sticker (photo-led), question, progress bar, the user's one-line note under the photo. The back shows a 56px thumb. Date, place and avatar live **one tap away**: tapping the thumb or the "…" menu opens the card detail sheet (same card component, memory fields plus edit/share/delete). Where unset, hide "Not recorded". I side with Learning on chrome and with Casual on the note: memory shown as content, not metadata.

**The single change that matters most:** replace the pink band, mono labels and floating pill with one shared system (Figtree + Powder tokens + one page header and tab bar) so all four tabs read as one product.
