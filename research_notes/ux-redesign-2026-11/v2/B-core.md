# Pass B: the core loop, every interaction

Within A-card.md and A-app.md. **JS-only** unless tagged **[NATIVE]**. RM = Reduce Motion, DT = Dynamic Type, VO = VoiceOver. Maestro strings are unchanged.

## 0. Shared rules

- **Motion.** Press: scale 0.97 in 80ms, release spring {18/400}. Sheet in: existing spring (22/260); out: 210ms. Flip: 220ms out-cubic. Swipe commit: 180ms. Cross-fade: 150ms. **RM:** no translate, scale, rotate or flip. Use 120ms opacity fades or instant. One `useReduceMotion()` hook (the code StudyCard already has) used by every file below. Today only StudyCard honours RM.
- **Haptics.** `selection` = choosing or crossing a threshold. `Light` = a normal commit. `Rigid` = Again. `Success` = saved or session ended. `Error` = a failure needing action. None on scroll, flip-back or toast show. No UI sounds. TTS is the only audio.
- **Toast v2** replaces non-destructive `Alert.alert`. It sits above the tab bar and above the grade row, one at a time (a new one replaces the old). 4s by default, **6s for Undo**, paused while touched, swipe-down dismisses, action target 44pt. With VO on: 10s, and Undo is also a custom action on the screen.
- **Errors.** A failure the user must act on becomes an inline card with a primary recovery, and the input is kept. `Alert.alert` is for destructive confirms only. Never show `error.message` (lesson #3).
- **Offline.** No detection exists today. JS-side: a network failure sets `offline=true`, and the next success clears it. Banner "You're offline" under the safe area. `@react-native-community/netinfo` is cleaner **[NATIVE unless already in the dev client; check]**. Study works offline: grades go to an AsyncStorage queue that flushes in order on reconnect or foreground. Scan, type-a-word and scene prompts need the network.
- **Interruption.** Backgrounded: stop TTS and playback, and stop recording but keep a take over 0.5s. In-flight scans continue. A call or Siri stops audio, with no auto-resume. Returning after 30+ min mid-session leaves you on the same card, front face.
- **Double-tap.** Every committing control sets a ref lock before its first await. Ignored taps give no haptic.

## 1. Scan (camera)

| Interaction | Response |
|---|---|
| First open, camera unasked | Pre-prompt over a dim camera: "Tabi needs your camera to turn what you see into a card." "Continue" opens the system prompt. "Choose from photos" is secondary. |
| Camera denied | "Camera is off. Turn it on in Settings, or pick a photo." Buttons "Open Settings" and "Choose from photos". |
| AI consent not given | Bottom sheet over the live camera, after the camera permission. Same copy, "Agree & Start Scanning" (kept), Success haptic. It gates the feature, so the scrim doesn't dismiss it. "Not now" returns to Collection. |
| First-run hint | One coach mark below the frame, "Tap to focus. Pinch to zoom." Fades at 4s or on first touch. The title sits in the top safe area and never touches the frame. |
| Tap the frame | Focus ring 64pt, 1.3→1 over 200ms, fades at 800ms. |
| Pinch | Linear zoom. A "1.0x" pill fades 600ms after release. |
| Shutter | Scale 0.9 for 80ms. White flash 0→0.7→0 in 160ms (RM: a 120ms dim). Freeze on the frame. `Medium`. A second tap is ignored (the `capturing` ref). |
| Gallery | `PHPicker`, which needs no permission. Cancel is silent. |
| Type a word | A labelled button beside the shutter opens `TypeWordSheet` with the keyboard up. Offline: "Look up" is disabled and the hint reads "Needs a connection." |
| Backgrounded | Camera pauses. On return, hold the last frame 300ms so there is no black flash. |
| Offline capture | The shutter works, because cutting is on-device. Failure is handled at save (section 2). |

VO: shutter is "Take photo". The frame is hidden from VO. DT: the shutter/gallery/type row is a fixed band, and the type label wraps to two lines. Past DT XL it becomes icon plus an 11pt label.

## 2. Pick the object and processing

| Interaction | Spec |
|---|---|
| Open | Photo scales 0.96→1 in 200ms. Title "Pick the object". One-time line "Draw around it, or tap Lasso for tricky shapes." |
| Draw | 2pt hairline. `selection` at stroke start, `Light` when closed. |
| Make sticker | Disabled until a selection exists, with the hint "Draw around the object first". Press: `Light` and lock. 150ms cross-fade into ScanProgress in place. |
| Retake | Top-left, no confirm (nothing saved). |

**ScanProgress.** The three stages stay ("Cutting out your sticker", "Saving it to your collection", "Looking up the word"). Checks pop 0.8→1 in 160ms with `selection` (RM: instant). "Cancel" is visible from 0s. Cancel aborts via `scanAbortRef` and returns to Pick with the selection kept, with no alert.

| Elapsed in a stage | Copy |
|---|---|
| >5s | "Taking longer than usual. Still going." (existing) |
| >15s | "This is slow. Your photo is safe." Buttons "Keep waiting" and "Cancel". |
| 45s | Hard timeout: the error card. |

| Error | Copy | Recovery |
|---|---|---|
| Cutout fails | "Couldn't cut that out." | "Try again", "Pick the object again", "Use the whole photo" |
| Offline at save | "You're offline. Your photo is kept." | "Try again" (also fires on reconnect if still open) |
| Lookup busy or timed out | "The word service is busy. Your sticker is safe." | "Try again", **"Type the word instead"** (the cutout is carried over) |
| Nothing recognised | "We couldn't tell what this is." | "Pick the object again", "Type the word instead" |
| Blocked or invalid | "That photo couldn't be used. Try a different one." | "Retake" |
| Daily limit (429) | "You've used today's scans. They reset tomorrow." | "OK" |

Every error: one `Error` haptic, VO announces the title, and focus moves to the first button. If a scan finishes while the app is backgrounded, go straight to the reveal on return.

## 3. Result: scene picker and new-card reveal

| Interaction | Spec |
|---|---|
| Open | Existing slide-up. GhostCutoutReveal lands the sticker (`Success`). Word, reading, meaning and sentence fade in at 60ms stagger (RM: together). First scan only: "You'll see this photo and be asked the word." |
| Speaker | `Light`. A second tap stops playback. |
| Scene chip | `selection`, scale 1→1.04 spring, plus a check glyph (colour is never the only signal). The Add count cross-fades 120ms: "Add 3 cards". |
| Chips loading | "Looking at your photo…". >5s adds "Still looking". >15s: "Taking a while. You can add the card now." **Add is never blocked by the extras.** |
| Chips fail or empty | Existing "Try again" and "Nothing for that one in this photo. Try another question." (kept). |
| Edit word or sentence | Debounce 400ms and sequence-ticket (lesson #11). `returnKeyType=done`. Blur is not done (lesson #10), so the draft is keyed to the card. Text fades to 0.5 while retranslating. |
| Retry | Locks 1s. Rewrites in place. |
| **Add** | `Light`, spinner, lock. On success: `Success`. The sticker shrinks toward the Collection tab icon in 320ms in-cubic (RM: fade). Camera shows toast "Added 3 cards. View · Scan another". "View" opens the new card's detail. |
| Add fails | Draft stays. Inline above the button: "Couldn't save. Try again." Offline: "You're offline. Your card is kept here." `Error`. |
| **Discard** | **No confirm.** Dismiss, toast "Discarded. Undo" 6s, with the draft held in memory. (Replaces the "Discard this discovery?" alert, which obstructs the common wrong-photo case.) Android back and swipe-down take the same path. |
| App killed with a draft | The draft is persisted (AsyncStorage) on each change. Next Scan open: "Pick up where you left off? 'pomme'." Buttons "Continue" and "Discard". |

VO order: word, reading, meaning, sentence, chips (`accessibilityState.selected`), Add. DT: Add is pinned outside the scroll, min 52pt, text may take two lines.

## 4. Study session

### Start and front

| State | Spec |
|---|---|
| Start | The Home pill and Calendar both call one `buildQueue()`. Full-screen modal, 300ms slide. 'Start reviewing — 1 card due.*' stays on the pill. No spinner (the queue is in memory). |
| Nothing due | The pill reads "All caught up. Next due in 3h" and "Study ahead" builds the next 20 cards, with the banner "Studying ahead". Check that scheduling doesn't penalise early reviews before shipping the copy. |
| Photo slow | Same cache key as lists (lesson #17), so it is warm. If it is still loading at 2s, keep the thumbnail and show a 24pt spinner in the corner. Reveal is never blocked. |
| Photo failed | Neutral tile with an image-off glyph, and the card degrades to the meaning-only front. |
| Hint | Tap = `selection`. The tier text replaces the pill with a 150ms fade. Disabled at the last tier. No grading penalty. |
| Reveal target | The whole card (the front has no other taps, lesson #9), plus a 56pt "Tap to reveal" bar. |

### Reveal

| Item | Spec |
|---|---|
| Flip | Rotate-Y 0→90 in 110ms, swap, 90→0 in 110ms (220ms total). `Light` at the swap. The grade row rises 8pt and fades in over 160ms, starting at 120ms. RM: instant swap, 120ms fade. |
| Autoplay TTS | 150ms after the swap, once per reveal (setting, default on). **Not** with VO running (it collides) and not on silent (`playsInSilentMode: false`). It stops on flip, grade or close. Verify on a real phone. |
| Guards | Taps are ignored during the flip. Grade buttons are inert for 250ms after reveal, so a double-tap on reveal can never grade. |
| Flip back | Tap empty back area. 220ms, no haptic. Grading doesn't need you to stay flipped. |
| Sentence translation | Tap to show, 150ms fade, `selection`, stays shown for this card. |
| "More" | 200ms height ease. The grade row is pinned, and the body scrolls at DT. |
| Memory line | Opens detail as a sheet **over** the session. Closing returns to the same face. |

### Grade

| Item | Spec |
|---|---|
| Buttons | Per A-card section 4. Hard and Easy at ~12% are narrow: give them a 44pt-wide minimum with a stacked glyph and label, and `gap >= left slop + right slop` (lesson #9). At DT XL the row becomes 2×2, Again and Good on top. Press: 0.97 scale, `Rigid` for Again, `Light` otherwise. |
| Commit | Card exits 24pt toward the grade side and fades in 180ms. The next front enters from 0.97 scale in 200ms. RM: 120ms cross-fade. |
| Lock | `gradingRef` per card id. First press wins. |
| Write | Optimistic. Failure retries at 1s/3s/9s, then goes to the local queue, with no mid-session alert. The summary shows "2 reviews are waiting to sync" if any remain. |
| **Swipe** | Back face only (the front owns pull-down-to-close). `Gesture.Pan` on the UI thread, replacing `PanResponder`. Activates at 12pt horizontal with |dx| > 1.5·|dy|, and fails on vertical scroll. The card tracks 1:1 and rotates up to 6°. A wash and glyph grow from the edge (Again left, Good right) at opacity min(|dx|/96,1)·0.6. Crossing 96pt or `vx` > 0.6 fires `selection` once (again on re-crossing). Release past = commit. Release before = spring back {20/300}, no haptic. Needs `GestureHandlerRootView` inside any Modal (lesson #8). |
| Simple mode | "Not yet" and "Got it", 56pt, full width. Swipe unchanged. |
| **Undo** | After every grade: toast "Graded Good. Undo" for 6s. Undo restores the card's pre-grade fields (local and DB, or cancels the queued write), moves the cursor back, and shows that card's **back** with the grade row live, so a mis-tap is one tap to fix. Depth 1. If the last grade ended the session, Undo reopens it. `Light`. |
| VO | The card has custom actions: Again, Hard, Good, Easy, Undo. Labels keep "Good — next review in …". After each grade, announce "Card 2 of 5". |
| Requeue | Existing host logic (due-time order, never immediately next). Front shows "Still learning. One more look" (kept). "n / m" counts unique cards ('2 / 2' kept). The 2px bar fills on a card's first grade only. |
| Bury siblings | Remaining cards sharing a `scene_id` leave this queue. Summary line: "3 related cards saved for tomorrow". |

### Close and end

| Item | Spec |
|---|---|
| Close | X ('Close this card') or pull down on the front (existing distance/velocity rule, now worklet-driven). **No confirm**, since grades are saved. If any were graded, the summary opens with "Stopped early". If none, go straight back. Flush the write queue without blocking the animation. |
| Summary | 200ms scale-in, `Success` once. "Session done" only when the queue emptied. "1 card reviewed" (plural "5 cards reviewed"). Then "Next card in 10m" or "Tomorrow: 8 due". Then the to-revisit words as 44pt rows (tap opens detail). "Study 5 more" is a text button. "Done" is the single filled button. A live Undo toast stays above it. |
| App killed | No resume. Every grade is saved, so the next queue is the rest of the same session. |

## 5. Card detail

| Interaction | Spec |
|---|---|
| Open | Opens on the **answer**. 250ms scale-fade from 0.96 (no native shared-element transition in this stack). Photo uses the list cache key, then cross-fades 150ms to full size. "Test me" flips to the quiz view with the same 220ms flip. |
| Edit a field | Tap the field (no competing tap, lesson #9). Tint 80ms. `FieldEditor` sheet follows lesson #8: scrim, drag, Cancel, VO-escape all go through one guard that asks "Discard changes?" only when dirty. Save: `Success`, same glide out as cancel, field fades 150ms. Keep "Update the sentence too?". |
| Edit fails | Sheet stays. Under the field: "Couldn't save. Your edit is still here." Offline: "You're offline. We'll save this when you're back." (queued). |
| "…" menu | Action sheet: Favourite, Share, Save to Photos, Remove from board, Reset progress, Delete card (destructive, last). Opens in 180ms. |
| Favourite | Heart 1→1.25→1 spring, `Light`, optimistic, revert with a toast on failure. |
| Reset progress | Confirm: "Reset progress for 'pomme'? It comes back as a new card." Then toast "Progress reset. Undo". |
| **Delete** | The action sheet item is the confirm (as A specifies). Card collapses in 200ms. Toast "Card deleted. Undo" 6s on the parent. The server delete (row and storage files) is **deferred** until the toast expires, the app backgrounds, or the screen unmounts, whichever is first. Flush it, never drop it, or Undo lies. Undo re-inserts at the same position. Offline: queued. Not offered in a study session. |
| **Compare** | A "Compare" button beside the mic. Plays TTS, a 400ms gap, then your take, with a two-segment progress bar. Disabled with "Record a take first" until a take exists. A second tap stops. VO: "Compare your recording with the native voice". |
| Hold to record | Starts after a 150ms hold (a plain tap pulses "Hold to record"). `Medium` at start, `Light` at stop. Under 0.4s is discarded: "Too short. Hold a bit longer." Auto-stops at 15s. Level ring pulses (RM: static dot). |
| Mic denied | "Mic is off. Turn it on in Settings." with an "Open Settings" link. Compare is unavailable. |
| Interrupted | Stop, keep a take over 0.5s, toast "Recording stopped". |
| Save fails | Take stays in memory: "Couldn't save your recording. Try again." |
| New card, no reviews | Progress block reads "Not reviewed yet", not zeros. |

DT: one scroll column; a sticky header (the "…" and "Test me") grows with text size. VO: a field reads "Meaning, apple. Edit, button."

## 6. First-run and empty

| State | Spec |
|---|---|
| Empty Collection | One card: "Scan your first sticker" with the camera button. |
| First session | A line over the first grade row: "Again = see it soon. Good = you knew it." Fades on first tap. |
| After the first finished session | One sheet: "Simpler grading?" with "Not yet / Got it" and "Keep four buttons". |
| After the first Add | Offer the daily reminder in the toast flow, not a modal. |

## 7. Flags for the owner or builder

1. Undo of a card delete is only real if the deferred delete is flushed on background and unmount.
2. Discard drops its confirm for a 6s undo. This departs from the alert pattern in A-app.
3. **A's undo can't work as written.** "The host re-inserts the card at the cursor" is ambiguous once a card has been requeued twice. Undo must store a `{cards, index, seen, stats}` snapshot.
4. Autoplay and the silent switch need a real-phone check.
5. NetInfo is the only possible **[NATIVE]** item. The JS fallback is specified.
6. The "Studying ahead" copy needs a scheduler check first.
