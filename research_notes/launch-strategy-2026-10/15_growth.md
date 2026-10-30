# 15: Growth and launch plan for Tabi Stickers

Written 2026-10-29 from the point of view of an indie iOS growth and launch lead.
Inputs: `01_inventory.md` (code-grounded inventory), `03_competitors.md`, `04_aesthetics.md`, `app.json`, `docs/index.html`, and the memory notes on the provider bake-off (measured cost per scan). A few web checks were done for subreddit rules, Apple featuring lead times and RevenueCat benchmarks (sources at the end).
Target: about **200 new users a month** at first, from a solo founder with no paid acquisition budget.

**Where the facts come from.** Facts about the product (events, quotas, deep links, cost per scan) come from the inventory, from code I read directly, and from measured memory notes. Benchmarks are third-party and directional. Target rates are my judgment, set to be checked against real data, not taken from anything published.

---

## 0. The thesis

CapWords has already won the "photo of an object becomes a sticker word" pitch. It has an Apple Design Award and roughly 15 clones. If Tabi leads with that pitch, three things follow: it reads as clone #16 to App Review (4.3(b)), to Apple's editors and to users, and it gets compared on CapWords' terms.

Tabi should lead with **three things nobody in the category has**:

1. **People**, through friend challenges.
2. **A diary of your own life**, through the calendar and boards.
3. **Cantonese with real depth**: Jyutping, a sentence written about *your* photo, a word-by-word gloss and a grammar syllabus.

The sticker is how you capture a word, not what you are buying. The landing page already says it best: *"It's a keepsake more than a lesson."*

For the first 1,000 users, the wedge is **Cantonese heritage learners**. A **Japan-trip** audience follows as the volume channel. v1 launches **without a paywall**, but with RevenueCat wired in and a grandfathering promise.

Before any growth push there are four gates, all from the inventory:
- product analytics
- an app-wide AI spend ceiling
- correct consent and privacy disclosures (Groq, Aptabase)
- crash reporting

Without the analytics, the 30 days below produce no learning. Without the disclosures, the launch can be rejected or pulled.

---

## 1. Positioning and ASO

### 1.1 Name (30 characters) and subtitle (30 characters)

**Rule:** keep "Words" out of the name. CapWords, StickWords, PicWords, Heywords, Cakeword and WordsLeap all use it. A name in that family is the cheapest way to look like 4.3(b) spam, and it also lands you in the same search results as everyone else.

| # | App name (≤30) | Len | Subtitle (≤30) | Len | Notes |
|---|---|---|---|---|---|
| **A (recommended)** | **Tabi Stickers: Word Diary** | 25 | **Japanese, French & Cantonese** | 28 | "Diary" claims the memory angle. The subtitle spends its characters on three high-intent language keywords, one of which (Cantonese) has almost no photo-vocab competition |
| B | Tabi Stickers: Word Diary | 25 | Vocab diary, quiz your friends | 30 | Leads with the social angle. Weaker on keywords, since the language names move into the keyword field |
| C | Tabi: Photo Vocabulary Diary | 28 | Japanese, French & Cantonese | 28 | Best for keywords ("photo vocabulary"), but it gives up the "Tabi Stickers" brand the domain and landing page already use |

Use A. Run C's wording as a Product Page Optimization test later. You need roughly 1k+ page views per arm for a test to mean anything, so this is a month 3+ activity.

Two checks before submission:
- Confirm "Tabi Stickers" is available as an App Store name. Names are unique per storefront.
- Use the same name across the store, the landing page and the icon caption.

### 1.2 Keyword field (100 characters)

Apple combines words across the name, subtitle and keyword field, so do not repeat any of them (tabi, stickers, word, diary, japanese, french, cantonese). Use commas with no spaces, singular forms (Apple matches plurals) and no competitor trademarks. "Anki" and "CapWords" in keywords is a guideline 2.3.7 rejection risk.

```
vocabulary,flashcard,learn,jyutping,romaji,kanji,photo,camera,picture,srs,travel,japan,quiz,hk
```
94 characters. The remaining 6 are free for testing (for example `kana`, `canto`, `trip`).

Reasoning:
- `jyutping`, `romaji`, `kanji` and `hk` are low-competition terms with high intent.
- `photo`, `camera` and `picture` combined with "vocabulary" or "flashcard" catch the photo-vocab searches where CapWords and the clones rank.
- `travel`, `japan` and `trip` catch the Japan-trip planner.
- `quiz` combined with "friends" from the description covers the social angle.

Two extra keyword slots:
- The US storefront is widely reported (ASO community, not Apple-documented) to also index the **Spanish (Mexico)** localization. That gives a second 100-character keyword set, for example `cantonese,lesson,chinese,hongkong,language,study,memory,journal,widget,sticker`. Treat this as a cheap experiment, not a certainty.
- Add **English (UK)**, **English (Australia)** and **English (Canada)** localizations with the same text. These are the main HK diaspora storefronts (BN(O) migration to the UK, Vancouver, Toronto, Sydney), and each gets its own keyword field.
- **French (Canada)** is worth a localized subtitle only if Montreal becomes a channel (see §2). The app UI is English only, so do not oversell it.

### 1.3 Category

- **Primary: Education.** This is the editors who featured CapWords, the expected shelf, and the highest-converting category for subscriptions later.
- **Secondary: Travel.** It reinforces the trip angle and the "Tabi" name, and there is far less competition in Travel's search and browse for a vocab app.
- Not Photo & Video, which invites comparison with built-in subject lift, and never Kids. Kids would ban third-party analytics and AI calls (guideline 1.3), and the app has UGC between friends.

### 1.4 Screenshot storyboard (8 frames, 6.9" iPhone)

Design them in the app's own world (cream paper, rose accent, Newsreader headlines, JetBrains Mono labels). Show real photos of real places, not stock. Each caption is one line of 4 to 7 words with an optional mono sub-label.

The **first three frames carry about 90% of the conversion**, so they must make the differentiators obvious without tapping.

| # | Visual | Caption (headline / mono sub-label) | Why here |
|---|---|---|---|
| 1 | Calendar "Finds" month view, each day showing a die-cut sticker (an HK egg tart, a Kyoto umbrella, a café croissant). One day is lifted, showing the card | **A word diary of your days** / `ONE PHOTO · ONE WORD · EVERY DAY` | Opens on the diary, not the camera. This frame alone separates Tabi from every CapWords screenshot set |
| 2 | Split frame: a friend's challenge card (the photo, "___ 喺枱面度", "Can you guess it?") and the "You got it!" postcard flip | **Send a word. Can they guess it?** / `CHALLENGE YOUR FRIENDS` | The thing nobody in the category has |
| 3 | Study card back: 蛋撻 / daan6 taat1, a sentence about *this* photo, word-by-word gloss chips, the insight note | **A real sentence about your photo** / `WORD BY WORD · GRAMMAR THAT BUILDS` | Answers the "limited depth" complaint against CapWords |
| 4 | Lasso being drawn round a mug on a cluttered table, scissors at the tip, the cutout lifting | **Circle exactly what you mean** / `CUT OUT ON YOUR PHONE` | The capture moment, framed as precision. It also signals the on-device Vision work to editors |
| 5 | Review session: the card front, then the grading row (1m / 6m / 10m / 4d) | **Reviews timed to your memory** / `SPACED REPETITION, DONE PROPERLY` | For serious learners and Anki refugees |
| 6 | Board: a cork or photo background, "Osaka, Oct" board with 12 stickers scattered | **Pin a trip to a board** / `YOUR JOURNEY, IN STICKERS` | The trip and keepsake angle. Also the shareable-artifact preview |
| 7 | Three cards side by side: 雨傘 (Jyutping) · 傘 (romaji) · le parapluie (respelling) | **Cantonese, Japanese, French** / `JYUTPING · ROMAJI · SAY-IT RESPELLING` | Readings are a cited CapWords gap (no romaji). Cantonese is unique |
| 8 | Press-and-hold mic on the card, your waveform beside the TTS speaker | **Hear it. Say it. Keep your voice** / `RECORD YOURSELF, HEAR YOUR PROGRESS` | Personal touch |

Per-storefront ordering:
- **HK, UK, CA and AU** storefronts: move frame 7, re-captioned "Real spoken Cantonese, with Jyutping", up to frame 2.
- **JP-interest** (en-US is enough): keep the default order.

Add an **App Preview video** (15 to 25 s): shutter → ghost-cutout crossfade → card → sent as a challenge → friend's "You got it!" → month calendar. It autoplays muted, so it needs captions burned in.

### 1.5 Avoiding 4.3(b): what to put where

4.3(b) decisions are made on the binary and the metadata a reviewer sees in a few minutes. Make the differentiators visible in those minutes:

1. **Demo account with a social graph.** Make a reviewer account (not `maestro-qa`) pre-seeded with:
   - about 25 stickers across 3 languages over 3+ weeks (so the calendar is full)
   - 2 boards
   - one accepted friend
   - **one pending challenge waiting in the inbox**

   Without it, a reviewer signs up, sees an empty Collection, scans one mug and sees "CapWords".
2. **App Review notes**, in about 5 lines:
   - what is original (on-device Vision instance selection with lasso, the syllabus-steered sentence and gloss, friend challenges, the calendar diary, Cantonese)
   - where to find each one with the demo account
   - the AI processors and the consent screen
3. **Description structure:**
   - **Opening paragraph:** the diary and friends, then depth and Cantonese.
   - **Feature bullets**, in this order: challenges, diary/calendar, sentence plus gloss plus grammar, real SRS, lasso cutout, three languages with readings, voice recording.
   - **Do not open with "Turn objects into stickers."**
4. **Icon:** no camera-plus-sticker-peel tropes, which the clones use. The pending icon study (memory: "Eight Marks, One Rim") should go with the stamp, passport or notebook metaphor from `04_aesthetics.md`, not a camera.
5. **Fix the product gap the reviewer will hit:** the empty first run (§3.2). An empty state is the moment a product looks most like a template.

---

## 2. Wedge audience for the first 1,000 users

### 2.1 Options scored

| Wedge | Size of reachable niche | Competition in photo-vocab | Fit with Tabi's unique features | Community reachability for a solo founder | Willingness to pay | Verdict |
|---|---|---|---|---|---|---|
| **Cantonese heritage learners** (diaspora kids of HK and Guangdong families in UK, CA, US, AU; partners of Cantonese speakers) | Medium (tens of thousands of active learners in English-language communities) | **None found** | **Highest.** Challenges between cousins, partners and parents; diary of "words grandma uses"; Jyutping; written colloquial Cantonese | High: r/Cantonese, Cantonese Discords, #learncantonese TikTok, HK diaspora groups | Medium-high (identity-driven, underserved, used to paying tutors) | **Primary wedge** |
| **Japan-trip planners** (pre-trip and in-trip) | Very large and seasonal (cherry blossom Mar–Apr, autumn leaves Nov) | **Heavy** (CapWords and most clones do Japanese) | High for the diary and boards ("my Kyoto trip"), medium for SRS (trip intent decays after the trip) | Medium: r/JapanTravel bans promotion; TikTok #japantravel is huge but noisy | Low-medium (a one-off trip) | **Secondary, volume channel**, from month 2 |
| **Committed Japanese learners** (Anki/WaniKani users) | Large | Heavy | Medium (they want depth; sentence plus gloss helps; image→word only is thin for them) | r/LearnJapanese (Wednesday self-promo thread only), Discord (EJLX) | **High** (Bunpro lifetime $150) | Tertiary. Good payers, harsh critics. Approach once review modes are richer |
| **Studygram / langblr aesthetic learners** | Medium | Medium | High for boards, stickers and the paper aesthetic | High on IG/TikTok, but content-heavy | Medium | **Content style, not a segment.** Shoot all content in this register whichever wedge it targets |
| **French learners in Montreal** | Small to medium | Medium | Low-medium (an English-only UI, and the "say-it" respelling is weaker than romaji/Jyutping; Québécois vocab is not modelled) | Low for an outsider | Medium | Skip for launch |

### 2.2 Why Cantonese heritage learners first

- **No direct competitor.** CapWords' Cantonese support is unconfirmed. Duolingo and Babbel skip it. Migaku's own 2025 roundup says big apps "skip Cantonese entirely or phone it in." In the store you are the only answer, not the 16th.
- **The social loop has a built-in second player.** Heritage learners have a fluent family member or partner. "Send Mum a sticker and see if she can guess it" turns the challenge mechanic into a family game. That person is also a natural second install, which is what a K-factor needs. No other wedge has a fluent partner on hand.
- **Identity motivation means better retention and word of mouth.** Heritage learning is emotional ("I want to talk to my grandma"). That suits the keepsake and diary framing far better than a test-prep framing, and people share identity content.
- **A small, connected community means reviews compound.** At 200 users a month you need *density*: 30 enthusiastic users in r/Cantonese and two Discords recommend you in every "what app should I use" thread for months. 30 scattered Japan tourists don't.
- **Founder credibility.** If the founder has a personal Cantonese or HK story, it is the most authentic content hook in the whole plan. Lead the TikTok and Reddit posts with it. If not, don't fake it; recruit heritage beta testers as co-creators instead.

**The risk to manage:** heritage speakers will judge Cantonese quality harshly:
- written colloquial vs standard written Chinese (係 vs 是, 嘅 vs 的)
- tone numbers
- HK vs Guangzhou vocabulary

Get 5 to 10 native or heritage beta testers to grade 50 generated yue cards before launch. Fix the prompt per skills.md #13 and #15 (`prompt-lab.mts` exists). One viral screenshot of a "wrong" Cantonese card in r/Cantonese would hurt more than any launch post helps. Add the "Report a wrong word" action that `03_competitors.md` recommends. It turns critics into contributors.

### 2.3 Where to find them

**Cantonese (primary)**
- **Reddit:** r/Cantonese (the main hub; check the sidebar's current self-promo rule before posting); r/HongKong (only with a genuine story, never an ad); r/ChineseLanguage (mostly Mandarin, but the Cantonese threads are active); r/languagelearning (strict no-promotion; participate only).
- **Discord:** the large English-language Cantonese learning servers (search Disboard for "Cantonese"); HK diaspora community servers (UK BN(O) arrivals).
- **TikTok and IG:**
  - #learncantonese, #cantonese, #canto, #heritagelanguage
  - "ABC/BBC/CBC" (American-, British-, Canadian-born Chinese) creator niches
  - HK food creators (food is the natural sticker subject: 蛋撻, 菠蘿包, 奶茶)
- **Creators to approach** (small, 5k–100k followers, Cantonese teachers and heritage-journey creators): offer a free lifetime founder account and a co-designed "starter board". No paid deals at this scale.
- **Offline:** university Chinese/Hong Kong student societies in the UK and Canada (heritage learners exist in volume; a single society post or event reaches 100+).

**Japan trip (secondary)**
- TikTok and IG #japantravel, #japantrip, #japanitinerary. Content: "the 30 words I learned on my Osaka trip, as stickers" (a board export).
- r/LearnJapanese: **only** in the Wednesday "Material Recs and Self-Promo" thread, per sub rules.
- r/JapanTravel: participation only (no promotion). Never post the app there.
- Travel newsletters and blogs that run "apps for Japan" lists. Pitch in Jan–Feb for cherry-blossom season.

**Studygram (cross-cutting style)**
- #studygram, #langblr, #languagejournal, #hobonichi, #stickerjournal. A finished board looks like a journal spread, so post it as one.

---

## 3. Activation funnel

### 3.1 Funnel today (from the inventory)

Install → sign-up (username, email, password, language, optional avatar) → **email confirmation** → empty Collection ("Tap the Scan tab…") → Scan → **AI consent gate** → camera permission → shutter → about 3 to 20 s wait → DiscoveryReveal → Add → *the user is left on the camera with no handoff* → card not due until **tomorrow** (1-day rest) → no reminder → D1 depends entirely on memory.

Leaks, roughly in order of likely size:
1. The email-confirmation round trip before first value. Users switch to Mail and some never come back.
2. An empty home screen, with no tutorial or sample.
3. Nothing to do after the first save; the study loop can't start until tomorrow.
4. No reminder brings anyone back on D1.
5. The 10-scans-a-day quota counts discards and retries, so an excited first session can hit "Daily limit reached" in an `Alert`.

### 3.2 Funnel fixes (cheapest first, all JS, no EAS build needed)

| Fix | Effect |
|---|---|
| **Defer email confirmation**: let the user scan first and confirm within 7 days (Supabase allows sign-in before confirmation if "Confirm email" is relaxed, or use OTP-code confirmation in-app with `textContentType="oneTimeCode"` per skills.md #11) | Removes the biggest pre-value drop. Trade-off: more throwaway accounts, so it **requires** the app-wide spend ceiling (§5.4) |
| **First-run path**: after sign-up, go straight to Scan with a one-line coach ("Find something on your desk") instead of the empty Collection | Time to first sticker drops to about 60 s |
| **Post-save handoff**: after Add, show a small sheet: "Nice — 1 of 3 today. Scan another · See it in your diary · Send to a friend" | Connects capture to diary and social; drives the 3-sticker activation threshold |
| **"Quick check" on day 0**: after the 3rd sticker, offer a 60-second mini-review of today's finds (the learning steps 1m/10m already exist; only `NEW_CARD_REST_DAYS` blocks it) | The first review happens in session 1, so the user experiences SRS before deciding whether to return |
| **Ask for notification permission at the right moment**: right after that first quick check ("When should we remind you? 8:00 / 12:30 / 19:00 / Never") | Permission asked with context and value converts far better than a cold prompt |
| **Don't charge quota for Discard/Retry** (at least on day 0), and replace the `Alert` with an in-character "You've found 10 words today — the rest can wait for tomorrow" | Protects the most enthusiastic users |
| **Starter sticker**: seed one sample sticker per language (marked "sample") so the Collection, calendar and boards are never empty | Kills the empty state; also shows the reviewer the product |

### 3.3 Analytics: the events to add

**Current state:** Aptabase with 6 events (`app_launched`, `cutout_local`, `cutout_escalated`, `cutout_upload_failed`, `sticker_shared`, `sticker_saved_to_photos`). None of them is a funnel event. Aptabase is privacy-first and anonymous: it has sessions but no stable user ID, so it **cannot compute D1/D7 cohort retention** by itself.

**Recommended split:**
- **Aptabase for funnel event counts and conversion** within a session or day (cheap, already integrated, privacy-friendly).
- **Supabase for retention.** Add a tiny `user_activity_days (user_id, day)` upsert on app foreground. Compute D1, D7 and D30 cohorts with one SQL query against `profiles.created_at`. You already own the data and it's exact.
- Add both to `docs/privacy.html` and the App Store privacy label. Aptabase is currently undisclosed.

**The 7 events** (with properties):

| # | Event | Props | Fires when |
|---|---|---|---|
| 1 | `signup_completed` | `language`, `has_avatar` | Account created (not confirmed) |
| 2 | `scan_completed` | `source` (camera/gallery), `cutout` (local/server/raw), `ms_to_reveal`, `is_first` | DiscoveryReveal shown, or failed with `ok:false, reason` (`limit`, `network`, `blocked`, `llm`) |
| 3 | `sticker_saved` | `n_total` (1, 2, 3, 5, 10, 25 buckets), `edited` (bool), `language` | Add to Collection |
| 4 | `review_completed` | `n_cards`, `n_again`, `is_first`, `entry` (home/calendar/quickcheck) | ReviewSummary shown |
| 5 | `reminder_set` | `time_bucket` or `declined` | Notification time chosen |
| 6 | `friend_added` | `via` (search/invite_link) | Friendship accepted (either side) |
| 7 | `challenge_event` | `stage` (sent/opened/won), `attempts` | Each stage of a challenge |

(Optional 8th: `paywall_viewed` / `purchase`, from day one of v1.1.)

### 3.4 Activation definition and target rates

**Activated user:** saved ≥3 stickers and completed ≥1 review within 48 h of sign-up. This is a proposed definition. Validate it at about 300 users by checking which early behaviour best predicts D7.

Targets for the first 90 days. These are my targets: about median-to-good for a consumer education app with no paid traffic. Third-party benchmarks put education D1 around 25–30% and D30 in single digits.

| Step | Target | Red flag |
|---|---|---|
| Install → `signup_completed` | 65% | <50%: sign-up form or confirmation is the problem |
| Sign-up → first `scan_completed` (ok) | 80% | <65%: consent, camera permission or scan failures |
| First scan → first `sticker_saved` | 85% | <70%: card quality, wrong object, latency |
| Sign-up → 3 stickers on day 0 | 50% | <35% |
| Sign-up → first `review_completed` within 48 h | 45% | <30% |
| **D1 return** (any activity day) | **35%** | <25% |
| **D7 return** | **20%** | <12% |
| D30 return | 10% | <6% |
| Reminder opt-in (of those asked) | 55% | <40% |
| Activated users who add a friend in week 1 | 25% | <10%: social is not landing |
| Challenge sent → opened → won | 80% → 70% | open <50%: push or deep-link problem |

Weekly review: one SQL query and one Aptabase funnel. Change one thing per week.

---

## 4. Retention loops

Ordered by (impact × confidence) ÷ effort. "Build" means it needs a native change and an EAS build. Per memory, builds need the user's explicit yes, so batch the build items into **one** dev-client build.

### 4.1 Review reminders (JS, S effort; the highest-leverage missing piece)

- **Local** `scheduleNotificationAsync` (expo-notifications local scheduling works in SDK 54 builds; remote push is already wired). There are none today.
- One daily notification at the user's chosen time, **only if something is due or nothing was found today**. The copy uses the actual word and photo:
  - "Your 雨傘 from Tuesday wants a look — 4 cards, about 2 min."
  - "Nothing found yet today. What's on your desk?"
- **Never guilt.** No "you're losing your streak!!" No second notification the same day. Back off automatically after 3 ignored notifications in a row (drop to every other day, then weekly).
- Add a Notifications row in Profile (toggle and time). It is missing today, and Apple reviewers and users expect it.

### 4.2 Non-punitive streaks (JS, S–M)

- A **weekly rhythm**, not a daily streak: "3 find-days this week". It is shown as eki-style stamps on the week strip (`WeekActivityTracker` already exists).
- A missed day reads "your deck rested", never as a broken flame.
- Compare with *your own* last week or month (the Gentler Streak model), not with friends.
- Make the hard-coded `DAILY_GOAL = 5` a choice: 1, 3 or 5 a day (default **3**, matching the activation threshold).
- No streak freezes to buy. There is nothing to freeze, because nothing is punitive.

### 4.3 Friend challenges as the viral loop (JS plus web, M)

**Correction to the brief:** universal links are set up (`applinks:tabistickers.com`), but `lib/deepLinks.ts` only handles **auth** link types (recovery, signup, invite, email_change). There is **no invite or challenge link today**. Challenges reach existing friends only through push. So today the viral loop only works between people who are both already users and already friends.

What to build:
1. **Invite link** `tabistickers.com/u/<username>`. On a phone with the app installed it opens FriendProfile with "Add friend". Without the app it shows a small web page (sticker art, "Ian wants to swap words with you", App Store badge). On first sign-up after an invite click, auto-send the friend request. A deferred deep link without an SDK: carry the username through a "Paste invite code" field, or a clipboard read with consent.
   - Adding a path to the AASA file and the router is a config change that the next build picks up. The link handling itself is JS.
2. **Challenge-to-non-user:** "Send a challenge" can create a link `tabistickers.com/c/<id>`. The web page shows the photo, the English meaning and the blanked sentence: "Can you guess this in Cantonese? Get the app to answer — you keep the sticker if you get it." The photo is served by an edge function that checks the challenge is open-link and mints a short-lived signed URL (skills.md #2: read through a verified server-side check).
   - Strip EXIF and GPS, and show no location on public links (the privacy point in `04_aesthetics.md` §5.2).
3. **Share sheet** on every challenge, so it can go to iMessage, WhatsApp, or a family group chat. **Family WhatsApp groups are the heritage-learner distribution channel.**
4. Rewards: on a win, both sides get a "from a friend" postmark on the card (`04_aesthetics.md` §5.4). Cheap to build, and it gives the winner a reason to send one back.

**Measure K:** invites sent per activated user × install rate per invite. A realistic target is **K ≈ 0.15–0.3**. That won't be viral on its own, but it adds 15–30% to every organic cohort.

### 4.4 Shareable artifacts (JS for image generation if done with SVG; M)

- **Monthly board or calendar export**: "My October in Cantonese". A 9:16 image (later a 6 s video): the month calendar with stickers, word count, a "tabistickers.com" watermark and stamp. Prompt it on the 1st of each month ("Your October is ready").
  - This is the TikTok and IG artifact. It looks like a journal spread, so it travels in #studygram and #hobonichi.
  - Implementation: view capture needs `react-native-view-shot` (a native module, so it rides the batched build). Alternatively, render the composition server-side.
- **Single-card share** already exists (`sticker_shared`). Upgrade the image to a postcard layout (the photo, word, reading, sentence and a small watermark) so every share is an ad.
- **Year-in-words recap** (Dec 2026 / Dec 2027): high share rate seasonally. Plan it for the end of next year; it's too early now.

### 4.5 Widgets (build, L; one batched build)

- **v1: "Word of the day"** from your own collection (the cutout, word, reading; tap to open the card). This is the easiest widget and the strongest daily re-exposure. Each glance is a free micro-review.
- **v2: "Friend's latest sticker"** (Locket-style). Needs friends to have a feed, which they don't yet (there's no browsing a friend's collection). Ship it once the invite loop has created friend pairs.
- Implementation: a WidgetKit extension through `expo-apple-targets` (or similar) plus shared App Group storage. That is native work with an EAS build, so do it **after** launch, once D7 data says the core loop holds.

### 4.6 "On This Day" (JS, S–M; from month 2)

- "A month ago you found 蛋撻 in Mong Kok." A resurfacing card on Home, with "Hide this memory". This is the Day One retention hook, and it costs nothing in inference.

---

## 5. Monetization

### 5.1 The decision: launch v1 free, with no paywall, and say so honestly

**Reasons:**
1. **Inference cost is negligible at this scale.** The bake-off measured Gemini Flash-Lite at **$1.15 per 1,000 scans**. Add Replicate at about $0.004 only when the on-device cutout declines (iOS 15/16; rare on modern iPhones).
   - A heavy user doing 5 scans a day for 30 days costs **about $0.17–$0.75 a month**. 200 new users a month at realistic usage costs **under $20 a month** in AI.
   - The fixed costs dominate: Supabase Pro about $25/mo and the Apple developer fee of $99/yr.
2. **The money a paywall would make now is trivial; what you'd learn without one is not.** At 200 installs a month and a good 3–5% conversion at a $25 ARPU, a paywall makes about $150–250 a month. What you actually need in months 1–3 is retention data, App Store ratings and word of mouth in a small community. A paywall early cuts all three, especially in a niche (Cantonese) where reputation travels fast.
3. **Being visibly not-CapWords.** CapWords' most-cited complaint is the card-required trial after about 2 captures. "Free while we're in early access — no trial, no card" is a positioning line in r/Cantonese.
4. **Featuring and review.** A clean, generous v1 is easier to nominate and pass review with.

**But do these three things now, so the switch later isn't a betrayal:**
- **Integrate RevenueCat in v1** (SDK only, no paywall shown). It is free up to $2.5k monthly tracked revenue, then 1% (verify current terms). This avoids a second native build later and lets you test offerings with remote config.
- **A grandfathering promise in the app and on the landing page:** "Everyone who joins in early access keeps today's free features forever, and gets a founder price on Plus." Then honour it. Mark accounts by `profiles.created_at < paywall_launch_date`.
- **Keep the per-user daily quota and add the global ceiling** (§5.4).

**Switch to the paywall (v1.1)** when **both** are true:
- D7 return ≥15% for 4 consecutive weekly cohorts
- at least 500 total sign-ups

That is likely around **day 60–90**. Before then, the paywall just measures the curiosity of very early users.

### 5.2 Free vs Plus (for v1.1)

Principle: **gate creation (which costs inference), never memory.** An SRS that locks your own cards poisons trust.

| | Free | Tabi Plus |
|---|---|---|
| New stickers (scans) | **3 a day** (about 90 a month, more than most learners can absorb; equal to the activation threshold) | Unlimited (fair use: 50 a day) |
| Reviews of your own cards | **Unlimited, forever** | Unlimited |
| Friends and challenges | **Free** (the growth loop; never gate it) | Free, plus a monthly "challenge pack" of themed prompts |
| Languages | One active learning language at a time (switch anytime) | All three at once, plus new languages first (Mandarin? Korean? Teochew is on the roadmap) |
| Boards | 3 | Unlimited, plus themes and backgrounds |
| Diary and calendar | Full | Full, plus "On This Day" resurfacing |
| Export | Single sticker share (watermarked) | Monthly board and calendar export without watermark, deck export (CSV/Anki), year recap |
| Widgets | Word of the day | All widgets (friend's latest, due count) |
| Voice | Record and play | "You then vs you now" comparison |
| Re-translate and regenerate | 5 a day | Unlimited |

Note that Free *includes* the watermarked monthly board export. Watermarked exports are marketing, so free users should make them.

### 5.3 Price points and trial

- **Monthly $3.99**, **Annual $24.99** (shown as "$2.08/mo", the default), **Lifetime $59.99**, and a **founder lifetime at $39.99** for early-access users (time-limited).
- Reasoning:
  - The photo-vocab cluster sells at $12.99–29.99 a year. CapWords is $19.99–29.99.
  - Tabi's depth justifies the top of that range, but not the education median ($44.99), because it is still a supplement.
  - Lifetime at about 2.4× annual fits the norm for JP and heritage learners (AnkiMobile $24.99, Noji $74.99, Bunpro $150).
  - Add an HK storefront price tier check: Apple's equalization is fine, but review whether HKD and GBP endings look natural.

**A trial design that beats CapWords' resented one:**
- **Never show the paywall before a save.** CapWords puts it after the magic moment but before the first save; that is the resented moment.
- **Reverse trial with no card: the first 7 days are full Plus automatically**, granted server-side and not an App Store introductory offer, so there is no payment sheet. On day 6, show a gentle in-app card: "Your Plus week ends tomorrow. Here's what you made: 23 stickers, 2 boards, 1 friend. Keep Plus, or carry on free — your cards stay yours."
  - On downgrade, nothing is deleted or locked: existing stickers, boards over the limit (read-only, not hidden) and reviews all stay. Free scans just drop to 3 a day.
- Show the paywall **contextually**: at the 4th scan of the day ("You've found 3 today — Plus lets you keep going"), on tapping a Plus board theme, and on export without the watermark. Never at launch and never interrupting a review.
- Later, optionally test a standard App Store free trial (a 7- or 14-day intro offer on the annual plan) *against* the reverse trial. RevenueCat makes that a remote-config A/B. Third-party summaries of RevenueCat data suggest longer trials convert better on annual plans; test 7 vs 14 days.

### 5.4 Cost guardrails (required before launch, whatever the paywall decision)

- **An app-wide daily spend ceiling** on `create-sticker` and the translate functions. Example: a `global_usage` counter in `api_usage` that returns the existing fail-closed 503 path with friendly copy above N scans a day (start N = 3,000/day ≈ $3.50). Today the cap is per user only, and sign-up needs only an email, so a script could farm accounts. This matters more if email confirmation is deferred (§3.2).
- Budget alerts on Gemini (Google Cloud billing alert at $25 and $100), Replicate and Supabase.
- `LLM_FALLBACK`: decide whether Groq stays on. If it does, it **must** be in the AI consent list and the privacy policy (guideline 5.1.2(i)). Otherwise set `LLM_FALLBACK=off` in prod.

---

## 6. 30-day pre-launch and launch plan

Calendar assumptions:
- Today is Thu 2026-10-29.
- **Public launch D0 = Tue 1 Dec 2026.** This avoids Apple's late-December review slowdown and gives 4 weeks of ratings before the January resolution peak.
- **The real growth push is Tue 5 Jan 2027** (New Year's language-learning peak).
- A **Cantonese moment at Lunar New Year (Sat 6 Feb 2027)**: a "CNY words" challenge pack and board ("揮春, 利是, 年糕"), the best heritage-learner content hook of the year.
- Japan cherry-blossom trip-prep content runs mid-Feb to March.

If the launch gates (week 1) slip, move D0, not the gates.

### Week −4 (29 Oct – 4 Nov): gates and instrumentation
- [ ] Privacy and consent: add Groq (or switch off the fallback) and Aptabase to `lib/aiConsent.ts` and `docs/privacy.html`; fill in the App Store privacy label (Photos, User ID, Email, Coarse Location, Audio, data shared with AI processors).
- [ ] App-wide spend ceiling and billing alerts (§5.4).
- [ ] Crash reporting: Sentry (`@sentry/react-native` with its Expo plugin, a native dependency, so **batch it into the one build**).
- [ ] The 7 analytics events plus the `user_activity_days` table (§3.3).
- [ ] RevenueCat SDK (dormant) and `react-native-view-shot` → **one batched dev-client build, after asking the user.**
- [ ] Finish the app icon (memory: pending).
- [ ] Landing page: add the screenshots, an email capture ("get the TestFlight link"), and a short "Why Cantonese?" or "Why I built this" section. Point the landing page's App Store badge at TestFlight until launch.
- [ ] Recruit 5–10 Cantonese native or heritage reviewers to grade 50 yue cards. Fix the prompt.

### Week −3 (5 – 11 Nov): activation fixes and closed beta
- [ ] Ship the JS activation fixes: first-run straight to Scan, post-save sheet, day-0 quick check, notification time picker, local reminders, quota copy and no quota charge for discards on day 0, sample stickers (§3.2, §4.1).
- [ ] **TestFlight internal and early external: 25 people.** Recruit **in pairs** (learner + friend, partner or cousin) so challenges get tested for real. Mix: 12 Cantonese heritage, 8 Japanese, 5 friends of the founder.
- [ ] Submit the first external build for Beta App Review (it takes about 1 day; it also previews any 4.3 concerns early).
- [ ] **Apple featuring nomination** (App Store Connect → Featuring → Nominations): submit **now**, about 3 weeks before D0. Apple asks for a minimum of 2 weeks and recommends up to 3 months.
  - Angle: on-device Vision instance selection (a promptable lasso cutout), Cantonese learners underserved by the big apps, an English-only diary of your own life, accessibility work (VoiceOver hides answers on card fronts), a solo developer.
  - File a **second nomination** for the January "new year, new language" window and a third for Lunar New Year.

### Week −2 (12 – 18 Nov): beta at scale and content bank
- [ ] **Expand TestFlight to about 100 external testers.** Source: r/Cantonese (ask mods first, framed as "looking for Cantonese speakers to break my app — free forever for testers"), the Cantonese Discords, the r/LearnJapanese Wednesday thread, the landing-page waitlist, and university HK/Chinese societies.
- [ ] In-app feedback: a "Report a wrong word" action and a TestFlight screenshot-feedback prompt.
- [ ] Weekly beta review of the funnel (§3.4 targets) and the yue card quality log.
- [ ] Shoot 10–15 short videos (15–30 s, founder-led, phone-shot, in the paper aesthetic), for example:
  - "Learning Cantonese from my mum's kitchen"
  - "I sent my cousin a sticker — can she guess it?" (her reaction)
  - "Things in a HK cha chaan teng, as stickers"
  - "My Osaka trip as a sticker board"
  - "Why Duolingo doesn't teach Cantonese"
  - a screen recording of the lasso cut
- [ ] Draft the App Store page: name, subtitle, keywords, 8 frames, preview video, description, review notes, demo account (§1).

### Week −1 (19 – 25 Nov): submit
- [ ] Freeze features. Fix beta bugs only.
- [ ] **Submit for App Review about 7–10 days before D0**, with the release set to "Manually release". This leaves a buffer for a 4.3 or 5.1.2 back-and-forth.
- [ ] Ask beta testers which of them will leave an honest rating on launch day. Do **not** incentivize reviews (against Apple guidelines). Use `StoreReview.requestReview` in-app after the 3rd completed review session, never after a failure.
- [ ] Line up 5–10 creators and community members for launch week: founder accounts free, no script.
- [ ] Prepare launch posts per community (below). Schedule nothing that you can't answer comments on live.

### Launch week (D0 = Tue 1 Dec)
- **D0:** release. Post to: the landing page, founder TikTok, IG and X, r/Cantonese (if mods agreed; otherwise answer the next "app recommendations" thread honestly with disclosure), and Cantonese Discord #resources channels.
  - Message: "Free in early access, no card, no trial. Your cards are yours forever."
- **D1:** r/LearnJapanese **Wednesday self-promo thread** (Wed 2 Dec). r/iOSapps, r/SideProject, r/indiehackers ("solo-built, on-device Vision lasso" build story; these allow promotion).
- **D2–D4:** reply to every review and every comment within hours. Fix crashes with JS where possible; ship one bug-fix build at most (ask first).
- **D7:** first cohort readout (§3.4). Retro: which channel produced activated users, not installs?

### D+8 to D+30 (to ~31 Dec)
- **Product Hunt: optional, low priority, mid-week around D+10–14.** Its audience is makers and early adopters, not language learners. Expect a spike of curious installs with poor retention and a nice backlink. Do it only if it costs less than a day; never on D0 (it would split launch-day attention).
- Post the first "my month in Cantonese/Japanese" board export (1 Dec → 31 Dec is the first full calendar month). Ask 10 users to post theirs.
- Pitch 3–5 newsletters and blogs: Cantonese learning roundups (several "best Cantonese apps" listicles exist and are updated yearly), Japan travel app lists, indie iOS newsletters.
- Build the invite and challenge links (§4.3) for the January push.
- Decide on the widget build (§4.5) only if D7 ≥15%.

### Reddit etiquette, in short
1. **Read each sidebar first.** r/LearnJapanese restricts self-promotion to the Wednesday "Material Recs and Self-Promo" thread. r/JapanTravel and r/languagelearning are effectively no-promotion zones.
2. **Disclose that you made it**, every time. ("I built this — feedback welcome.")
3. Use about a 9:1 ratio of genuine participation to self-mention. Have a real post history in r/Cantonese before launch day; start now.
4. Lead with something useful (for example "How the app chooses between 係 and 是: written Cantonese vs SWC, and where it still gets it wrong"), not a store link.
5. Free and no-card matters to mods. Say it.
6. One launch post per sub, never cross-posted the same day. Answer every comment. Take criticism in public and ship the fix visibly ("fixed in 1.0.2, thanks u/…").

### Expected outcome (honest)

These are my estimates, not benchmarks:
- D0–D30: **150–400 installs** (beta conversion, community posts, founder content), about **40–60% activation**, and **20–60 ratings**, mostly from the beta community. That puts the 4.5+ rating that featuring and conversion need in reach.
- January push plus Lunar New Year: 300–800 installs a month if one founder video catches.
- **Featuring is upside, not the plan.** If featured, expect a 10–50× spike for days. The spend ceiling and quotas (§5.4) exist so a feature doesn't become a bill.

---

## 7. Summary of decisions

| Question | Answer |
|---|---|
| Name and subtitle | **Tabi Stickers: Word Diary** / **Japanese, French & Cantonese** |
| Keywords | `vocabulary,flashcard,learn,jyutping,romaji,kanji,photo,camera,picture,srs,travel,japan,quiz,hk` (94) |
| Category | Education (primary), Travel (secondary) |
| Lead message | A word diary of your days, shared with friends, with real depth. *Not* "turn objects into stickers" |
| Wedge | Cantonese heritage learners (no competitor, family = built-in challenge partner), then Japan-trip planners (seasonal volume) |
| Activation | 3 stickers + 1 review in 48 h. D1 35% / D7 20% / D30 10% targets |
| Analytics | 7 funnel events in Aptabase. Retention computed in Supabase (Aptabase has no user IDs) |
| Top retention loop | Local review reminders → weekly non-punitive rhythm → invite and challenge links → monthly board export → widget |
| Paywall | v1 free, RevenueCat dormant, grandfather promise. v1.1 paywall at D7 ≥15% plus 500 sign-ups. Gate scans (3/day free), never reviews or friends. $3.99 / $24.99 / $59.99 (founder $39.99 lifetime). Reverse trial with no card |
| Before any of it | Consent and privacy fixes (Groq, Aptabase), app-wide spend ceiling, Sentry, icon, demo account with a pending challenge |

---

## Sources (beyond the scratchpad inputs)
- r/LearnJapanese self-promo rule (mirrors of the sub's rules and Wednesday threads; verify on the live sidebar): [rules mirror](https://redlib.iamkroot.duckdns.org/r/LearnJapanese/wiki/subredditrules), [weekly self-promo thread example](https://twt.omada.cafe/r/LearnJapanese/comments/1n6ztvh/weekly_thread_material_recs_and_selfpromo)
- Apple featuring nominations and lead time: [Getting featured on the App Store](https://developer.apple.com/app-store/getting-featured), [Nominate your app for featuring](https://developer-rno.apple.com/help/app-store-connect/manage-featuring-nominations/nominate-your-app-for-featuring), [MacStories on the nominations tool](https://www.macstories.net/news/app-store-connect-adds-new-tools-for-developers-to-promote-their-apps/)
- Subscription benchmarks (directional): [RevenueCat State of Subscription Apps 2025](https://revenuecat.com/state-of-subscription-apps-2025), [RevenueCat 2026 education chapter](https://www.revenuecat.com/state-of-subscription-apps-2026-education), [SaaStr on trial length across 17,000 apps](https://saastr.com/what-17000-subscription-apps-tell-us-about-free-trial-length-annual-plans-convert-86-better-with-30-day-trials-monthly-tops-out-at-two-weeks-and-ai-apps-hit-a-wall-at-16-days)
- Cost per scan: memory `project_provider_bakeoff.md` (measured: $1.15 per 1,000 Gemini Flash-Lite scans).
- Not verified here (flagged in the text): the Spanish (Mexico) keyword indexing on the US store; RevenueCat's current free-tier threshold; "Tabi Stickers" name availability.
