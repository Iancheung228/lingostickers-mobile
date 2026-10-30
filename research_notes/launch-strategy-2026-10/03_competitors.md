# Tabi Stickers: competitive landscape (researched 2026-10-29)

Method: web search and App Store page fetches. Ratings and prices are App Store (US) as fetched, unless noted. Download and revenue figures come from third-party estimators (screensdesign, FoxData, Appfigures) and are **estimates, not disclosures**. Where I could not verify something, I say so.

---

## 0. The headline finding

**The core loop of Tabi (photo, sticker cutout, word, pronunciation, SRS) is already shipped, and it won awards.**
**CapWords** (HappyPlan Tech, a 3-person team in Beijing) won the **2025 Apple Design Award (Delight and Fun)** and a 2025 App Store Award. It is also an Editors' Choice and has been App of the Day. Its pitch is word-for-word Tabi's: photograph an everyday object, the app cuts it out as an animated sticker (VisionKit), names it and speaks it, collects it, and reviews it with spaced repetition. Since it won, a **wave of clones** has appeared: KaChiKa, Cakeword, StickerWords, StickWords, Heywords, Photovocab, Snapic, LingoCam, CamLingo, VocaSnap, PicWords, WordsLeap, 2PicUp, Snap & Learn Photobulary, and others.

So Tabi cannot position as "photo-to-sticker vocabulary." That is now a category with an Apple-anointed leader. It has to position on what CapWords and the clones **don't** do (section 4). Guideline 4.3(b) also matters here: Apple can reject apps "indistinguishable from what's already widely available" (section 6).

---

## 1. Direct competitors (camera/photo to vocabulary)

| App | Who | Rating (US) | Price | Notable |
|---|---|---|---|---|
| **CapWords AI** ([App Store](https://apps.apple.com/us/app/capwords-ai-learn-languages/id6738896465)) | HappyPlan Tech, Beijing, 3 people | **4.7 ★ / 644** | Free + IAP. Monthly $5.99 / $4.99 (A/B). Yearly $29.99 / $19.99. 3-day trial | ADA 2025 winner. Stickers, SRS ("Smart Review"), "Scenario Memory Cards", auto-categories, widgets, dark mode, CloudKit sync, export. v2.0 (Jul) added **Speak**, AI conversation partners that use your saved words and photos. 9 UI languages; one source says it teaches up to 27 languages ([Similar Labs](https://similarlabs.com/zh/p/ai-snap-learn-langs)). **No social features.** Cantonese not confirmed |
| **KaChiKa** ([App Store](https://apps.apple.com/app/id6740193802)) | Chengdu Yichen Tech | 4.6 ★ / 21 | $2.99/mo, $29.99/yr | Photo stickers, forgetting-curve SRS. Teaches EN, KO, FR, ZH, ES, IT. No Japanese listed, no Cantonese |
| **Cakeword: Snap & Learn** ([aitoolly](https://aitoolly.com/en/product/cakewordai), [hunted.space](https://hunted.space/product/cakewordai-snap-learn)) | indie | n/a | Free + one-time Pro (per aggregators) | Sticker cutout, Pokédex-style "Word Dex", **on-device, no account, iCloud sync**, aimed at kids 4+. iOS 26.4+. The closest privacy-first clone |
| **StickerWords** ([huntscreens](https://huntscreens.com/products/stickerwords)) | indie | n/a | not listed | Camera to vocab cards, Anki-style SRS. EN/ES/ZH/FR/JA/KO/DE/IT |
| **Heywords: AI Word Stickers** ([App Store](https://apps.apple.com/app/id6753859247)) | indie | few | $1.99/mo, $12.99/yr | Kids and English learners, example sentences |
| **StickWords** ([App Store](https://apps.apple.com/py/app/stickwords-ai-snap-word-smart/id6749015848?l=en-GB)), **Photovocab** ([App Store](https://apps.apple.com/app/id6575364615)) | indie | ~0–1 ratings | Free + IAP | Sticker-style photo flashcards |
| **WoziGrow** ([App Store](https://apps.apple.com/us/app/wozigrow-visual-flashcards/id6755804611)) | indie | 8 ratings | Free + IAP | Hand-drawn sticker per word, sticker album (no camera) |
| **Snapic** ([Product Hunt](https://www.producthunt.com/p/snapic-words-in-your-world/snapic)) | indie | n/a | n/a | "AI vocabulary stickers", 100+ languages |
| **LingoCam** ([App Store](https://apps.apple.com/app/lingocam/id6745829446)), **CamLingo** ([App Store](https://apps.apple.com/us/app/camlingo/id6747738762)), **VocaSnap** ([App Store](https://apps.apple.com/app/id6777303117)), **PicWords** ([App Store](https://apps.apple.com/us/app/picwords-snap-learn/id6748814263)), **WordsLeap** ([App Store](https://apps.apple.com/mm/app/wordsleap-scan-learn-words/id6748490309)), **2PicUp** ([App Store](https://apps.apple.com/pw/app/2picup-snap-it-learn-it/id6702016486)), **Snap & Learn: Photobulary** ([appshunter](https://appshunter.io/ios/app/snap-and-learn-photobulary/id6748889002)), **SnapLingo** (iPad, [App Store](https://apps.apple.com/us/app/snaplingo/id6477288904)), **LingoLens** ×2 ([1](https://apps.apple.com/ml/app/lingolens-learn-languages/id6502578008), [2](https://apps.apple.com/ml/app/lingolens-language-learning/id6753199987)) | mostly solo or small | "not enough ratings" | Free + IAP | Object recognition to bilingual label or card. Little traction visible |
| Legacy "camera translator" apps (e.g. [Camera Translator Pro](https://apps.apple.com/us/app/-/id1293662925), 1.0 ★; [Snap & Translate](https://apps.apple.com/us/app/id1313211434)); FlashAcademy's [Object Translator](https://support.flashacademy.com/hc/en-gb/articles/7010357726749) (a feature, kids/schools) | | | | Translation utilities, not learning products |

**CapWords traction (estimate):** about 30k installs and about $20k revenue a month ([screensdesign](https://screensdesign.com/showcase/capwords-ai-photo-vocabulary)). Even the award-winning category leader is a ~$240k/yr business. **This is a niche, not a land-grab.**

**CapWords design and onboarding notes** ([Apple developer article](https://developer.apple.com/articles/capwords), [screensdesign](https://screensdesign.com/showcase/capwords-ai-photo-vocabulary)):
- Capture runs in stages (capture, remove background, confirm, display), with a micro-animation that hides the LLM wait.
- VisionKit does the cutout and Neural Voice does TTS. CloudKit means no backend; photos are sent to an LLM once and then deleted.
- Onboarding has six steps and opens with a live demo of the camera feature. The **soft paywall with a 3-day trial comes right after the "magic moment", before you can save your first word.**

**CapWords complaints (useful to Tabi):**
- About 2 free captures, then a credit card is required to start the trial ("locks down to demand credit card info"). Users resent this.
- Wrong or uncommon word choice (an obscure Japanese word for "smartphone").
- The sticker effect needs good light and a clean background.
- No romaji/romanization for Japanese (review request, via [developer article search](https://developer.apple.com/articles/capwords)).
- A reviewer rated it 65%: "limited in depth and structure", good for everyday vocab and not as a main tool ([ThinkInItalian](https://www.thinkinitalian.com/app-review/capwords)).

**What this means for Tabi's existing differentiators:**
- **Sentence plus gloss plus a grammar syllabus** (rotating structures by CEFR band, with validated segmentation) answers the "limited depth" complaint directly. No clone advertises anything like it.
- A **promptable lasso cutout** (choosing the instance the user circled) answers the "needs a clean background" complaint.
- **Learning steps in minutes plus SM-2** is more serious SRS than the "Smart Review" suggestions.
- **Cantonese** (with jyutping) is offered by none of the photo-vocab apps I found.
- **Friends and challenges** appear in none of them.
- **Calendar diary of finds and sticker boards**: CapWords has a collection and categories but no journal or diary framing.

---

## 2. Adjacent competitors

### SRS / flashcards
| App | Price | Relevance |
|---|---|---|
| **AnkiMobile** | **$24.99 one-time** (desktop/AnkiDroid free) ([Anki FAQ](https://docs.ankiweb.net/faqs/why-does-ankimobile-cost-more-than-a-typical-mobile-app.md)) | Serious learners' default. Ugly but trusted. Tabi's SRS rigor is in Anki's register, with far better vibe |
| **Noji** (ex-Anki Pro) | $4.99/mo, ~$29.99/yr, **$74.99 lifetime**; usable free tier ([App Store](https://apps.apple.com/us/app/1573585542), [help](https://help.noji.io/en/articles/9658530-can-i-use-noji-for-free)) | Polished consumer Anki. Lifetime-tier precedent |
| **Mochi** | No App Store IAP per [apppricinglab](https://apppricinglab.com/app/apple/1507775056); Pro is web-billed (unverified) | Markdown power users |
| **Quizlet** | Plus ~$35.99/yr (sources conflict) ([thepricer](https://www.thepricer.org/how-much-does-quizlet-plus-cost/)) | Students, not real-world capture |
| **Brainscape** | ~$95.99/yr in-app (unverified) | — |
| **Bunpro** (JP grammar SRS) | $5/mo, **$150 lifetime** (sales to $120) ([pricing](https://bunpro.jp/pricing)) | Shows JP learners pay for lifetime |
| **Renshuu, Migaku** | Couldn't verify current pricing | Renshuu has a generous free tier; Migaku is the immersion power-user tool |

### Mainstream language apps (approximate US prices; sources disagree)
- **Duolingo**: Super ~$60–84/yr; Max ~$168/yr; Family ~$120/yr ([dealnews](https://www.dealnews.com/features/duolingo/cost), [toolradar](https://toolradar.com/tools/duolingo/pricing)).
- **Babbel**: ~$90/yr for one language. **Busuu**: ~$10–14/mo. **Speak**: ~$84/yr ([mindomax](https://www.mindomax.com/babbel-vs-duolingo)).
- **Cantonese gap:** Duolingo and Babbel don't teach Cantonese to English speakers. Migaku (Dec 2025) says big apps "skip Cantonese entirely or phone it in" ([Clozemaster](https://www.clozemaster.com/blog/?p=7174), [Migaku](https://migaku.com/blog/language-fun/best-cantonese-learning-apps), [Preply](https://preply.com/en/blog/best-apps-to-learn-cantonese)). Heritage learners (diaspora kids of HK and Guangdong families) are a motivated, underserved niche with strong community channels.

### Vibe / cozy / journaling
- **Finch** (self-care pet): ~4.95 ★ from 550k+ ratings, ~2.3M downloads per 90 days (FoxData estimate). Grew almost entirely through **user-made TikTok content**, and its best paid ads were also TikTok ([FoxData](https://foxdata.com/en/blogs/finch-as-app-store-editors-choice-a-self-care-companion/), [Medium](https://medium.com/@jashsak/the-12m-mental-health-app-that-broke-every-silicon-valley-rule-bd9d06e725f8)). Its streaks exist but are framed gently; the pet never dies.
- **Locket**: a solo-built home-screen photo widget for close friends (originally capped at 5). It hit #1 in the US in Jan 2022 with 2M sign-ups in about two weeks, through the founder's TikTok, a reused sound, and an invite loop ([TechCrunch](https://techcrunch.com/?p=2256184), [Appfigures](https://appfigures.com/resources/insights/20220114/5-new-year-new-widget-same-growth-strategy)).
- **BeReal, Retro, Day One, Apple Journal**: daily-capture and memory apps. Apple Journal is free and first-party, so Tabi's diary must be *about language*, not journaling in general.
- **iOS Live Stickers** (iOS 17+, long-press to lift a subject into Messages stickers) and **Visual Intelligence** in iOS 26 ([MacRumors](https://www.macrumors.com/guide/ios-26-apple-intelligence-features)) are free and built in. The cutout alone is a commodity.

---

## 3. Pricing and monetization norms

- **Education category medians** (RevenueCat 2025, via [Airbridge](https://www.airbridge.io/en/blog/subscription-app-pricing-by-category-2026-benchmark)): annual **$44.99**, monthly **$8.38**. These are the highest of any category. Hard-paywall-plus-trial apps convert at ~10.7% median vs ~2.1% for freemium (third-party summary; treat as directional).
- **Photo-vocab cluster actual prices:** $12.99–$29.99/yr and $2–6/mo. That is **well below** the education median, because the category is positioned as a supplement.
- **Lifetime norms for indie learning tools:** AnkiMobile $24.99, Noji $74.99, Bunpro $150. A lifetime option at about 2–2.5× the annual price is normal and well liked in the JP-learner community.
- **AI-cost free tiers:** CapWords allows ~2 captures, then a card-required trial. That hard gate is its most-cited complaint. Tabi's per-scan cost (Gemini Flash-Lite, small fraction of a cent per call per the internal bake-off) supports a **generous free tier**, which is a differentiator in itself. Suggested shape:
  - Free: **~3–5 new stickers/day**, unlimited review of existing cards (reviews cost nothing in inference), friends and challenges free (they are the growth loop).
  - Paid: unlimited scans, extra languages, boards/themes, export, widgets.
  - Price: around **$3.99/mo, $24.99–29.99/yr, $59–69 lifetime**, launched with a "founding member" discount.
  - Gate scans, never reviews. An SRS that locks your own cards poisons trust.

---

## 4. Positioning: gaps and risks

**Where nobody is playing (from what I found):**
1. **Social vocabulary.** None of the ~15 photo-vocab apps has friends, challenges, or sharing beyond export. Tabi's challenges (send a sticker, the friend guesses the word) are the one mechanic that is both a product and a growth loop.
2. **A diary of your life in another language.** CapWords is a Pokédex, a collection of objects. Tabi's calendar of finds plus boards turns it into a memory artifact: "my Kyoto trip in Japanese." This is the Day One / Locket emotional register applied to SRS, and no one combines them.
3. **Depth for adult serious learners.** Clones target kids or casual learners ("Pokémon for words"). Tabi has sentence-in-context, gloss, a grammar syllabus, and real SRS. "The photo-vocab app that respects Anki users" is open.
4. **Cantonese** (jyutping, HK usage) as a first-class language. Only niche Cantonese apps and tutors serve it.
5. **Trip-prep and trip-memory use.** Japan travel is the obvious hook, with a "Tabi" (旅, "journey") brand that already says it.

**Where Tabi risks being a feature, not a product:**
- **Apple:** subject lift and Visual Look Up already exist. One Apple Intelligence update could add "translate this object" to Visual Intelligence. Apple would not ship SRS, a diary, or friend challenges.
- **Google Lens / Google Translate camera** already translate objects and scenes for free. Again, no retention loop.
- **CapWords** is the real threat. It is funded by revenue, iterates fast (v2.0.16, weekly releases), and has added AI conversation. If it adds social features, Tabi's best differentiator narrows. Ship challenges and diary prominently and lead the marketing with them, not with "turn objects into stickers."
- **Guideline 4.3(b) "spam":** a reviewer may see "another CapWords clone." The App Store description and screenshots should lead with the diary, challenges, sentence/grammar, and Cantonese.

**Suggested one-liner direction:** "A sticker diary of your life, in the language you're learning. Collect what you see, swap it with friends, remember it for good." Not: "Snap objects to learn words."

---

## 5. Growth patterns that fit

- **Shareable artifact first.** Finch and Locket grew through user-made TikToks of something visual and emotional. Tabi's natural artifacts:
  - a month's **sticker board or calendar** ("my October in Japanese"), exported as a 9:16 image or video;
  - a **challenge card** ("can you guess what this is in Cantonese?"), shared as a link or image that opens in the app or App Clip.
  - Add one-tap export to Stories/TikTok with a watermark.
- **Widget:** a home-screen sticker-of-the-day, or a due-review sticker (CapWords added widgets in Sep 2026). Locket proves widgets plus close friends is a strong loop. A "friend's latest sticker" widget is very on-brand.
- **Non-punitive streaks:** Finch-style. Count "days with a find" weekly rather than daily, allow freezes, and don't use guilt notifications. Duolingo's punitive streak is widely parodied and is the thing to differentiate from.
- **Founder-led short-form content:** a solo founder filming "learning Japanese from my fridge," and Cantonese heritage-learner content (an underserved, vocal community on TikTok and r/Cantonese). At ~200 users/month this is the realistic channel. Paid ads are not.
- **App Store featuring:** CapWords shows Apple features this exact aesthetic. Submit the [featuring nomination form](https://developer.apple.com/app-store/getting-featured/) around launch, emphasizing the on-device Vision lasso cutout, widgets, and accessibility. Apple likes first-party framework showcases.
- **ASO:** "language learning" ranks ~11k apps and Duolingo dominates generic terms ([Appfigures](https://appfigures.com/resources/app-teardowns/duolingo)). Target long-tail terms:
  - "photo vocabulary", "sticker flashcards", "picture dictionary", "learn Cantonese", "jyutping", "Japanese vocabulary camera", "French words from photos", "travel phrase journal", "visual flashcards SRS".
  - Use the subtitle for a keyword phrase, e.g. "Photo Vocabulary Sticker Diary".
  - Localize screenshots for JP, HK, TW, and FR storefronts.

---

## 6. App Store review considerations ([guidelines](https://developer.apple.com/app-store/review/guidelines/))

- **1.2 UGC:** friend challenges carry user photos, so the app needs filtering, report, block, timely response, and **published contact info**. Report and block already exist; also confirm a filtering step (even basic moderation) and a support URL/email in the listing.
- **1.2.1(a) / age rating:** answer the new age-rating questionnaire honestly. UGC between friends usually pushes the rating above 4+. Don't put the app in the Kids category: 1.3 bans third-party analytics and AI calls would complicate it.
- **5.1.2(i) third-party AI (Nov 13, 2025):** "clearly disclose where personal data will be shared with third parties, **including with third-party AI**, and obtain explicit permission before doing so" ([TechCrunch](https://techcrunch.com/2025/11/13/apples-new-app-review-guidelines-clamp-down-on-apps-sharing-personal-data-with-third-party-ai)). Photos sent to Gemini need an **explicit consent screen naming the provider before the first scan**; a privacy-policy line is not enough. Name Google/Gemini (and Groq if it remains a fallback).
- **4.8 Login Services:** Sign in with Apple, or an equivalent privacy-preserving login, is required only if Google or another third-party login is offered. Email/password-only is exempt.
- **5.1.1(v):** in-app account deletion is required (the app has delete-account).
- **Privacy nutrition labels:** declare Photos (user content), User ID, email, possibly Coarse Location if the diary geotags, and Audio if recording is stored or sent. Also declare data shared with the AI processor and whether it is linked to identity.
- **4.3(b) spam / 4.1 copycats:** see section 4. Differentiate the listing clearly from CapWords and avoid derivative naming or icons.
- **AI-generated content:** there is no dedicated rule in the visible guidelines, but generated sentences shown to users fall under general objectionable-content rules. Keep the existing blocked/safety handling, and consider an "AI-generated, may contain errors" note plus a "report a wrong word" action. That also answers CapWords' most common accuracy complaint.

---

### Source caveats
- Revenue and download numbers (CapWords ~$20k/mo, Finch) are third-party estimates.
- Duolingo/Babbel/Quizlet/Brainscape prices come from affiliate sites that disagree.
- Mochi, Migaku, and Renshuu pricing were not verified.
- I could not confirm CapWords' full list of learnable languages, or whether it supports Cantonese.
