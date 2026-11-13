# Serious learner (Anki, 4 years, FSRS-literate): blunt critique

## What screamed "vibe-coded"
1. **Three typefaces fighting.** Serif headings, serif body, and spaced uppercase monospace labels on everything: `ss1-card.png` has "FRENCH / NEW CARD / WORD / SAY IT / MEANS · NOUN / IN USE / WORD BY WORD" all in tracked mono caps. Eleven labels on one card, and the word itself is the only thing I need. It looks like a theme, not a hierarchy.
2. **The gloss is mono, too.** `ss4-collection.png` and `ss6-home.png` set "[luh krwah-sahn] · The croissant" in monospace at the same size as the heading's sibling. The meaning, the thing I'm learning, is the least readable line.
3. **Decoration with no job.** `ss6-home.png`: a pink wall of stickers with a "new" badge and "Arrange" button, "GOAL 5", "0 FOUND TODAY" as the biggest number on screen, and "Latest finds" plus "Latest stickers" plus the grid below, three lists of the same cards. `08a-profile-top.png`: "Welcome back to your cozy corner! ... Keep it up! (flower emoji)" is a placeholder-grade string.
4. **Dead space and broken edges.** `05a-calendar-month.png`: a huge empty white card under a month with one thumbnail; `07a-boards-empty.png`: the settings gear collides with the status bar, and the "New" tile sits stranded at the bottom. `ss4-collection.png`: the floating pink nav pill covers the card content, and the "Animal" chip is clipped mid-word next to the sort pill.
5. **Raw system UI leaking.** `06h-scan-result-server-error.png`: a default iOS alert, "Something went wrong on our side", over the crop screen, and the "Box" segment label is dark red on dark red (illegible). `03a-card-detail-front.png`: a 600px blue icon in a card with a giant blank gap and a "What did you call this?" prompt pinned to the bottom.

## Where I'd quit
- **Day one, review #1.** I scan a croissant and it won't be due for a day ("17h ago... 7 due"). Fine. But in `ss3-review.png` the back of the card is a wall: word, IPA-ish respelling, meaning, a full sentence, word-by-word gloss, and a grammar tip. Anki's cards are one glance. I'd quit if every review costs a scroll and a read.
- **Grading.** `ss3-review.png` shows Again 1m / Hard 6m / Good 10m / Easy 4d. I accept that: it's Anki's defaults, and `lib/review.ts` is SM-2 with 1m/10m steps, 2.5 ease. But it is SM-2, not FSRS. I'm used to ~90% retention targeting. No retention setting means this is a downgrade on scheduling.
- **Pronunciation as the "say it" row.** English-reading respelling "[luh krwah-sahn]" for French is a crutch; for Cantonese or Japanese it will be wrong or useless. I'd quit if I can't turn it off.
- **The mic button.** "Hold the mic to record your pronunciation" with no feedback on whether I was right is a toy.
- **No deck/tag/browse power.** I see a category chip row and a heart. No search by field, no suspend, no leech handling, no export. If I can't get my data out, I never get my data in.

## What would make me move daily reviews here
- A review front that's the photo plus one prompt, with the answer a single tap. One screen, four buttons, no scroll.
- Tell me my retention, my intervals and a real forecast (the calendar's "Reviews" toggle could be it, as a heatmap/forecast, not a floating empty month).
- Cards that I made from my own photos, with the sentence mined from the photo's context (`ss2-scene.png` "Tap the words you want as cards" is genuinely the good idea: picking verser/boire/manger from a scene). That's the pitch. Protect it.
- Edit any field, any time. Undo last grade. Sibling burying (the same photo spawning 3 cards).
- Export (.apkg/CSV), and a clear "your scheduling is X" statement.

## What I'd never want added
Streak flames, XP, leaderboards, mascots, confetti on Good, "cozy" copy, emoji in system strings, daily-goal guilt, a Friends tab, animated sticker walls on the home screen, or sound effects. Haptics on grade is fine. Animation longer than ~200ms on a grade is a tax.

## Rose vs Powder
I'd stare at this 20 minutes a day, at night. **Powder.** Rose's whole page is warm pink (`ss5-calendar.png` header #E2A0A0-ish) plus the dark rose cap text at lowish contrast (the captions in `ss1-card.png` are faint pink-on-white); pink grading buttons near "Again" red muddle the red/green ramp. Powder's cool neutral reads as a tool, makes red/green grades unmistakable, and in dark mode blue-grey sits better than maroon. The peach action with navy ink is the one thing I'd check for contrast. Condition: don't let it become a baby-blue theme; keep the sat low.

## Where I'd disagree with a "make it cute and delightful" designer (brief section 5)
- Delight must never sit between me and the next card. Every cute flourish on the study screen is rent I pay 100 times a day.
- Customisation is a fine substitute for a physical metaphor, but only if it's in Profile, not on the home screen.
- Home should be: "N due" and a Start button, then the collection. Not a sticker wall first.
- Empty states and onboarding can be warm; the review loop and card edit should be plain, dense and quiet.
- Serif for the target-language word is right (the Klee One / Iansui decision); the chrome should be one sans, quiet, and sentence case. Kill the tracked mono caps.
