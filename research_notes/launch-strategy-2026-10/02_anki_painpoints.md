# Anki / SRS pain points: user research for Tabi Stickers

Researched 2026-10-29. Sources: Hacker News, Reddit (read through mirrors and snapshot sites, since reddit.com blocks fetching), the AnkiWeb forums, the WaniKani and Bunpro forums, App Store reviews, independent blogs, and peer-reviewed papers.

**How much to trust each source.** Many results for "Anki burnout" are SEO pages written by AI-flashcard vendors (studycardsai, neonlingo, noun.town, mindomax). I used them only for corroboration and marked them **[vendor]**. Quotes marked "verbatim" came from pages I actually fetched. Items marked **(lit.)** are standard citations that I did not re-fetch this session.

---

## 1. Top 15 pain points, ranked by frequency × intensity

The score is a judgement call. Frequency means how often a complaint showed up across independent sources. Intensity means whether it makes people *quit* (high) or just grumble (low).

| # | Pain point | Freq | Intensity | Key evidence |
|---|---|---|---|---|
| 1 | **Review debt / the backlog spiral.** Miss a day or two and you face hundreds of cards. Guilt follows, then avoidance, then you quit. | Very high | Quit-level | HN: *"once you fall behind you're done… The current algorithms just drown you in the cards you've forgotten."* (lostdog). Med student: *"reviews tend to pile up quick despite me even pressing easy on a bunch… I'm not able to keep up."* A learner describes a missed day that *"would quickly escalate into an overwhelming backlog that made me feel like I was suffocating."* [vendor-collected]. WaniKani has many threads titled "burnout", "Post-Vacation Mode Pile-Up" and "Going cold turkey after level 60 or else it will never end". |
| 2 | **Card-creation cost.** Making good cards (definition, sentence, audio, image) is slow, and doing it on a phone is worse. | Very high | Quit-level | HN: *"the biggest barrier to using it is the card creation itself"* (AndyIsBuilding); *"Preparing cards is big overhead"* (throwaway1114). HN also says *"it's a pain to quickly make cards on the phone"* with AnkiDroid. One Japanese learner reports *"three hours a week just making cards"* [vendor-collected]. |
| 3 | **Tedium and joylessness.** Reviews feel like a chore cut off from why you are learning. | Very high | Quit-level | r/German, "Is it just me or is Anki the worst part of learning language?": opening Anki makes it *"feel like a demon sucked every bit of motivation out of me"*; *"Flash cards are tedious, no matter what the format."* HN: *"It sounds more like a chore"*; *"learning is not fun anymore."* A Japanese Level Up post: *"I was getting the most out of creating the cards, and tended to dread the actual reviewing."* |
| 4 | **Ugly, dated UI.** | High | Medium. Users rarely quit over it alone, but it drags on motivation daily and drives people to alternatives. | HN: *"The software tends to be ugly and/or too complicated… it looks like a piece of software from 1995"* (keiferski). Borretti: Anki *"has a very unfortunate UI… the interface is ugly"*, while *"Mochi is beautiful, clean, and elegant."* hhofner: *"its UI is poor and hard to use."* AnkiWeb forum: AnkiMobile *"looks like it was not designed by a professional designer."* r/German commenter: built their own app because of *"how much i disliked anki's ui."* |
| 5 | **Learning curve and settings overload.** | High | Medium-high, because it causes early drop-off. | AnkiMobile review: *"Everything about this app is clunky… it shouldn't take an hour to figure out how to get started with something as simple as flash cards."* AnkiWeb forum: a tutor says *"most students get confused by tinkering with deck options"*, and *"Anki default settings configuration is definitely not appropriate for beginners."* Lemmy: *"Anki is overwhelming for beginners."* |
| 6 | **Decontextualised words: recognition without production.** People pass the cards but can't use the words. | High | High. It undermines the reason to keep going. | Forum: a learner recognises studied words when reading but recalls *~40% in conversation*. The "Anki zombie" who answers every card but *"cannot hold a five minute conversation."* r/languagelearning: *"by itself it won't help you use the words irl."* Natively and r/LearnJapanese: frequency decks leave learners who know a word's meaning but can't read a sentence containing it. |
| 7 | **Premade decks feel impersonal or irrelevant**, yet making your own deck is #2. | High | Medium | r/German: downloaded decks *"never worked for me"*. Core 2k/6k is called "outdated" on r/LearnJapanese, and Kaishi 1.5k is recommended instead. Premade decks *"vary in quality… machine-translated audio"* [vendor: noun.town]. The common advice is to start with a premade deck and then switch to mined cards, which admits that premade decks are a stopgap. |
| 8 | **Leeches.** The same few words fail forever. | Medium-high | High frustration | r/German OP keeps forgetting *"the same 10 words."* Anki's manual auto-suspends a card after 8 lapses. Guides warn against trying to *"brute force"* a leech and say to rewrite it in a new sentence or context. |
| 9 | **Scheduler opacity and "ease hell"** (SM-2 cards stuck at low ease). | Medium (power users) | Medium | The AnkiWeb forums and the kuroahna SM-2 guide document SM-2 ease hell. FSRS fixes it with mean-reverting difficulty, though some users still report it feeling "ease-hellish". Pressing "Easy" doesn't reduce the pile (see #1). |
| 10 | **AnkiMobile price and sync reliability.** | Medium | Medium | *"I do not think it's worth $25."* *"There is a synchronize button… this has yet to work for me a single time."* *"the first deck I created was deleted to some error while synchronizing."* |
| 11 | **No sense of progress or narrative.** The only feedback is a number going down. | Medium | Medium | Noun.town [vendor]: *"Anki is functional rather than enjoyable… no narrative or progression beyond a number going down."* Borretti: retention, *"the stat you care about,"* is *"underemphasized."* People install the Review Heatmap, Puppy Reinforcement and Killstreaks add-ons to supply streaks and rewards. |
| 12 | **Basics require plugins.** | Medium | Low-medium | Borretti: *"any usage above 'absolute novice' involves using multiple Python plugins."* Theming needs ReColor or Catppuccin, which only change the app chrome, not the cards; styling cards means editing template CSS. |
| 13 | **Doing too much too soon.** No guardrails stop people adding 20+ new cards a day. | Medium | High, because it feeds #1. | *"adding 15 new cards a day… can quickly find themselves facing 200 reviews."* WaniKani advice: stop lessons until the apprentice count is around 100-120. |
| 14 | **Hostile monetisation and content removal in "fun" alternatives.** | Medium | High (churn spikes) | Duolingo's 2025 switch from hearts to energy: *"feels less like learning and more like a paywall"*, a change.org petition, and a wave of negative App Store reviews in June 2026. Memrise removed community courses and **"mems"** (user-made mnemonic images) in 2024 against *"overwhelmingly negative feedback"*. One reviewer said it *"killed the value of the app."* |
| 15 | **Rigid answer checking and grading.** | Low-medium | Medium | Clozemaster marks valid kana or kanji alternatives wrong. Bunpro's review format *"doesn't work with advanced grammar"*, and its queue-order bugs *"mess with the core feature of SRS."* |

**Underlying pattern:** #1, #2 and #3 together are the abandonment engine. Cards are costly to make, reviews are joyless, and the debt builds until the guilt outweighs the benefit. Everything else adds friction on top.

### Source URLs (section 1)
- HN "Why don't you use spaced repetition…": https://news.ycombinator.com/item?id=41913751
- r/German "Anki the worst part of learning language?" (snapshot): https://reddit.sentinel-team.org/posts/1slaw8l/snapshots/2026-04-14T21%3A09%3A39.786649Z
- r/medicalschoolanki pile-up (snapshot): https://reddit.sentinel-team.org/posts/1rqztg2/snapshots/2026-03-12T12%3A50%3A31.416503Z
- Borretti, First impressions of Mochi: https://borretti.me/article/first-impressions-mochi
- hhofner, On quitting Anki: https://slims-hhofner-com.vercel.app/blog/on-quitting-anki
- Japanese Level Up, "You hate studying Japanese with Anki": https://japaneselevelup.com/?p=11510 and "Quitting after 12 years": https://japaneselevelup.com/?p=26463
- ESRH, Why I quit Anki: https://esrh.netlify.app/posts/2022-09-18-quitting-anki
- AnkiMobile App Store reviews: https://apps.apple.com/us/app/ankimobile-flashcards/id373493387?see-all=reviews
- AnkiWeb forum, AnkiMobile interface: https://forums.ankiweb.net/t/suggestion-improve-ankimobile-s-interface-design/67315
- AnkiWeb forum, tiered settings: https://forums.ankiweb.net/t/suggestion-tiered-settings-levels-and-actions-based-on-experience/8702
- Lemmy, Anki overwhelming: https://lemm.ee/post/20457606
- Anki burnout [vendor]: https://www.neonlingo.com/blog/anki-burnout
- Anki still worth it 2026 [vendor: Noun Town]: https://noun.town/blog/is-anki-still-worth-using-in-2026/
- Recognition vs production: https://www.neonlingo.com/blog/why-anki-words-dont-stick ; https://r.enesgenc.dev/r/languagelearning/comments/1ka81qs/
- Premade vs tailored decks: https://forums.learnnatively.com/t/premade-deck-or-tailored-deck-thoughts/15698
- Anki leeches manual: https://docs.ankiweb.net/manual/leeches
- Ease hell / FSRS: https://forums.ankiweb.net/t/does-fsrs-solve-ease-hell/38275/2 ; https://kuroahna.github.io/anki_srs_kai/guide/issuesWithAnkiSM2.html ; https://forums.ankiweb.net/t/ease-hellish-in-fsrs/44622
- WaniKani burnout: https://community.wanikani.com/t/wanikani-burnout/45506 ; https://community.wanikani.com/t/post-vacation-mode-pile-up/66321 ; https://community.wanikani.com/t/going-cold-turkey-after-level-60-or-else-it-will-never-end/52149
- Duolingo energy: https://www.androidauthority.com/quitting-duolingo-energy-system-3599842/ ; https://www.change.org/p/duolingo-hearts-not-energy
- Memrise community courses and mems: https://en.wikipedia.org/wiki/Memrise ; https://kimola.com/reports/uncover-the-impact-memrise-apps-user-feedback-report-app-store-us-147885
- Bunpro SRS critique: https://community.bunpro.jp/t/srs-elements-of-bunpro-poorly-implemented/29044
- Clozemaster grading complaint: https://community.wanikani.com/t/here-comes-a-new-challenge-err/16067

---

## 2. How Tabi maps onto these pain points

### Naturally solves (or strongly helps)
- **#2 Card-creation cost.** This is the biggest win. One photo produces the word, TTS, a sentence, a gloss and a sticker. It removes the step HN calls *"the biggest barrier."* It is also mobile-first, which fixes the "pain to make cards on the phone" complaint.
- **#4 Ugliness and #12 plugins for basics.** A sticker collection is beautiful by default, with no ReColor or CSS needed. Positioned against Anki's look, this is a real wedge, and Mochi shows people will switch for polish alone.
- **#7 Impersonal decks.** Every card is literally your mug or your cat. The self-reference effect applies (see section 5), and this is "sentence mining" for the physical world.
- **#3 Tedium (partly).** Capture is a game in its own right, and a sticker book is a collection with visible progress (#11). Reviewing your own photos carries an episodic memory hook that a text card does not.
- **#6 Decontextualised words (partly).** The scene sentence plus the word-by-word gloss gives real context and some grammar per card. Note the caveat: it is still recognition-heavy unless you add production.
- **#5 Learning curve.** The settings can be opinionated and hidden.
- **#8 Leeches (partly).** Tabi has a native fix Anki lacks: when a card leeches, prompt *"take another photo of a different X"*. Re-encoding in a new context is the standard leech advice ("find a new sentence"), and it is supported by the varied-context finding (Smith, Glenberg & Bjork 1978).

### Doesn't touch
- **#1 Review debt.** Tabi uses an SM-2 scheduler with learning steps, the same mechanics that produce the backlog spiral. Prettier cards do not change the arithmetic.
- **#9 Ease hell.** SM-2 ease hell applies to Tabi as built. Consider FSRS (ts-fsrs is MIT-licensed and works in TypeScript).
- **#15 Grading.** Tabi uses self-grading, so this is fine for now; it would only matter if Tabi added typed answers.
- **Production gap (rest of #6).** Production still needs explicit work: audio-first cards, a "say it" card with speech recognition, or "describe this photo" prompts.

### Might make **worse** (design risks)
1. **Capture is more fun than review, so people over-capture and build review debt faster.** The joy of capture is upstream of #1 and #13. One walk round the house can mint 40 cards, which is about 400 reviews over the next fortnight. This is the biggest risk. A daily new-card cap and a "sticker book vs study deck" split are mandatory. Mochi's model of not auto-adding every card to reviews is a good precedent.
2. **Photo friction for card creation.** You need the object physically present, in good light, with a clean cutout. It is cheaper than typing an Anki card but more expensive than tapping "add" on a frequency-list word. Offer a fallback path (pick from the camera roll; type a word and get an AI-generated image or a stock sticker).
3. **Concrete nouns only.** Photos give nouns, while verbs, adjectives, function words and grammar carry most of a language. Your vocabulary runs out by the second week ("I've photographed everything in my flat"), so retention of *users* is tied to novelty of *surroundings*. See section 5 for extensions.
4. **Semantic clustering interference.** Photographing the kitchen produces a cluster of kitchen nouns in one session. Tinkham (1993, 1997) and Waring (1997) found that learning *semantically related* sets at the same time causes interference, while *thematic* sets (a story or scene) help. Tabi's scene sentence is thematic, which is good. The risk is a batch of 10 utensils introduced together, so interleave new cards across categories.
5. **Context-bound memory (encoding specificity).** If you only ever see *your* blue mug, you may recall "マグカップ" only for that mug. Mitigation: show multiple instances over time (a second photo, other users' stickers of the same word, a generic image on later reviews).
6. **Picture overconfidence.** Carpenter & Olson (2012) found that learners feel they know picture-cued L2 words better than they do, and that pictures beat translations *only* once overconfidence is countered, for example by retrieval practice. Lotto & de Groot (1998) found word-word learning beat picture-word learning. So picture-front cards need honest retrieval (hide the word, recall it, then reveal) and should not lean on recognition alone.
7. **AI-generated content errors.** A wrong gloss or an unnatural sentence teaches mistakes confidently, and users cannot fix what they cannot detect. The existing validation of gloss reconstruction in the codebase is the right instinct.
8. **Sharing and privacy.** Photos of your home are more sensitive than text cards, which makes any social or "share deck" feature harder.

---

## 3. Burnout mechanics: why people abandon SRS, and evidence-based mitigations

### The mechanics
1. **Compounding debt.** Each new card generates about 5-10 future reviews in its first months. Daily load is roughly *new/day × (some multiple)*, and users underestimate it. "15 new/day → 200 reviews" is a typical report.
2. **Asymmetric punishment.** A missed day doesn't make reviews disappear; they roll over. Two missed days double the next session, and an overdue pile means lower recall, so more "Again" presses and more relearning. The pile *grows while you work it* (WaniKani: items "knocked back down to apprentice").
3. **Guilt loop.** Large queue → skip a session → larger queue → harder to restart → quit (neonlingo, WaniKani). The emotional cost (*"suffocating"*, *"a demon sucked every bit of motivation"*) is what ends the habit, not the minutes.
4. **Meaning gap.** Cards are cut off from the goal (HN: *"which is not a form of learning I ever have much need for"*; *"There has to be a short term goal"*). When the payoff isn't visible, the chore wins.
5. **Creation cost is sunk, then resented.** People who make their own cards enjoy making them but dread reviewing them (Japanese Level Up). People on premade decks don't care about the cards.
6. **Leeches dominate time.** A small share of cards eats a large share of review time and morale.
7. **Ugliness and friction** add a small daily tax that compounds over months.

### Mitigations

| Mitigation | Evidence or precedent | Tabi implication |
|---|---|---|
| **FSRS instead of SM-2** | Benchmarked on about 20k collections and 700M+ reviews (Expertium/open-spaced-repetition srs-benchmark). It is more accurate than SM-2 and removes ease hell through mean-reverting difficulty. It often schedules fewer reviews for the same retention. I found no primary source for the commonly quoted "20-30% fewer reviews", so don't put that number in marketing. | Switch the review phase to FSRS (ts-fsrs). Keep the learning-step ladder. |
| **Tunable desired retention** | The standard medical-student fix: *"Reduce your Desired Retention."* | Expose one plain-language slider ("Chill / Balanced / Intense") instead of raw settings. |
| **Load balancing / smart fuzz** | Anki 24.11 built in a load balancer that spreads due dates to avoid spikes. One user: *"really pleasant, not having big spikes."* | Spread due dates across days (fuzz) in the scheduler. |
| **Easy Days** | Anki 24.11: choose weekdays with fewer reviews. | "Lighter weekends" toggle. |
| **New-card caps and auto-throttle** | Universal community advice: 5-10 new/day; set new to 0 while there is a backlog. WaniKani: pause lessons until the apprentice count is around 100-120. | **Critical given capture fun.** Captured stickers go to the *collection*; only N/day are promoted into study. Auto-pause intake when the backlog exceeds X. |
| **Review caps plus backlog triage** | Anki's max-reviews/day; FSRS Helper's "disperse" and "postpone". The neonlingo recovery plan: cap reviews to what you can manage on your worst day. | Cap daily reviews; when overdue, show the *most at-risk* cards first (lowest retrievability) and quietly postpone the stable ones. |
| **Vacation mode** | WaniKani has it, but its forums are split: it *"circumvents the entire purpose"* and causes a pile-up on return. | Prefer a "comeback mode" (gradual ramp, a *"welcome back, here are 15 cards"* framing) over a freeze. |
| **Leech handling** | Anki tags or suspends at 8 lapses; the advice is to rewrite in a new context. | "Re-shoot" prompt; show a mnemonic or the scene again. |
| **Short sessions and microlearning** | MicroMandarin (Edge et al., CHI 2011): contextual sessions were half as long but happened in twice as many places. | Widget or Live Activity with 5-card micro-sessions. |
| **Visible progress and rewards** | Popular add-ons (Review Heatmap, Puppy Reinforcement, Killstreaks) show demand. Caveat: Duolingo shows how aggressive streaks become a source of guilt. | A sticker book that fills up is intrinsic progress. Avoid streak-loss punishment; use forgiving streaks. |
| **Kind framing of debt** | The emotional component drives quitting (section 3.3). | Never show "487 due". Show "today: ~12 min". |

---

## 4. What learners wish existed, and the aesthetics question

### Wishes, as stated or implied
- **"Cards that make themselves"** from things they meet, ideally on the phone (HN: a system-wide "highlight text → create card"). A whole AI-card-generator market (StudyCards, Auto Anki, etc.) exists to answer this.
- **Anki's algorithm with a modern, pleasant UI.** That is the whole Mochi pitch (*"beautiful, clean, elegant"*), and users accept a weaker scheduler to get it.
- **Simple defaults and less configuration:** tiered settings, or "ask beginners how much time they want to spend per day" (AnkiWeb forum suggestion).
- **Context, not isolated words:** sentence cards, real scenes, native audio.
- **Progress that feels like something**, beyond "a number going down."
- **Fair monetisation:** no energy or heart paywalls, and no removal of user-made content (Duolingo and Memrise backlash).
- **Memrise "mems"** (user mnemonic images) were beloved, and their removal hurt. That shows demand for personal visual memory hooks, which is exactly Tabi's sticker.
- Cantonese specifically: learners stitch together several small tools (CantoCards, Cantonese Guru, AnkiWeb Jyutping decks). Commentary describes it as a "broken market" with no complete app. Jyutping vs no Jyutping is debated on r/Cantonese. Native-quality Cantonese TTS is scarce, so it is a differentiator if Tabi's is good.

### Aesthetic complaints and aesthetic culture
- Anki looks like *"software from 1995"* (HN), is *"ugly"* (Borretti, 148apps), and was *"not designed by a professional designer"* (AnkiWeb forum). AnkiMobile's *"outdated UI and App Icon"* is a recurring App Store gripe even among 5-star reviewers.
- **People invest effort to make Anki pretty:** ReColor (themes for the app chrome), Catppuccin for Anki, AnkiThemeTwin, Deckorator (wallpaper backgrounds, Oct 2026), "Custom Background Image", and Notion guides titled "Beautiful Anki cards" with template CSS. AnKing maintains a ReColor theme wiki. There are paid aesthetic flashcard templates on Gumroad (e.g. "aesflash"), and Notion flashcard templates sell on "calming gradient colors".
- **Studygram / studyblr / studytube culture:** large communities of students (mostly high school and university) post polished notes. One studygrammer said running the account *"made me want to post more frequently"*, so aesthetics drive *production*. No study I found shows aesthetics improve *retention*, but the motivational link is consistently reported.
- **Aesthetic-usability effect (lit.):** Kurosu & Kashimura 1995 and Tractinsky 2000 found that attractive interfaces are *perceived* as easier to use. That matters for a tool whose main enemy is how it feels to use.
- **Direct competitor alert: CapWords** (photo → AI recognition → word sticker with pronunciation and example sentences, 8-10 languages, design-praised). Think in Italian calls it *"fun and easy… clean design"* but says it *"lacks structure for deeper learning"* and the free tier is *"frustrating."* A Product Hunt user asked for grammatical gender. **Tabi's differentiation has to be the serious SRS, the scene sentence and gloss, the learning ladder and Cantonese**, because "photo → cute sticker word" is already taken. Noun Town (a 3D vocabulary game, $19.99) is another "pretty, fun Anki" competitor.
  - https://www.thinkinitalian.com/app-review/capwords ; https://www.producthunt.com/products/capwords/reviews ; https://apps.apple.com/br/app/id6738896465

---

## 5. Learning-science evidence

| Effect | Key finding | Citation | Relevance to Tabi |
|---|---|---|---|
| **Picture superiority / dual coding** | Pictures are remembered better than words because they are encoded both verbally and as images. | Paivio 1971, *Imagery and Verbal Processes*; Paivio & Csapo 1973; Nelson, Reed & Walling 1976; Clark & Paivio 1991, *Educ. Psych. Review* (lit.) | Supports image-cued cards for concrete referents. |
| **…but in L2 vocabulary it's conditional** | Pictures did **not** beat translations for Swahili words (Exp. 1-3), and learners were **overconfident** with pictures. Pictures won only once overconfidence was countered (retrieval practice or warnings). | Carpenter & Olson 2012, *JEP:LMC* 38(1):92-101, doi:10.1037/a0024828. Follow-up: Carpenter & Geller 2020, *QJEP* | Use pictures, but force real retrieval and don't let the user "recognise" their own photo. |
| | Word-word (translation) learning beat picture-word learning for 80 Italian words; performance was best when study and test formats matched. | Lotto & de Groot 1998, *Language Learning* 48(1) | Offer both directions; test in the format users will need (sound → meaning, meaning → word). |
| **Concreteness effect** | Concrete L2 words are learned faster and forgotten less than abstract ones. | de Groot & Keijzer 2000, *Language Learning* 50(1) (lit.) | Tabi's nouns are the *easy* part of vocabulary; it can't be a full curriculum. |
| **Self-reference effect** | Encoding in relation to oneself beats semantic and other-referent encoding. The meta-analysis covered about 129 studies, mostly trait words; reported average d ≈ .45 (secondary). | Symons & Johnson 1997, *Psych. Bulletin* 121(3):371-394 | "*My* mug", "*my* cat": personal objects plus your own scene support self-referential encoding. Caveat: most evidence uses trait adjectives, not L2 nouns. |
| **Generation effect** | Self-generated items are remembered better than read items: 86 studies, 445 effect sizes, d ≈ 0.40, larger at longer delays. | Slamecka & Graf 1978 (lit.); Bertsch, Pesta, Wiscott & McDaniel 2007, *Memory & Cognition* 35(2):201-210 | **Double-edged:** AI generating the card *removes* the user's generation. Recover it cheaply: let the user choose or guess the word before reveal, pick a sentence variant, or caption the photo themselves first. |
| **Encoding specificity / context-dependent memory** | Retrieval is best when test context matches encoding context. The environmental-context effect is reliable but modest (d ≈ .28) and shrinks when other cues are available. | Tulving & Thomson 1973; Godden & Baddeley 1975 (lit.); Smith & Vela 2001, *PB&R* 8(2):203-220 | A rich personal scene is a strong cue, but risks cue-dependence (#5 in section 2). |
| **Varied context** | Studying in two different environments improved recall over studying twice in the same one. | Smith, Glenberg & Bjork 1978, *Memory & Cognition* 6:342-353 | Encourage multiple photos per word over time; rotate images on review. |
| **Semantic clustering interference** | Learning semantically related L2 words together slows learning; thematic grouping helps. | Tinkham 1993, *System* 21:371-380; Tinkham 1997; Waring 1997; Nation 2000 | Interleave categories; scene sentences are thematic, which is good. |
| **Context-aware mobile learning** | Location-relevant vocab: sessions half as long but in twice as many places, complementary to frequency-based study. | Edge et al. 2011, *MicroMandarin*, CHI, doi:10.1145/1978942.1979413 | Validates "learn the words around you", positioned as a complement. |
| | Photo and audio "learning logs" automatically generate quizzes; the quiz function drove extra study time. | Ogata et al., SCROLL (LORE model); Uosaki, Ogata & Mouri 2015 | Closest academic precedent for Tabi (photo → log → quiz). Also notes that *active* logging misses words, hence the passive-capture research. |
| **Spacing and retrieval practice** | Robust across hundreds of studies. | Cepeda et al. 2006, *Psych. Bulletin*; Roediger & Karpicke 2006 (lit.) | Already the core of the app. |

### The concrete-noun limit, and how others extend beyond it
- **Verbs and actions:** the enactment effect / subject-performed tasks (Engelkamp; lit.). Macedonia & Knösche 2011 (*Mind, Brain & Education* 5(4)) show that gestures help L2 learning even for abstract words learned in sentences. *Tabi idea:* short video or Live Photo capture ("photograph someone pouring" → 注ぐ), or a "do the gesture" prompt.
- **Adjectives:** capture the *property* of the object (red, heavy, broken, steaming). The scene sentence can target an adjective or verb rather than the noun. A "this photo, three words" card: noun + adjective + verb from one image.
- **Phrases and grammar:** the scene sentence already does this. The existing syllabus-driven grammar targets (entry #13 in the project's skills.md) are the bridge from nouns to grammar. Cloze cards from your own scene sentences (the Clozemaster pattern, but personal).
- **Abstract words:** mnemonic imagery or the keyword method (Atkinson & Raugh 1975; lit.), and the Memrise "mems" precedent. Let users attach a photo that *represents* an abstract word ("tired" → their coffee cup at 2am), which is still self-referential.
- **Situations instead of objects:** MicroMandarin-style place cards ("at the café" phrase packs) and "describe the scene" production prompts.
- **Mix in a frequency backbone:** community consensus is premade frequency deck first, then personal mining. Tabi could suggest "words you haven't captured yet" from a frequency list to fill gaps that photos can't reach.

---

## Bottom line for positioning
"Prettier, more personal, fun Anki" is well supported: aesthetics, creation cost and impersonality are top-5 pains, and Tabi addresses all three directly. But the #1 reason people quit SRS is **review debt**, and a fun capture loop makes that *worse* by default. The winning version pairs the delight with debt-proof scheduling (FSRS, caps, intake throttling, kind framing), and treats the photo as a retrieval cue that must be *tested*, not just admired. CapWords already owns "photo → word sticker", so the moat is the serious study layer plus the scene sentence, gloss and Cantonese.
