# 10: The Jobs lens on Tabi Stickers

An advisor's read, using Steve Jobs' product philosophy as the filter: focus means saying no; start from the experience and work back to the technology; it should fit in one sentence; craft the parts nobody sees; "it just works."

Grounded in 01_inventory.md, 02_anki_painpoints.md, 03_competitors.md, 04_aesthetics.md, plus direct reads of `app/(tabs)/scan.tsx` (`handleAdd` :646), `app/(tabs)/collection.tsx`, and `lib/review.ts` (`NEW_CARD_REST_DAYS`, `dueAtMs`). Nothing was run on a device.

---

## The diagnosis in one paragraph

Tabi has an engine that's better than the app around it. The hard, invisible work is world-class: a promptable on-device Vision cutout, a syllabus-steered sentence about *your* scene, a gloss that gets validated before it's shown, and an Anki-grade scheduler with minute-level learning steps. Around that engine, though, the product has grown sideways. There are five tabs. The home screen shows the same stickers **five ways at once** (`HomeHeader`, `MiniStickerWall`, `FeedRail`, `LatestStickers`, and the grid, all in one FlatList in `collection.tsx`). There are three separate "diary" surfaces (home wall, Boards, calendar Finds). And the two loops that matter, *find* and *remember*, are joined only by a due count that changes overnight. When you tap Add, `handleAdd` clears the draft and leaves you on the camera. The sticker you just made disappears. The best moment in the app ends with nothing happening.

CapWords won an Apple Design Award for the first half of that loop. Tabi can't beat them at "photo becomes a cute word." It has to beat them at **what happens to that word over the next month of your life.**

---

## 1. The one-sentence product

> **Tabi is a travel notebook that learns your new language from your own life, and makes sure you never forget a page of it.**

A shorter App Store version: **"Your life, in the language you're learning. Remembered."**

**How it is not "CapWords with friends":**

| | CapWords | Tabi |
|---|---|---|
| The unit | An **object**: a word, like a Pokédex entry | A **moment**: this cup, on this desk, in this neighbourhood, on this date, in a sentence about it, in your own voice |
| The organizing idea | A collection, sorted by category | A notebook, sorted by **time and place** |
| What it asks of you | "Collect them all" | "Keep living. We'll keep the pages." |
| Depth | One word plus an example | A sentence written for *your* photo, a word-by-word gloss, a grammar target picked for your level, real SRS |
| Who it respects | Casual and kid learners | The adult who quit Anki because it was ugly and impersonal |

Friends are **not** the differentiator. They're a feature, and for a launch with about 200 users, most people will have zero friends in the app. The differentiator is that **every card is a memory, and the memory is the mnemonic.** CapWords' card would be identical if a stranger took the photo. Tabi's card can only be yours.

---

## 2. The value proposition and the magic moment

**The single most valuable promise:** *you don't make flashcards anymore; you live, and the cards make themselves, and they're beautiful, and they come back exactly when you're about to forget.* Anki users' top pains are making the cards, cards that feel impersonal, and an ugly UI (02). Tabi removes all three in one gesture.

### The 10 seconds you'd show a friend

> You're at a cluttered café table. You point at it and **tap the matcha latte**. Just the latte lifts off the photo and peels up as a sticker with a soft paper sound. It flips over: **抹茶ラテ · matcha rate**, said aloud, with a sentence about *this* latte "next to the window" and each word underlined with its meaning. You tap Add and the sticker **slaps onto today's page** of your notebook, beside a little ink stamp reading 下北沢 · 10.29.

Three beats: **choose** (I picked *that* one, not whatever was most eye-catching), **peel** (a physical delight), and **it's mine** (the sentence and the stamp describe my moment). A clone can copy the second beat. It can't copy the first and third without Tabi's engine.

### Is it happening today? Partly. Here's where it breaks

1. **"Choose" only exists on the slow path.** Live capture skips selection (`handleCapture` :552) and lets Vision pick the dominant object, which is CapWords' behaviour. The lasso, the thing that actually differentiates Tabi (skills.md #6), is hidden behind Gallery → pick → mode switch → Extract. The best idea in the codebase sits four taps deep.
2. **There's no first-run.** A new account lands on an empty home screen whose wall, rail, feed and grid all need content, with the line "Tap the Scan tab to discover your first word!" The first camera use opens with a consent wall. The magic moment is something you have to go looking for.
3. **"Add" leads nowhere.** The sticker vanishes, you're back on a live viewfinder, and nothing confirms where it went. That's the opposite of a slap.
4. **The card isn't due until tomorrow.** `NEW_CARD_REST_DAYS = 1`, and `handleAdd` writes no `due_at`, so `dueAtMs` falls back to tomorrow at midnight. The app has a beautiful 1m/10m learning ladder (skills.md #12) that a new card can't enter on the day you made it. The comment's reasoning ("asking immediately measures nothing") is right about *seconds* and wrong about the *end of the session*. A 2-minute "before you go" quiz of today's finds is exactly the generation and retrieval moment that turns a cute sticker into a learned word (Carpenter & Olson: pictures only win once you force retrieval, see 02 §5).
5. **There's no way back tomorrow.** There are no local reminders (`scheduleNotificationAsync` appears nowhere). The only thing that can pull a user back is a friend's push, and most users won't have a friend in the app.
6. **The wait can be 10-20 s at worst**, and a failure there is a system `Alert`. The magic is fragile exactly where it has to hold up.

---

## 3. What to cut or hide before launch

The rule: **one notebook, one camera.** Anything that isn't a page in the notebook or the act of filling one is either cut, hidden behind a flag, or turned into a verb on the card.

| Feature | Verdict | Why |
|---|---|---|
| **5-tab bar** | **Cut to 2 destinations plus the shutter.** Bold version: no tab bar. A notebook screen with one big shutter button, like a camera app. Safe version: `Notebook · [Scan] · Friends`, with Friends hidden until you have one | Five tabs tells a new user there are five products to learn. There's one. |
| **Home wall (`MiniStickerWall`, `HomeWallEditor`, `home_stickers`, background cropper)** | **Cut** (keep the table, hide the UI) | It's a third, manual scrapbook on top of Boards and the calendar, and it needs content a new user doesn't have. The notebook page *is* the wall. |
| **FeedRail + LatestStickers + grid on the home screen** | **Collapse into one view: the notebook, newest page first** | Four lists of the same rows on one screen is a decision you haven't made yet. |
| **Boards tab** | **Hide behind a flag for 1.0, and reuse its engine** | Boards ask you to do layout work. Most users won't. But `lib/boardLayout.ts` (seeded scatter) plus the drag canvas is exactly what's needed to **auto-compose each day's notebook page**, which you can then nudge. Same engine, no extra chore. User-made boards return in 1.1 as "albums" (e.g. "Kyoto trip") if retention data asks for them. |
| **Calendar tab** | **Fold into the notebook** as its "long view" (pinch out from day pages to the month grid) | It's a different zoom on the same notebook, not a destination. The Reviews mode can't show history anyway (no review log is stored). Keep Finds, drop the Reviews segment. |
| **Friends tab + inbox** | **Demote from place to verb.** "Send as a postcard" on any card. An incoming challenge shows up as a postcard on top of your notebook. The friend list moves to Profile | An empty tab for nearly every day-one user is a dead room in the house. The challenge mechanic is good (it's the only social loop in the category), but it's an *action you take with a page*, not somewhere you go. |
| **Wall display / cutout border settings** | **Cut from Profile** | Pick the best one and ship it. Settings are design decisions you've handed to the user. |
| **Daily goal "5"** | **Cut the number** | A hard-coded goal with no streak and no setting is a quiet guilt meter. Replace it with the day page filling up. |
| **"Retry Extraction"** | **Rename and merge into the reveal** ("Not this one? Tap another") | That's the choose gesture again, just after the fact. |
| **Search** | Keep, but put it in the notebook's pull-down | Fine as it is. Not a v1 priority. |
| **Android, iOS 15/16 server-cutout path** | **Don't market it.** Ship iOS 17+ as the experience | The promptable cutout is the product. The server rembg fallback gives the CapWords-grade answer to the wrong question (skills.md #6). |

What survives is: **Camera → Reveal → Notebook → Review → (Postcard).** That's the whole app, and you can explain it in one breath.

---

## 4. Make these insanely great before launch (in order)

### 1. The first sixty seconds: onboarding *is* the first sticker
> You open Tabi for the first time. You don't see a form. You see a cream page that says *"Point at something near you."* and a viewfinder. You tap your coffee mug and it peels off the world. **マグカップ.** The app says it for you. Only then: *"Keep this page? Make your notebook."* You type a username and your sticker is already there on page one, stamped with today's date.

- Sign-up comes *after* the first sticker (Supabase anonymous auth, then link the email identity on save). If that's too much for 1.0, at least make sign-up's last step open straight onto the camera with a single coach line, and put the AI consent *inside* that moment ("Tabi sends this photo to Google Gemini to write your card. OK?"), styled as a page in the notebook rather than a wall.
- Language choice is one question with three big flags/scripts, not a field.
- Fix the record first: Groq and Aptabase must be in the consent list and privacy policy (01 §7). A beautiful first minute that's dishonest about where photos go isn't craft.

### 2. Capture: choose, peel, slap
> You point at the café table. A soft outline breathes around each thing Vision can see. You **tap the latte**. (One object in frame? It just lifts on its own.) It peels off with a paper *tchk*, the word types itself onto the back, and when you hit Add the sticker **flies down and slaps onto today's page** with a rigid haptic. You see exactly where it went, and the camera is ready again.

- Bring instance selection to the live path: a tap gives a tiny "box" prompt to the existing `SubjectSegmenter` scoring. Keep the scoring thresholds in TS (skills.md #6). Long-press (not tap) to focus, if you still need focus at all.
- Make the wait *feel* like craft: the stages in `ScanProgress` become the sticker being cut out along a dotted line. Every failure becomes an in-world card ("The light's too low for a clean cut. Try once more?"), never `Alert.alert`.
- Charge quota for **saved** stickers, not attempts (keep a hidden abuse cap on attempts). Charging users for the app's own misfires is a toll on the magic moment.
- Build `lib/feel.ts` (04 §3): one haptic-plus-sound vocabulary of about 8 real paper and stamp foley sounds. This is the cheapest "it feels alive" upgrade available, and it's JS-only.

### 3. The card: prettier than any Anki card ever made
> You flip a card. It isn't a form. It's a **specimen label**: the word huge in Newsreader, then `№ 0142 · NOUN · 名詞 / collected 29 Oct · Shimokitazawa` in mono like a museum tag, your sentence with its gloss underneath, and your own voice as a little tape label. Cards you've known for a month have a **thin gold-foil edge** that catches the light when you tilt the phone. The card you keep forgetting has a strip of washi tape, mended rather than failed.

- Specimen-label face (04 4.7) and stable seeded hand-placed tilt: S effort, huge payoff.
- Material maturity (kraft → ink stamps per successful review → foil at 21 d interval): the founder's "prettier Anki cards" wish, expressed as *progress you can see*, and tied to effort, never to chance.
- Fix the small lies: front says WHERE, back says SHOT AT for the same field. Pick one ("FOUND AT").
- A "from Mika" postmark on any card won through a challenge (the data already exists in `origin_author_id`).

### 4. The return: tomorrow comes to you
> You close the camera after three finds. A small card slides up: *"Before you go: what was this?"* It's your latte, word hidden. You get it. That evening, nothing. The next morning, one notification with **your own sticker in it**: *"抹茶ラテ? · 3 cards · about 1 minute."* You open it, flip three cards, and the session ends with **one rubber-stamp *kachunk*** on today's page. No streak, no flame, no guilt.

- Let a new card enter the 1m/10m ladder on the day it's found, as an end-of-capture pocket quiz (or schedule its first step at +10 min so `StudySessionHost`'s learn-ahead picks it up). The ladder already exists. Let it run.
- Local notifications (expo-notifications is already installed; local scheduling is JS): **one per day, at most**, at a time the user chose, showing their own image. Ask for permission *after* the first finished review, when the value is obvious.
- Debt-proofing (02 §3): never show "487 due". Show "~12 min". Cap daily reviews and put the most at-risk cards first. A fun capture loop creates review debt by default, and debt is the #1 reason people quit SRS.
- The stamp replaces any confetti. Forgiving streaks (days with a stamp) at most.

### 5. The notebook: a page per day, composing itself
> You open Tabi and you're on today's page: your three stickers scattered as if you'd stuck them yourself, a station-style stamp of where you were, and the date in the corner. Swipe back: yesterday. Pinch out: October, every day a tiny thumbnail of its stickers. Some mornings the top of the page reads *"A year ago today: 傘, Kyoto."*

- One screen replaces `HomeHeader`/wall/rail/latest/grid/calendar/boards. The review ribbon ("3 cards · 1 min") is the only header.
- The auto-layout reuses `boardLayout.ts`. You can drag to nudge, and that's all the arranging the app ever asks of you.
- Empty state for page one: a dotted die-cut outline saying *"your first sticker goes here,"* not a paragraph.
- On This Day, with "Hide this memory" (04 5.1).

**The craft nobody sees, which has to be right anyway:** the storage orphans from abandoned drafts (add a GC job); product analytics events (sign-up, scan, save, first review, day-2 return), because right now nobody can tell whether the magic works; crash reporting; an app-wide AI spend ceiling. None of these show up in a screenshot. All of them decide whether launch day "just works."

---

## 5. One more thing: **The Ekiben Stamp / Tabi Passport**

> *"Every place you learn a word, Tabi makes you a stamp."*

In Japan, every train station has its own rubber stamp (eki stamp): the station's name, a local landmark, a date, inked by travellers into a little book. **Tabi gives every place you learn a word its own eki stamp, designed for you, in the language you're learning.**

> You find your first word in your own neighbourhood in Brooklyn. A rubber stamp drops onto the page: a circle of slightly uneven ink, **ブルックリン** around the rim, the date, and in the centre the *silhouette of your actual sticker*, the mug you just photographed, pressed in ink. Your home street has just become a Japanese railway station. Fly to Lyon and your stamps say *Lyon* with a French postmark style. Learning Cantonese in Vancouver? 溫哥華, in a Hong Kong MTR tile style.

Why this is the one:
- **It's the name.** *Tabi* means journey. The stamp turns everyday life into a journey and turns the notebook into a **passport of where you learned your language.** CapWords' collection is a Pokédex. Tabi's is a passport.
- **It's uncopyable without the engine.** It needs the on-device instance mask (the silhouette), the location and date already stored per sticker, and the LLM rendering your place name in the target script. It's made of Tabi's own data.
- **It's the shareable artifact** that Finch and Locket grew on (03 §5): "my October in Japanese," a page of stamps, exported 9:16 for Stories. Every share is an ad that says *this is about your life*.
- **It's what Apple editors feature**: a first-party framework showcase (Vision instance masks, MapKit reverse geocoding, sensor-lit ink), rooted in a real cultural tradition, with taste. Pitch it in the featuring nomination.
- **Effort**: M. Stamp frames as SVG (3 styles, one per language), the silhouette from the existing cutout alpha rendered as flat ink via `react-native-svg`, place names from one small `translate-word`-style call cached per place, and coarse place names only (privacy: never on shared postcards unless opted in). No native build needed.

Postcards (challenges reframed as "send a page to a friend") are the natural sequel in 1.1: a postcard is a stamped thing you send from somewhere.

---

## 6. Launch day definition

### v1.0 must include (and nothing else)
1. **Two destinations, one shutter**: the Notebook (day pages + month view) and the Camera. Friends reachable only as a "Send as postcard" action plus an inbox card that appears on the notebook when something arrives. Boards, home wall, calendar tab, display settings hidden behind flags.
2. **First-run = first sticker**, with honest, in-world AI consent that names every processor actually used (Gemini; Groq if the fallback stays on; Replicate/remove.bg), and the privacy policy updated (including Aptabase).
3. **Live tap-to-choose capture** → peel → reveal → **slap onto today's page**. In-world error cards, no system Alerts on the main path. Quota counts saves, not attempts.
4. **The specimen-label card** with consistent copy, and the voice tape label.
5. **Same-day learning**: the before-you-go quiz, so a new card enters the 1m/10m ladder today. One daily local reminder showing your own sticker. Kind debt framing plus a review cap. Stamp at session end.
6. **Eki stamps on day pages** (the one more thing), in its simplest form: one stamp per new place per day.
7. **The invisible launch gates**: app icon, product analytics funnel (at least 10 events), crash reporting (bundle it into the one pre-launch build; ask before running it), app-wide AI spend ceiling, storage orphan cleanup, and a soft cap of about 5-10 saved stickers/day. **Free at launch**, labelled a founding edition, so retention data is collected before any paywall is designed. Never gate reviews.

### Waits for 1.1 (or later)
- **Postcards**, the full social layer (challenges re-skinned, push, and an App Clip so a non-user can answer a postcard: that's the growth loop).
- **Card maturity foil with tilt shimmer** (the kraft and stamp stages can ship in 1.0 if time allows; foil with masked shimmer may need a native dependency, so batch it with the widget build).
- **Albums** (Boards reborn, user-curated trips) if users ask.
- **Home-screen widget** ("today's sticker" / "a postcard from Mika"): needs a native target, so an EAS build.
- **Passport page** (all stamps collected) and a 9:16 shareable month spread.
- **On This Day** (needs a year of data anyway, so it's naturally a later feature).
- Handwriting on cards, voice then-vs-now, production/listening review modes, paywall (≈$3.99/mo, $24.99/yr, lifetime option, per 03 §3), Android.

### Things to say no to, out loud
More languages. AI conversation partners (CapWords' v2.0. Let them have it.). Gamified XP, rarity or loot. Themes before the default is perfect. A web app. Every one of these is a good idea. That's exactly why they're dangerous.

---

**Closing thought.** The engineering in this repo already earns the right to a great product. The hard parts nobody sees are done: the promptable cutout, the validated gloss, the honest scheduler. What's missing is the discipline to make the *visible* product as single-minded as the invisible one. Ship one notebook, one camera, one stamp. Then make the moment you tap Add the best two seconds on anyone's phone that day.
