# UX tester A (Mia, French beginner) — capture/create journey

Cards I created: (updated below)

### [UX] Home: first-run, nothing explains what to do
- where: Home (Collection tab) first impression
- saw: "0 FOUND TODAY", "1 due 1 min" pill, a pale wall with the app-icon placeholder sticker "pomme" (not a real photo), "Latest finds" showing "M Thu 29 DAY 1" card. Three stacked cards all showing the same sticker (wall, Latest finds, Latest stickers, plus a big card) = repetitive/heavy for a brand-new user. No "Scan your first sticker" prompt on home.
- evidence: A/home.png
- idea: when collection is tiny, show a single CTA ("Scan your first object") rather than 3 near-duplicate modules.

### [VISUAL] Home: floating tab bar covers content; category chips cropped
- where: Home bottom. Floating tab bar overlaps big sticker card (speaker/heart icons sit under it); "Study" chip is cut by the sort icon ("Study|" overlaps) and 'Nature' chip bounds extend off-screen (hier: x 339-413 > 402 width).
- evidence: A/home.png

### [UX] Scan: privacy consent gate - "Read the privacy policy" link sits under the tab bar
- where: Scan tab first run ("One quick thing")
- saw: consent text vertically centred with a huge empty top third; "Agree & Start Scanning" button is jammed directly above the floating tab bar; the "Read the privacy policy" link per hier is at y=783-796, i.e. behind the tab bar (toolbar y 770-832) => not visible/tappable. Tab bar remains usable so user can leave without agreeing (fine).
- evidence: A/s1.png
- idea: move policy link above the button.

### [UX] Scan camera screen on a no-camera device = black box with no explanation
- where: Scan tab. Black viewfinder, "Pinch to zoom · Tap frame to focus" shown even though no camera. (Simulator-only likely; ignore for real devices.) 
- Scan screen has NO way to type a word and make a card; no "type a word" entry found anywhere on Scan/Home (the "any word" feature only appears via the photo flow / scene prompts per code). Mia asked to "type a word" would not find it.
- evidence: A/s2.png
- idea: a "Type a word" button next to Gallery.

### [VISUAL] Extract Sticker crop screen: selected "Box" label unreadable; box exceeds the photo
- where: Gallery → pick photo → "Extract Sticker"
- saw: selected segmented pill "Box" has dark text on dark red (almost invisible) while unselected "Lasso" is high contrast. Photo is vertically off-centre with large empty band above; the crop box starts over the photo's top third and extends below the photo into empty cream area; corner handles are half cut off at screen edge.
- evidence: A/p1.png
- idea: fit the box to the image bounds; use light text on selected pill.

### [UX] "Extract Sticker" appears twice (screen title AND button) with identical VoiceOver label
- where: crop screen. Title 'Extract Sticker' and button 'Extract Sticker' are both labelled the same; also the title is a heading w/o role. Maestro tap on the text hit the title (nothing happened) first.
- idea: title "Pick the object" / button "Cut out".

## Run 1: gallery photo = pink/yellow flower field (library item #3, EXIF date 30 Mar 2018); Box left at default; Extract → "What else is here?" → picked un pétale + une plante → "Add 3 cards"
Cards I created (all prod QA account): **La fleur** (the flower, cutout sticker), **un pétale**, **une plante** (full-photo cards, scene).

### [BUG] New cards are dated by the PHOTO's date, not today: "30 Mar", "DAY 3136", sorted below old cards; "FOUND TODAY" stays 0
- where: Home after adding 3 cards (Latest finds chip "Fri 30 · DAY 3136", Latest stickers rows "30 Mar", grid)
- did: imported a 2018 photo, added 3 cards → Home header still says "0 FOUND TODAY"; the stickers show date "30 Mar" (today is 30 Oct, I think it's the photo's EXIF date, 30 Mar 2018); "Latest finds" says "Fri 30 DAY 3136" (nonsense day counter); the grid "Latest first" shows pomme (yesterday) ABOVE my brand-new cards.
- expected: created today → "just now", counts toward today's goal (GOAL 5), top of "Latest first".
- evidence: A/y1.png, A/z1.png
- idea: use created_at for display/sort/streak; keep photo date as metadata.

### [UX] No confirmation after "Add 3 cards": the sheet vanishes and you land on an empty black camera
- where: Discovery sheet → Add to Collection / Add N cards
- did: tapped Add 3 cards → screen straight back to the camera (A/x1.png); no toast, haptic text, count, "view in collection" link, nor indicator that 2 cards are still being made in the background. Mia has to guess and go to Collection tab and hunt for them (they appeared there within seconds).
- idea: toast "3 cards added · View" and stay-in-context badge on Collection tab.

### [UX] "Retry" next to "Add to Collection" is ambiguous; "More words from this photo" button duplicates the "MORE FROM THIS PHOTO" chips and does nothing visible when chips are already on screen
- evidence: A/t1.png, A/u1.png — tapped "More words from this photo" while chips were visible: no change, no feedback. When words are picked it turns into "2 more picked" (nice) but is still a button.
- idea: label Retry "Try another guess"/"Re-scan"; hide the button once chips are in view.

### [UX] Scene chips: unselected chips look disabled
- where: "What else is here?" results (un feuillage / un jardin): pale text on pale pill, same hue as disabled. Selected state is great (filled + tick) but unselected needs more contrast. Also "Tap the words you want as cards." hint is tiny/grey.
- evidence: A/w1.png

### [UX] Card display inconsistencies
- Title "La fleur" capitalised; "un pétale"/"une plante" lowercase with article; "pomme" has no article. Pronunciation: "[la flur]" / "[un pay-tal]" respelling vs pomme "[pɔm]" IPA. English "The flower" vs "a plant" vs "Apple" vs "Petal" (capitalised grid vs lowercase list). Mixed look.
- evidence: A/z1.png

### [VISUAL] Sticker cards for scene words show the whole photo (not a cutout), so "un pétale" and "une plante" are the same picture
- where: Collection grid. Understood by design ("each with its own copy of the photo") but the card gives no hint WHICH thing the word refers to; a beginner would not know what 'une plante' points at.
- idea: highlight region, or caption on the front.

## Positive
- Extract progress card ("Cutting out your sticker / Saving it to your collection / Looking up the word") is clear and reassuring; whole scan took ~15s in my run.
- Discovery sheet content is rich: word-by-word glosses, tip, audio, editable pencils. Scene chips return in ~1s. Selected chip state + CTA relabel "Add 3 cards" and "2 more picked" are clear.

## Run 2: gallery photo = breakfast table (library #2); Box dragged around cup+jar+bag; Extract
### [BUG/BLOCKER-ish] Extraction can hang 35s–2.5 min and then fail with "Extraction failed — This took too long and was cut off"; failed twice in a row on the same photo
- where: crop screen after Extract Sticker. Progress shows steps 1+2 ticked ("Cutting out…", "Saving it to your collection") and stuck on "Looking up the word" with amber text "The word service is busy right now — still going."
- did: attempt 1 failed after ~35-50s with alert; attempt 2 (same box) sat for ~2.5 minutes before the same alert. I could not leave while waiting: tapping the X ("Close without extracting a sticker") during the wait did NOTHING (no feedback, not even disabled-looking). code: scan.tsx:254 – no client-side timeout; the only exit is the server cutting off.
- The alert title "Extraction failed" is wrong (cut-out succeeded; the word lookup was what died) and gives no next step beyond "try again"; Mia loses 2+ minutes. Good: the box is kept so retry is one tap; no orphan sticker appeared in Collection.
- evidence: A/m1.png (slow msg), A/m2_4.png (alert), A/n10.png (still stuck at ~2 min), A/n12.png
- idea: client timeout ~25s with a "Still working… Cancel" button on the progress card; if cut-out succeeded but word failed, show the cut-out with a "Type the word yourself" fallback instead of throwing the work away.

### [VISUAL] During extraction the photo jumps up and the crop box detaches from it
- where: crop screen, progress card appears → image shifts up ~90px but the box/handles stay put, so the box now floats over blank space (A/m1.png vs A/l4.png). Looks broken.
- idea: hide handles/box (or dim) once processing starts.

### [UX] Box handles sit half off-screen at the screen edge and are hard to grab; box defaults to larger than the photo
- A quick short swipe on a handle did nothing; only a slow drag moved it (Maestro; real finger probably fine). Handles at x=0 / x=402 are clipped and conflict with the iOS edge gestures. The box can also be dragged outside the photo (A/l4.png) which makes no sense.
- idea: inset the box 16pt, clamp to the image.

### [UX] Lasso mode: no hint why Extract is greyed (A/l1.png) — the subtitle "Circle the object with your finger" is the only cue; Extract button disabled until a loop is drawn. Could not test drawing a lasso (tool limitation).

### [VISUAL] Segmented control: selected tab label ("Box"/"Lasso") is dark-on-red, nearly invisible (A/l1.png, A/p1.png).

## Run 3/4: waterfall portrait (library #5) and iceplant-with-yellow-flower (library #7)
### [BUG] Four of five scans failed after the first success — each hung 1.5–2.5 min on "Looking up the word" then alert "Extraction failed / This took too long and was cut off"
- Success: pink-flower field (~15s). Failures: breakfast table (x2), waterfall, iceplant flower. Could be backend load (4 testers on one account/Gemini) but the app experience is the point: Mia waits up to 2.5 min with a spinner, a grey X that does nothing, and then a wrong-titled alert. I stopped AI actions after this (≈8 of my 14 calls used).
- evidence: A/j9.png, A/h7.png, A/n12.png
- idea: see earlier (timeout + cancel + keep cut-out + manual word entry).

### [VISUAL] Portrait photos: bottom crop handles collide with the Extract Sticker button (A/k1.png: handles at y≈878 vs button top 883); during processing the box is still drawn around blank space (A/j6.png, A/h4.png).

### [UX] Scan header gear icon opens "My Profile" (settings), not camera settings; and the profile screen's top-right circle button is blank (no icon) (A/g1.png, A/s2.png). Profile copy "You've captured 4 watercolor memories so far. Keep it up! 🌸" — jargon "watercolor memories" odd for sticker app.

### [UX] Gallery picker: system picker re-opens at top with no marker of the previously used photos; fine, but a user re-scanning has no "recent" shortcut (IDEA).

### [IDEA] "Type a word → card" entry point is not discoverable
- The feature exists in create-card (lib/sceneCards.ts) and as "What would you say here?" / ask-your-own chip after a scan, but the Scan screen itself has no "Type a word" option and no way to make a card without a photo. Not tested typing (blocked by backend failures and no UI entry). 
- Also not tested (blocked): Discard, Retry button, "Ask your own" text input, "Say it like a local", lasso drawing, camera shutter.

## Summary of cards created
La fleur (the flower) [cutout], un pétale [petal], une plante [plant] — all from the pink flower-field library photo. No other cards created. Failed attempts left no orphan stickers.
