# 04: Aesthetics, delight and personal touch for Tabi Stickers

Researched 2026-10-29. Stack checked against `package.json`: Expo 54, RN 0.81.5, Reanimated ~4.1.1, gesture-handler ~2.28, react-native-svg, expo-haptics ~15, expo-audio, expo-location, expo-image. **No Skia, no Rive, no Lottie.** No `useAnimatedSensor` or `useReducedMotion` anywhere in the code yet. `lib/seededRandom.ts` already exists, which is useful for stable "hand-placed" jitter.

Effort: **S** is under 1 day, **M** is 2 to 5 days, **L** is more than a week or needs a native dependency or EAS build. Delight: **1 to 5**.

---

## 0. The thesis in one paragraph

The apps people call "cozy" share one move: they put **one coherent physical metaphor** under a utility and then follow its rules (Not Boring runs on a game engine with physics and sound; Finch borrows Animal Crossing; Flighty borrows airport signage; Things 3 makes its + button a physical object you drag). Tabi already has the right metaphor: **a travel notebook** (Hobonichi or Midori) with die-cut stickers, eki-style stamps and washi tape. The job is to stay in that world rigorously. Every effect should be something paper, ink, tape or foil could actually do. That rules out the tacky options (generic confetti, glowing XP bars, neon gradients) and keeps everything warm. The strongest lever for "prettier Anki cards" is the **card that physically matures as you learn it**. The strongest lever for "personal touch" is **the card remembering where and when and who the word came from**.

---

## 1. Reference apps: what specifically works

| App | What makes it work | Steal for Tabi |
|---|---|---|
| **(Not Boring) Weather / Habits** | Built on a game engine: 3D, physics, animation and **original sound for every event** (rain, hail and so on, by sound designer Thomas Williams). Andy Allen argues sound and haptics are the most underused tools in apps, and **varied versions of the same sound** (a game-audio trick) make software feel alive. He also argues for a fixed product with no feature bloat. | Sound plus haptic pairs for the 4 to 5 core physical actions only (peel, slap, stamp, flip, file). Use 3 to 5 pitch or sample variants per sound so it never sounds canned. |
| **Finch** | "Cozy game" visuals in the Animal Crossing mould, chosen to reduce the "guilt debt" productivity apps create. Small doable steps. Critiques say it gets **cluttered** and breaks progressive disclosure. | Cozy, never guilt. Do **not** copy its density. |
| **Things 3** | The Magic Plus is a *physical object*: you drag it to where the new item should go. Reviewers credit intent over decoration. 3.22 (OS 26) made controls deform with physics while you drag. | "Slap a sticker" should be drag-to-place in the same way, with the gesture itself as the delight. |
| **Flighty** | Takes on an existing visual language (airport split-flap boards and signage) wholesale. Information first. About 15 context-aware states. | Take on *eki stamp* and *passport* conventions wholesale: date stamps, station-name typography, ink colours. |
| **Gentler Streak** (ADA 2024, Social Impact) | It is as likely to tell you to rest as to push. Progress is compared **with your own past, not with other people**. The mascot Yorhart stands for "what your heart would tell you". | The SRS tone. A missed day is never framed as a failure. "Your deck rested" is fine. Compare a month with your own last month. |
| **Duolingo (Rive)** | Characters are **Rive state machines**: pose states plus mouth states driven by inputs, exported as one runtime file, with the engineer only setting inputs. Modular, so files stay small. | Only if Tabi gets a mascot (a tanuki or a stamp-bearing tabi bird). Otherwise skip. Rive needs a native dependency (`rive-react-native`), so it costs an EAS build. |
| **Airbnb 2025 redesign** | Dimensional, toy-like 3D icons in their own "Lava" format (video with alpha, 32-bit colour, soft shadows and glows) that gets past Lottie's limits. This is the mainstream signal that **tactile and dimensional is back** after a decade of flat design. | Tab icons as small rendered objects (a stamp, a corkboard pin, a notebook, a camera). Pre-rendered PNGs with a 2-frame press state are enough. No video format is needed. |
| **Apple Journal / Day One** | On-device suggestions from photos and significant locations. Day One users name **On This Day** as the hook that keeps them coming back. Facebook's version drew backlash (painful memories), which led to filters. | Resurfacing is high value but needs a "don't show me this one" escape. |
| **Locket / Retro** | Small, intimate circles (Locket caps close friends at 20). A photo from a friend lands *on your home screen*. | A widget that shows "today's sticker" or a friend's latest sticker. Gifting a word to a friend is more intimate than public sharing. |
| **Partiful** | Per-event themes and fonts let the user dress the object. Neon accents are chosen to read against *any* theme. | Card backs and board themes the user picks. Keep one accent (terra) that holds up on all of them. |
| **Teenage Engineering** | Restrained, utilitarian layout with **one bright playful accent** (orange knobs). Constraint as direction. Mono type, technical labelling. | JetBrains Mono is already the "label maker" voice. Use it like specimen labels and TE silkscreen (small caps, catalogue numbers such as `№ 0142 · 名詞`). |
| **Bear / Craft** | Typographic warmth: good serif and spacing, with themes as first-class settings. | Newsreader at generous size on the card face. Theme switching should be cheap. |
| **iOS 26 Liquid Glass** | Glass is a **functional layer for controls and navigation that sits above content**, and Apple warns against overuse. Custom opaque tab bars block it. You must fall back for older iOS and accessibility settings. | Do not glass the cards. Paper is the content layer. If anything gets glass, it is floating chrome (tab bar, session toolbar). A paper app with glass controls is coherent: the glass is "the device" and the paper is "the notebook". RN 0.81 has no first-class glass, so leave it until expo exposes it. |

Sources: [Not Boring on Apple](https://apps.apple.com/us/story/id1556321408) · [Behind the Design: Habits](https://cur.at/wicwETc?m=web) · [designstripe on Not Boring](https://designstripe.com/blog/not-borings-mobile-experiences) · [TapSmart on Weather](https://www.tapsmart.com/apps/not-boring-weather-fun-alternative-weather-watchers/) · [Pratt critique of Finch](https://ixd.prattsi.org/2024/09/design-critique-finch-ios-app) · [screensdesign: Finch](https://screensdesign.com/showcase/finch-self-care-pet) · [MacStories: Things 3](https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/) · [Things 3.22 / OS 26](https://news.lavx.hu/article/things-3-22-overhaul-aligns-with-apple-os-26-aesthetic-refinement-meets-ipad-productivity-boost) · [Behind the Design: Flighty](https://cur.at/VcCahLU?m=web) · [9to5Mac: Flighty Live Activities](https://9to5mac.com/2022/10/24/flighty-dynamic-island-iphone-live-activities/) · [Gentler Streak redesign](https://bgr.com/tech/gentler-streak-gets-a-major-redesign-focused-on-your-wellbeing/) · [Behind the Design: Gentler Streak](https://blog.progressiverobot.co.uk/behind-the-design-how-gentler-streak-approaches-fitness-with-humanity) · [Duolingo: character visemes](https://blog.duolingo.com/world-character-visemes) · [Rive: Duolingo Lily](https://rive.app/blog/duolingo-s-ai-powered-video-call-brings-lily-to-life) · [It's Nice That: Airbnb redesign](https://www.itsnicethat.com/articles/airbnb-app-redesign-140525) · [woshipm on Airbnb's Lava format](https://www.woshipm.com/ucd/6243362.html) · [Apple Journal launch](https://www.apple.com/newsroom/2023/12/apple-launches-journal-app-a-new-app-for-reflecting-on-everyday-moments/) · [Six Colors on Journal](https://sixcolors.com/post/2023/12/ios-17-2s-journal-app-offers-introspection-surface-deep/) · [CSM: Facebook On This Day filters](https://csmonitor.com/layout/set/amphtml/Technology/2015/0325/Facebook-s-On-This-Day-celebrates-cherished-memories-hides-bad-ones) · [Partiful case study](https://cs1300-iterative-design.vercel.app) · [designwanted: Teenage Engineering](https://designwanted.com/teenage-engineering-creating-design-perspective) · [STRV: applying Liquid Glass](https://www.strv.com/blog/how-to-apply-liquid-glass-to-your-app)

Caveat: much of the coverage above is secondary (reviews, student critiques, vendor blogs). The Not Boring, Gentler Streak, Duolingo and Apple items come from primary or near-primary sources. Partiful, Opal and Arc returned nothing substantive, so no claims are made about them.

---

## 2. Physical metaphors: which fit a language flashcard

| Metaphor | Fit | Why / how |
|---|---|---|
| **Eki / passport stamps** | ★★★★★ | *Tabi* means travel. Eki stamps (since 1931, Fukui station) show **local landmarks plus characters plus local specialities**, and collecting them is a national hobby with time-limited themed "stamp rallies". JR East's 2026 rally even uses NFC tags into a digital stamp book. This maps directly onto: a stamp per **place** you scanned in, a stamp per **review milestone**, and seasonal "rallies" (scan 5 kitchen words in November). Stamps are also the most honest "reward" graphic there is, because ink is the proof you were there. |
| **Hobonichi / Midori notebook, washi tape** | ★★★★★ | The calendar diary *is* a Hobonichi day page. Hobonichi sells stamps sized to its 3.7mm grid and says to match stamp ink to the tape and stickers on the page. Washi tape is forgiving: crooked tape is part of the charm (wabi-sabi). Use tape to "hold" photos onto cards and boards, never as a border on everything. |
| **Die-cut sticker books** | ★★★★★ (already there) | Keep it. Add the **peel** as the one signature motion. |
| **Specimen / museum labels** | ★★★★ | Ideal for the *card's information block*: a catalogue number, part of speech, "collected at", date and collector, in JetBrains Mono. It gives the dictionary data an *exhibit* feel instead of a form feel, and explains why mono type is there at all. |
| **Polaroid / instant photo** | ★★★ | Good for the *scene photo* on the back of a card (the context photo with a thick bottom margin carrying a handwritten caption). Do not make the sticker itself a Polaroid, which would mix metaphors. |
| **Trading cards (holo, rarity)** | ★★★ for *mastery*, ★ for *rarity* | Foil works as the **earned** state of a mature card, because it says "this one is precious". Random rarity (gacha) is wrong here: the user's own photos are not random drops, and loot mechanics cheapen personal memories. Tie the shine to **effort** (mastery), never to chance. |
| **Postcards** | ★★★★ | The format for **sending a word to a friend** (challenges): stamp corner, postmark with city and date, handwritten-style message. Postcards are inherently about place, which fits "Tabi". |
| **Scrapbook** | ★★★ | Boards already are this. Risk: clutter. Keep the boards as user-arranged scrapbooks, and keep study cards clean. |

Sources: [Wikipedia: Eki stamp](https://en.wikipedia.org/wiki/Eki_stamp) · [Wikipedia: Stamp rally](https://en.wikipedia.org/wiki/Stamp_rally) · [JR Pass blog on eki stamps](https://www.jrpass.com/blog/eki-stamps-collecting-japan-s-free-train-station-stamps) · [JR East 2026 rally](https://japantrain.net/guide/jr-station-stamps-2026) · [Tokyo Fox: Yamanote stamps](https://tokyofox.net/2026/08/28/the-joy-of-collecting-ink-stamps-on-tokyos-iconic-yamanote-line/) · [Hobonichi TOOLS&TOYS stamp guide](https://1101.com/store/techo/en/magazine/tt_report/202412) · [Hobonichi original stamps](https://www.1101.com/store/techo/2016/planner/detail_toolstoys/tt_o_stamp.html) · [Why Is This Interesting: Hobonichi](https://whyisthisinteresting.substack.com/p/why-is-this-interesting-the-hobonichi) · [AJET on journaling](https://connect.ajet.net/2024/03/06/journaling-on-jet/)

---

## 3. Micro-interactions and motion (RN implementation notes)

General rules:
- **All motion in Reanimated 4.** It defaults every `withSpring` and `withTiming` to `ReduceMotion.System`, which snaps to the end value when iOS Reduce Motion is on. Good, but a snap is not always the right fallback (see section 6), so use `useReducedMotion()` to swap in a **crossfade** where a snap would be jarring.
- **One haptic vocabulary**, defined once in a `lib/feel.ts` (`feel.peel()`, `feel.stamp()` and so on) that pairs haptic plus sound plus reduced-motion policy. This is the same "single owner" lesson as skills.md #1. expo-haptics (SDK 54) offers `impactAsync(Light|Medium|Heavy|Rigid|Soft)`, `notificationAsync(Success|Warning|Error)`, `selectionAsync()`, and on Android `performAndroidHapticsAsync` (preferred, because it needs no VIBRATE permission). **iOS silently drops haptics in Low Power Mode, while the camera is active, and during dictation**, so never use a haptic as the *only* signal, and expect nothing on the scan screen.
- Use a stable **seeded jitter** (`lib/seededRandom.ts`, seeded by sticker id) for the tilt of every sticker, tape strip and stamp: about ±3° rotation and ±2px offset. Hand-placed imperfection is most of what reads as "cozy". It must be stable across renders, or it reads as glitchy.

| # | Idea | Implementation | Haptic / sound | Effort | Delight |
|---|---|---|---|---|---|
| 3.1 | **Peel-off sticker** (lift from backing on reveal, and when picking up from a board) | Fake it without Skia: two layers. The sticker image rotates on X about one corner (`perspective: 800`, `rotateX` 0→-25°, `rotateZ` small), the drop shadow grows and shifts (`shadowRadius` 2→12, `shadowOffset` y 1→8), and a white "backing" cutout stays put underneath, revealed by the offset. A true curl needs a mesh, which needs Skia. The 2-layer lift gets about 80% of the effect. | `impactAsync(Soft)` at lift start, plus a short paper "tchk" peel sound (3 variants) | M | 5 |
| 3.2 | **Slap a sticker onto the board** | Pan gesture (RNGH `Gesture.Pan`) to drag. On release: `withSpring` scale 1.08→0.96→1 (stiffness about 400, damping about 18), shadow collapses 12→2 over 120ms, rotation settles to its seeded angle. Optional: 3 to 4 tiny "dust" dots puff out radially and fade over 250ms (plain Animated.Views). | `impactAsync(Rigid)` at contact plus a soft "thup" (pitch-varied by sticker size) | S–M | 5 |
| 3.3 | **Stamp press** (on review complete, new place, milestone) | Stamp drops in from scale 1.3 at opacity 0, hits at scale 0.95, then settles. The *ink* layer (an SVG with a turbulence-like rough-edge mask, pre-rendered as PNG) appears at the impact frame with opacity 0.85 and a slight random rotation. Two-tone ink (terra or indigo) with a few "missing ink" speckles baked into 3 PNG variants. | `impactAsync(Heavy)` on hit plus a rubber-stamp "kachunk" | S | 5 |
| 3.4 | **Card flip with weight** | The current flip can gain physics: `rotateY` via `withSpring` (damping about 14, mass 1.2) so it overshoots about 4° and settles, `perspective: 1000`, and a brief scale dip to 0.98 at 90° so it feels like a thick card being turned, not a texture swap. Swap faces at 90° with `backfaceVisibility: 'hidden'`. Allow a pan-driven flip (drag horizontally, release past 35% or past velocity 800 to complete), matching the distance-or-velocity rule in skills.md #8. | `selectionAsync()` at the 90° crossing | S | 4 |
| 3.5 | **Device-motion foil / parallax** (mature cards only) | `useAnimatedSensor(SensorType.ROTATION, { interval: 'auto' })` → roll and pitch → (a) card `rotateX/rotateY` ±6°, (b) a foil gradient layer's `translateX/Y`, (c) the sticker layer offset 3px further than the card for parallax depth. **Without Skia**, foil means an absolutely positioned PNG (a pre-rendered rainbow holo texture with diagonal bands) at about 0.35 opacity over the sticker, masked to the sticker silhouette by reusing the cutout's alpha (render the cutout as a mask via `MaskedView`, which is another small native dependency, or pre-composite on the server). Blend modes are not available in RN views, which is where Skia earns its keep. **Caveats:** Reanimated's docs say iOS sensor reads require Location Services to be enabled on the device. Check `isAvailable`, fall back to a slow autonomous shimmer sweep (and to a static sheen under Reduce Motion), and call `unregister()` when the card is off screen. Only mount the sensor for the **one** focused card, never for a grid. | none (the visual is the reward) | M (no Skia) / M–L (Skia) | 5 |
| 3.6 | **Grade press** (Again/Hard/Good/Easy) | The button depresses 2px (translateY plus shadow shrink, like a TE key), and the card exits in a grade-specific direction: Again slides back into the deck, Good "files" right into a drawer edge. Gesture shortcut: swipe right means Good, swipe up means Easy (with a hint and a visible label, never gesture-only). | Again: `selectionAsync`. Good: `impactAsync(Light)`. Easy: `notificationAsync(Success)`. Sound: a soft card-shuffle "fff" | S | 4 |
| 3.7 | **Session complete without confetti** | Replace confetti with **one stamp on today's diary page** (3.3), then the day's cards fan out briefly as a "hand" and slide into an envelope or the notebook. Celebrate *bigger* moments (first foil card, 100 words) with a **washi tape strip** that unrolls across a summary card (animated `width` with a fixed-texture image, so the texture is revealed rather than stretched). | Stamp haptic plus one chime at most | M | 5 |
| 3.8 | **Pin-drop on cork** (board edit) | Pushpin falls from y-20 with a bouncy spring. The sticker swings once from the pin point (`transformOrigin` top-centre, a damped `withSequence` rotation 6°→-3°→0). | `impactAsync(Light)` plus a tiny "tk" | S | 3 |
| 3.9 | **Calendar page turn** | Month to month as a vertical flip of a tear-off calendar page, or as a scroll with paper-texture edges. A full page curl needs Skia, so do not attempt it without. | `selectionAsync` | S–M | 3 |
| 3.10 | **Audio clip as a cassette or tape label** | The voice-note waveform drawn with react-native-svg as an ink scribble, playing back with a moving "head". | none | S | 3 |

### Sound design
- Use expo-audio (already installed). Keep **about 8 sounds total**: peel, slap, stamp, flip, file/shuffle, pin, chime, page. Record or license *real* paper and rubber-stamp foley, not synth blips. That one choice is most of what separates cozy from game-y.
- Keep each under 150ms except the chime, at -18 to -24 LUFS (quiet), with 3 variants per frequent sound plus a random ±3% playback rate (the Not Boring trick).
- **Respect the silent switch** (iOS `playsInSilentMode: false`), add an in-app "Sounds" toggle, and never interrupt TTS or the user's own recordings. Duck or skip sfx while a pronunciation is playing.
- Preload on app start (a small pool of `AudioPlayer`s). Latency over 50ms makes the sound feel detached from the haptic.

### Is Skia worth adding?
**Yes, eventually, for exactly two things:** (1) blend-mode foil (`color-dodge`, `overlay` or `hard-light` layered over a mask), which is how the well-known [pokemon-cards-css](https://github.com/simeydotme/pokemon-cards-css) gets real holo, and (2) a true sticker peel curl or page curl. `@shopify/react-native-skia` is in the Expo SDK, but it is a native module, so adding it costs **one dev-client EAS build** (ask first, per memory). Prior art: [RNShaderCard (Skia holo card)](https://relatedrepos.com/gh/jerinjohnk/RNShaderCard), [r/reactnative Skia holo thread](https://redlib.hbubli.cc/r/reactnative/comments/1hucloj/shiny_holographic_cards_in_react_native_using_skia), `@0610studio/expo-holographic-card` ([pkgstats](https://www.pkgstats.com/pkg:@0610studio/expo-holographic-card)), [Skia RuntimeShader docs](https://shopify.github.io/react-native-skia/docs/image-filters/runtime-shader), and a [Godot foil shader](https://godotshaders.com/shader/simple-dynamic-holographic-card-effect-foil) to port to SkSL. Recommendation: ship 3.1 to 3.8 without Skia first. Bundle Skia into the next dev-client build that is happening for some other native reason anyway.

Other refs: [Reanimated useAnimatedSensor](https://docs.swmansion.com/react-native-reanimated/docs/device/useAnimatedSensor/) · [Reanimated accessibility / reduced motion](https://docs.swmansion.com/react-native-reanimated/docs/guides/accessibility) · [expo-haptics SDK 54](https://docs.expo.dev/versions/v54.0.0/sdk/haptics) · [Expo blog: sensors](https://expo.dev/blog/how-to-bring-your-react-native-apps-to-life-using-sensors) · [GeekyAnts card flip](https://techblog.geekyants.com/how-to-build-simple-card-flip-animation-in-react-native-using-reanimated-v2)

---

## 4. Making SRS review delightful instead of a chore

| # | Idea | Detail | Effort | Delight |
|---|---|---|---|---|
| 4.1 | **The card matures physically** (the headline idea) | Map `lib/review.ts` phases to materials: **New/learning** is plain kraft paper with a pencil-grey border and the sticker slightly raised. **Young review** (interval 1 to 20d) gets an **ink date stamp** in the corner for each successful review (stamps accumulate, up to about 5 visible, each with seeded rotation). **Mature** (interval ≥21d, Anki's own "mature" threshold) gets a **gold-foil edge plus the tilt shimmer (3.5)**. **Lapse** keeps the foil but gets a small washi-tape "repair" strip, so a lapse is shown as care, not loss. Every state is a *drawn* difference that also has a text label for screen readers ("Mature card"). | M | 5 |
| 4.2 | **The session as a short "trip"** | A session header styled like a ticket: `TODAY · 12 STOPS` in mono. Progress as a stamp-card row of circles that get inked, instead of a progress bar. | S | 4 |
| 4.3 | **Collection completion by *place* and *theme*, not rarity** | "Kitchen: 14/20 common kitchen words", "Kyoto trip: 23 stickers". Completion targets come from a frequency list per category, so they also steer the user toward high-value vocabulary (connects to the syllabus thinking in skills.md #13). Show the empty slots as **dotted die-cut outlines**, like a sticker album with unfilled spaces. That is the strongest collection pull in physical sticker albums, and it is not gambling. | M | 5 |
| 4.4 | **Seasonal / location stamp rallies** | Time-limited themed rallies, eki-style: "Autumn rally: scan 5 things that are 秋". Each completed rally gives a unique illustrated stamp in the diary. They expire gently: missing one just means the stamp is not in the book, with no penalty. | M (art cost dominates) | 4 |
| 4.5 | **Custom card backs** | The user picks a back pattern (washi patterns, seigaiha, asanoha, gingham, kraft) or uses **their own photo of the scene**, framed as a Polaroid. Unlock more by milestones, never sell them as loot. | S–M | 4 |
| 4.6 | **Handwriting on the card** | Let the user trace the word (or anything) with a finger. Store it as SVG path points (`react-native-svg` plus a pan gesture, about 150 lines) and render it on the card back in ink. For kana or kanji learners, writing *is* study. For everyone else it is the most personal mark possible. | M | 5 |
| 4.7 | **Specimen label face** | Card face = sticker plus a museum label block: `№ 0142 · NOUN · 名詞 / collected 14 Oct 2026 · Shimokitazawa / by you`. Newsreader for the word, mono for the metadata. Cheap, coherent, and it *instantly* looks curated. | S | 4 |
| 4.8 | **Gentle streaks** | Track **days you visited the notebook**, shown as stamped calendar days (the diary already exists), with no flame counter and no "you lost your streak". Allow rest days. Follow Gentler Streak's compare-with-yourself framing. | S | 3 |
| 4.9 | **Interleave memories into the session** | Every about 10 cards, a non-graded "postcard" interstitial: the original scene photo plus the date and place. Takes 2 seconds and makes the deck feel like *your* life, not a word list. Must be skippable and capped (once per session). | S | 4 |

Interval maps, sources: [Anki manual: deck stats (mature at 21 days)](https://docs.ankiweb.net/stats.html).

---

## 5. Personal-touch mechanics

| # | Idea | Detail | Effort | Delight |
|---|---|---|---|---|
| 5.1 | **On This Day** | "A year ago today you collected 傘 in Kyoto." Surfaces on the home wall or calendar with the original photo, sticker and voice note. **Include "Hide this memory"** (Facebook's On This Day backlash came from painful memories it surfaced with no filter). Lean on photo EXIF and location data the app already reads (`lib/photoMetadata.ts`, `lib/location.ts`). | S–M | 5 |
| 5.2 | **Location stamps** | Reverse-geocode to neighbourhood or city (not exact coordinates) and generate an eki-style stamp: a circle or shield shape, the place name in mono, the date, and the category icon in the middle. One stamp per new place, collected in a "passport" page. **Privacy:** never show it on anything shared with friends unless the user opts in. | M | 5 |
| 5.3 | **Your own voice** | Already have audio. Make it *visible*: a small cassette or tape-label chip on the card. Over time show "you then vs you now" (first recording beside the latest), so pronunciation progress becomes audible. | M | 5 |
| 5.4 | **"From a friend" provenance** | When a sticker came via a challenge, the card carries a postmark: "sent by Mika · 3 Oct". It sticks permanently, like a signature on a traded card. Cheap to build (the data exists) and emotionally large. | S | 5 |
| 5.5 | **Handwritten note on the back** | Freehand or typed note in a handwriting-ish font (only if it has a real CJK fallback; otherwise use the user's own strokes from 4.6). | S–M | 4 |
| 5.6 | **Home-screen widget** | "Today's sticker" or "word from Mika", à la Locket. Needs a native widget extension (`expo-apple-targets` or similar), so an EAS build. High-reach later item. | L | 4 |
| 5.7 | **Year-end "travel journal" recap** | A shareable auto-generated spread: stamps collected, places, most-reviewed word, first and last sticker. Year-end seasonality drives sharing. | M–L | 4 |

---

## 6. Pitfalls

**Tackiness**
- **One metaphor, its rules, no exceptions.** No glowing gradients or XP bars beside paper. If a paper, ink, tape or foil object could not do it, do not do it. Confetti is the classic failure, because it belongs to a party, not a notebook.
- **Ration the shine.** Foil and shimmer go on *mature cards and milestone stamps only*. If everything sparkles, nothing does, and the effect reads as a mobile game.
- Do not let texture fight text. Cork and kraft behind body copy kills legibility. Text goes on a clean card stock panel (cork only at the edges).
- Keep the illustration style consistent. Mixing 3D Airbnb-style icons, flat icons and hand-drawn stamps reads as a template. Pick hand-drawn ink plus photographic stickers, and render any 3D in a matching material.

**Over-gamification**
- A qualitative study of Duolingo users documents "gamification misuse": users fixate on points and streaks at the cost of learning. Research cited by The Decision Lab (Silverman et al., JCR 2023) reports that people who **break a streak are more likely to quit entirely**. Use streak-free or forgiving progress (4.8).
- Tie rewards to **effort and mastery, never chance**. No loot boxes and no random rarity on user memories.
- No guilt notifications ("Your stickers miss you 😢"). Gentler Streak won an ADA for the opposite tone.

**Accessibility**
- **Contrast:** terra `#9D4D51` with white text is 5.8:1 (computed; passes AA). Check every *new* surface: ink stamps on kraft paper will tend to fail, and stamps that carry meaning (the date) need real text too. Foil overlays must not drop text contrast, so foil goes on the sticker or edge, never under the word. skills.md #12 already notes white on success/error needs the Deep tokens.
- **Reduce Motion:** Reanimated 4 snaps animations by default, which is fine for most. Use `useReducedMotion()` to **disable the sensor tilt entirely** (parallax is a vestibular trigger, and the canonical reason Reduce Motion exists), replace flips with crossfades, and keep stamps (opacity only).
- **Never haptic-only or sound-only meaning.** iOS drops haptics in Low Power Mode or with the camera active, and many users are on silent.
- Screen readers: the card's material state ("mature, foil") and stamps need `accessibilityLabel`s. Decorative tape and dust get `accessibilityElementsHidden`.
- Respect Dynamic Type on the card face. Newsreader at large sizes needs the layout to reflow, so test at AX3.

**RN performance**
- Run `useAnimatedSensor` for **one card at a time** and unregister off screen. A sensor per grid cell will cook the battery and the JS-to-UI bridge.
- Shadows: animating `shadowRadius` on many views is costly on iOS. For boards, prefer a pre-blurred shadow PNG under each sticker and animate its opacity and scale.
- Images: use expo-image with `cachePolicy` and correctly sized thumbnails. Texture backgrounds should be tiled small PNGs, not full-screen JPEGs.
- Sound pool: preload. Creating a player per tap leaks and lags.
- Keep animated values on the UI thread (worklets). The skills.md #8 trap applies: guard flags as shared values, not refs.
- Skia: one canvas per *focused* card, not one per list item.

Sources: [arXiv: gamification misuse in a language app](https://www.arxiv.org/abs/2203.16175) · [Decision Lab: Streak Creep](https://thedecisionlab.com/insights/consumer-insights/streak-creep-the-perils-of-too-much-gamification) · [Reanimated accessibility](https://docs.swmansion.com/react-native-reanimated/docs/guides/accessibility) · [expo-haptics v54 caveats](https://docs.expo.dev/versions/v54.0.0/sdk/haptics)

---

## 7. Suggested order (best delight per effort first)

1. **`lib/feel.ts`** haptic plus sound vocabulary, plus 8 foley sounds (S, sets the tone for everything). ★5
2. **Specimen-label card face (4.7) plus seeded hand-placed jitter** (S). ★4
3. **Stamp press (3.3)** for session complete and new places, replacing any confetti (S). ★5
4. **Slap onto board (3.2) and peel lift (3.1)** (S–M). ★5
5. **"From a friend" postmark (5.4) and On This Day (5.1)** (S–M). ★5
6. **Card matures paper → stamped → foil (4.1)** with the no-Skia shimmer (3.5) (M). ★5
7. **Album-style empty slots by category (4.3)** (M). ★5
8. Handwriting (4.6), location stamp passport (5.2), custom backs (4.5) (M).
9. Next native build: **Skia** for real foil and peel curl, then the widget (L).

Everything in steps 1 to 8 is JS-only with the installed dependencies, so zero EAS builds are needed via the dev client. One exception: the sensor shimmer needs no new dependency, but a masked foil without Skia needs `@react-native-masked-view/masked-view`, which is native. Check whether the current dev client already includes it before assuming no build is required.
