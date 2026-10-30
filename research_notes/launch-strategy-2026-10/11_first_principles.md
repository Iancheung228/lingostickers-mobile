# 11: First principles for Tabi Stickers

Written 2026-10-29. This builds on 01_inventory, 02_anki_painpoints, 03_competitors and 04_aesthetics, and on code read at HEAD `59f753c` (`lib/review.ts`, `supabase/functions/_shared/{llm,rateLimit,vocab}.ts`, `create-sticker`, `harness/`, `eas.json`, `package.json`) plus the measured bake-off figures in project memory.

The method is applied in order: question each requirement, delete, simplify, speed up the cycle, then automate. Each claim is labelled as **[measured]** (a number from a real run), **[code]** (read in the repo), or **[estimate]** (my arithmetic or judgement, with its inputs shown).

---

## 0. Bottom line

1. **Inference cost is not the constraint. User attention is.** A scan costs about **$0.0012–0.0015**, a seventh of a cent. Over its lifetime, a remembered word costs the user about **1.5 minutes**. Every design choice should be judged by how many user-minutes it costs per word that is still retained at 30 days. Tokens barely register.
2. **The product is missing its return mechanism.** No reminders, an uncapped review queue, a goal that rewards capturing rather than remembering, and no review log, so retention can't even be measured. Most of the engineering effort so far has gone into the capture half. The retention half barely has a loop.
3. **Delete before adding.** Remove Groq, Replicate and remove.bg, the home-wall editor, two of the three "recent stickers" lists, two Profile appearance settings, and the account wall before the first scan. Each of these is a cost (a consent line, a secret, a failure mode, a decision for the user) with an owner who can't justify it.

---

## 1. The atomic unit

**What the user is buying.** Nobody wants a sticker for its own sake. People learning a language want to **produce or understand a word at the moment they need it**: in a shop in Osaka, talking to their grandmother in Cantonese, reading a menu. So the end state is a *retrievable* association between a form (sound or writing) and a meaning, at a time chosen by life rather than by the app.

**The physics of memory behind it:**
- An association decays unless it is retrieved. Each successful, effortful retrieval at a growing gap lengthens its half-life. That is the testing effect plus spacing: Roediger & Karpicke 2006, Cepeda et al. 2006.
- Retrieval needs a **cue**. A rich, personal, episodic cue (*my* mug, *that* morning) is stronger than a bare word. That is the self-reference effect (d≈.45) plus dual coding. It is also *riskier*: picture overconfidence (Carpenter & Olson 2012) and cue-dependence (encoding specificity).
- About 5–7 successful spaced retrievals take a typical item to a 30-day+ interval. In Anki's terms that is "mature" (interval ≥21 d).

**Derivation:**
- A sticker is the *vehicle* that delivers the cue.
- A memory (the scene, the place, the date) is the *cue*.
- A challenge to a friend is a *distribution channel*, plus one extra retrieval with real stakes.
- None of these is the unit. **The unit is a word in context that has crossed into long-term retention: a card at interval ≥21 days, still answered correctly.** Call it a **kept word**.

**The north-star metric is kept words per active user-week.** Pair it with a cost metric: **user-minutes per kept word**.
- Neither can be computed today. There is no review log (01 §3: "Not stored: a review log") and there are no product analytics events (01 §6).
- That makes **instrumentation the first requirement**, ahead of any delight work. You can't optimise a quantity you can't observe.

**What this rules in and out:**
- It rules **in** anything that raises the number or quality of retrievals per minute (reminders, honest recall, more study items per capture).
- It rules **out** treating "stickers collected" as success. Collecting without retaining is how capture-heavy apps produce review debt and then churn (02 §1, pain point #1).
- The sticker book is the *joy*. The kept word is the *value*. The design has to turn the first into the second.
- The **memory** belongs in the unit as an attribute: a kept word *with its episode attached*. That is what CapWords' Pokédex lacks and what Anki can't produce. It is the reason someone keeps Tabi over a frequency deck. The **social moment** is not part of the unit. It is a multiplier on acquisition and on one retrieval.

---

## 2. Requirement audit

The owner is named where it can be. "Founder vision" is a legitimate owner, but it has to be weighed against the kept-word metric.

### 2a. Capture and onboarding

| Requirement | Who/what demands it | Verdict | Reasoning |
|---|---|---|---|
| **Account (username, email, password, email confirmation) before the first scan** | RLS and storage are keyed on `auth.uid()`; rate limiting is per user; friends need usernames | **SIMPLIFY → anonymous-first** | <ul><li>The first scan is the magic moment. Today it sits behind 4 form fields, an email round-trip and a consent screen. CapWords' most-hated move is gating value (03 §1).</li><li>Supabase `signInAnonymously()` issues a real `auth.uid()`, so RLS, storage folders and `consume_api_quota` all work unchanged.</li><li>Ask for an identity at the moment it buys something: adding a friend (needs a username), backing up, or a new device.</li><li>Add **Sign in with Apple** as the upgrade path: one tap, no password, no email confirmation.</li><li>Abuse control: give anonymous users a lower cap (e.g. 5/day) plus the global breaker in §2c.</li><li>Verify: anon users must be excluded from friend search and from the `moderation_queue` view.</li></ul> |
| Avatar at sign-up | founder | **DELETE from sign-up** | Avatars matter only socially. Ask for one when the user adds their first friend. The `pendingAvatar` queue logic goes away with it. |
| Username at sign-up | friends | **MOVE** to first friend action | Same reasoning. The live availability check moves with it. |
| Learning-language pick | the first card needs it | **KEEP** | It is the only real input onboarding needs. |
| AI consent gate | App Store 5.1.2(i) | **KEEP, SIMPLIFY** | <ul><li>Fold it into onboarding as a single screen.</li><li>After the deletions below, it names **one** processor (Google) instead of three, or four once undisclosed Groq is counted.</li><li>Store consent server-side (a profiles column) so there is an audit trail.</li></ul> |
| Live capture: 3:4, zoom, torch, focus, grid | founder | **KEEP** | Cheap, and expected of a camera. |
| Gallery import with box and lasso | founder | **KEEP** | It is the only way to capture an object that isn't in front of you, and the lasso is a real differentiator against "needs a clean background" (03). |
| **On-device Apple Vision cutout** | founder; cost; quality | **KEEP** | It costs nothing at the margin, works offline, is promptable, and matches the Apple-featuring story. |
| **Server fallback: Replicate `cjwbw/rembg` → remove.bg** | iOS 15/16 users, Android (unshipped), device declines | **DELETE** (gated on one number) | <ul><li>Each processor brings: a consent-list entry, a privacy-policy line, a secret, ~10 s of worst-case latency, the EarlyDrop timeout risk, UPNG border code on the server, and Replicate's ~$0.004 (3× the LLM cost of the whole scan).</li><li>The case it covers is shrinking: iOS 17+ is the large majority of active iPhones in late 2026, Android isn't shipping, and the device already falls back to a lasso-polygon cut.</li><li>Set the iOS deployment target to 17. When Vision declines, ship the **cropped rectangle as a Polaroid-style sticker**. That fits the travel-notebook metaphor (04 §0), so a failure becomes a design choice instead of a degraded cutout.</li><li>**Gate:** first read the `cutout_escalated` / `cutout_local` ratio in Aptabase. If escalation is above ~10% of scans, keep one server path (not two) until the device path is fixed.</li></ul> |
| **Groq `qwen3.6-27b` LLM fallback** | resilience | **DELETE** | <ul><li>Measured 89% object accuracy against Gemini's 100%, with p=.027.</li><li>Its free tier is about 37 scans a day *for the whole app* [measured], so it covers almost nothing.</li><li>Both of Groq's vision models are Preview.</li><li>It is **undisclosed** in both the consent screen and the privacy policy: the top launch risk in 01 §7.</li><li>Replace it with: Gemini retry (already there, 3 attempts), then an optional same-vendor second model (no new disclosure), then **save the scan as a pending draft** and finish the card later. A scan that finishes 30 seconds late beats a wrong word delivered now.</li><li>The `_shared/llm/` adapter stays, so a future swap still costs one file.</li></ul> |
| Three parallel image legs (memory 1280 px, context 640 px, cutout) | latency | **SIMPLIFY, later** | <ul><li>The context photo is a second upload of the same scene. It is inlined to the LLM rather than stored.</li><li>At `MEDIA_RESOLUTION_LOW` (268 tokens per image, the same at 640 px and 1280 px), the server could downscale the stored memory photo itself.</li><li>Low priority: it saves bytes on cellular, not money.</li></ul> |
| DiscoveryReveal with Add / Retry / Discard | founder | **KEEP, add a handoff** | After **Add**, nothing happens (01 §2). See bottleneck change 1 in §4: the save should flow into a first retrieval. |
| Draft cleanup on Discard/Retry only | storage | **AUTOMATE** | Abandoned drafts leave orphan files. A nightly `pg_cron` job should delete objects older than 24 h that no row references. |

### 2b. Generation

| Requirement | Verdict | Reasoning |
|---|---|---|
| One vision call producing word, reading, sentence, gloss, grammar_key, insight | **KEEP** | <ul><li>This is the depth moat.</li><li>Its parts are already validated: gloss reconstruction, enum enforcement, field order.</li><li>Structured output raised gloss validity from 94% to 100% [measured].</li></ul> |
| Syllabus with 65 targets × 3 bands, no-repeat window | **KEEP, then make it testable** | Today the sentence is decoration on the back of the card. The work behind the syllabus only pays off when the structure is *retrieved* (cloze, §4). Also fix the known `fr.pronom-cod` bug, where the headword is pronominalised out of its own sentence (1 in 37 runs). |
| `translate-word` / `translate-sentence` edit calls | **KEEP** | They are how the user corrects AI errors, and AI errors are trust-critical (02 §2.7). |
| `send-challenge` synonym call | **KEEP** | It costs about $0.0003 and makes typed answers fair. |

### 2c. Quota

**The 10-scan/day cap** (owner: `rateLimit.ts`, as cost and abuse protection) gets **REPLACE with three separate mechanisms**.

**First principles: the cap protects against three different things, and one number can't do all three.**

1. **Cost.** 10 scans × $0.0013 = **$0.013 per user per day**. Cost doesn't need a cap at 10. The real exposure is *app-wide*: a prepay balance reaching $0 kills every key at once (memory note). The protection is a **global daily spend circuit breaker** (sum of `api_usage` across all users today, compared with a ceiling), plus Google's auto-reload and spend cap.
2. **Abuse.** A script farming the endpoint. A per-user **abuse ceiling around 50/day** (5 for anonymous users) handles this, set high enough that no human ever hits it.
3. **Learning.** Too many new cards today means review debt next week. This is the cap that actually matters to the user, and it belongs **on intake into the study queue, not on capture**.
   - Let people capture as much as they like into the *sticker book*.
   - Admit at most N per day into *study* (default 10, user-adjustable).
   - Overflow waits in a "to learn" tray.
   - This is the Mochi pattern (02 §2 risk 1) and it directly addresses Anki's #1 quit reason.

Also **stop charging quota for Retry and Discard**, or refund it. A user who retries because *our* cutout picked the wrong object shouldn't pay for our mistake. The money involved is $0.001.

For monetisation, the *free/paid* line can then be drawn on scans per day (free 5, Pro 50). That is a business choice, made separately from the cost and learning mechanisms, which is the point.

### 2d. Study

| Requirement | Verdict | Reasoning |
|---|---|---|
| SM-2 plus Anki learning steps (1 m / 10 m / 10 m relearn) | **KEEP for launch, migrate to FSRS after** | <ul><li>SM-2 has ease hell (02 #9).</li><li>`ts-fsrs` is MIT-licensed TypeScript, and the scheduler is one file.</li><li>FSRS optimisation needs a **review log**, which doesn't exist yet. Build the log first; FSRS comes almost free once it does.</li></ul> |
| `NEW_CARD_REST_DAYS = 1` (a fresh card first appears at local midnight) | **QUESTION → change** | <ul><li>The comment says "asking immediately measures nothing". True at 0 seconds. Not true at 10 minutes to a few hours.</li><li>The first spaced retrieval is the single most valuable one, and the 1 m / 10 m learning steps were built for exactly that. But a fresh card skips them until tomorrow, when one-exposure recall is low, so the first review is mostly "Again".</li><li>See §4, change 1.</li></ul> |
| Review direction: image → recall the L2 word, self-graded | **SIMPLIFY by adding one gate**; add one direction later | <ul><li>Image → L2 is *productive* recall, which is good. But self-grading against your own photo is where picture overconfidence lives (Carpenter & Olson).</li><li>Add a commit step before the flip. See §4, change 2.</li></ul> |
| Uncapped due queue | **SIMPLIFY** | Cap a session at about 50 with an "N more waiting, no rush" message, and order it most-overdue-mature-first. Backlog guilt is the #1 cause of quitting. |
| Voice-note recording on the card | **KEEP, and use it in review** | It is the only production practice in the app, and it currently sits idle in browse mode. |
| Browse-mode field editing | **KEEP** | Users need a way to fix AI errors. |

### 2e. Surfaces

**The three wall/board surfaces:**
- the home `MiniStickerWall` (with `HomeWallEditor`, `home_stickers`, home background and the dead `home_background_dim` column);
- the **Boards** tab;
- Calendar **Finds**.

**Who owns them:** founder vision, "a scrapbook diary". **What they cost:** three implementations of "a place where stickers sit", with two separate canvas editors, a table, a dead column, and a manual arranging chore that adds nothing to kept words.

**First principles.** A diary that has to be arranged by hand is a diary most people never keep (that was the lesson of the deleted Story view). The automatic diary (Calendar) costs the user nothing. The manual board is an *expressive and shareable artifact*, which makes it a growth asset and worth keeping exactly once.

**Verdict:**
- **KEEP Calendar** as the automatic diary.
- **KEEP Boards** as the one canvas.
- **DELETE the separate home-wall editor.** Home shows the user's *pinned* board, read-only. Drop `home_stickers` and the dead dim column.
- **Then** auto-generate boards ("October", "Kyoto trip", from date and place clusters), so arranging becomes optional polish rather than a chore.

**The rest of the surfaces:**

| Requirement | Verdict | Reasoning |
|---|---|---|
| Collection home: `HomeHeader` + `MiniStickerWall` + `FeedRail` (recent 12) + `LatestStickers` (recent list) + grid | **DELETE two of the three recency lists** | <ul><li>`FeedRail`, `LatestStickers` and the grid sorted by Latest all answer "what did I find recently?"</li><li>Home should answer two questions: *what should I do now* (review N, ~M min) and *what did I just find*.</li><li>Keep the header, the pinned board and the grid.</li></ul> |
| `DAILY_GOAL = 5` finds | **CHANGE the target** | <ul><li>A goal on *capture* pushes users toward the behaviour that creates review debt.</li><li>Put the goal on *today's review done* (with new finds as a bonus stamp).</li><li>Show it as stamped days, not a flame (04 §4.8).</li></ul> |
| Calendar "Reviews" mode | **KEEP once the review log exists** | Without a log it can only show what is *due*, never what was *done*. The review log makes it honest. |
| Category chips (5), three sort modes plus a long-press menu, favourites filter | **SIMPLIFY** | One sort toggle (newest/oldest) is enough. Keep categories and favourites; they are cheap. |
| Profile: wall display framed/cutout; cutout border shadow/outline/none | **DELETE both settings** | <ul><li>Settings overload is Anki pain #5.</li><li>Choose the most beautiful default.</li><li>Each option doubles the visual QA surface and costs the founder time on every design change.</li></ul> |
| Friends: request/accept, then challenge | **KEEP, add a link path** | <ul><li>It is the only mechanic that is both product and growth (03 §4).</li><li>It requires mutual friendship before the first challenge, so it can't spread to non-users.</li><li>Add a shareable challenge link (image plus a "guess it in Cantonese" deep link or App Clip).</li></ul> |
| Moderation (report, block, evidence, queue view) | **KEEP** | App Store 1.2 requires it. |
| Share / Save to Photos | **KEEP, extend** | Add a 9:16 board or month export. That is the Finch and Locket growth artifact. |
| Push notifications for social events only | **ADD local review reminders** | See §4. Local notifications need no server, and `expo-notifications` is already installed [code]. |
| Analytics: 6 events | **ADD the funnel** | You can't run step 2 of the method (delete) without data on what gets used. |
| Android `app.json` block | **DELETE from the roadmap until there's demand** | It has no cutout path and is untested. Saying "iOS only" out loud removes a whole class of fallback requirements (Replicate exists partly for Android). |

---

## 3. Unit economics

### 3a. Cost per scan

**Measured anchor** (bake-off, shipping prompt, Gemini 3.1 Flash-Lite at `MEDIA_RESOLUTION_LOW`): **1,932 input / 444 output tokens, $1.15 per 1,000 scans.**

The per-token prices implied by those figures:

$$1932 \cdot p_{in} + 444 \cdot p_{out} = \$0.00115$$

With $p_{in} = \$0.25/\text{M}$ and $p_{out} = \$1.50/\text{M}$: $0.000483 + 0.000666 = \$0.001149$ ✓.

That is consistent, so these prices are used below. *(They are inferred from the measurement. Confirm them on Google's pricing page before quoting them externally.)*

**Scenarios** (two images per call: crop plus scene):

| Config | Images | Prompt text | Input total | Output | Cost/scan |
|---|---|---|---|---|---|
| **LOW (code default)** [measured] | 2×268 = 536 | ~1,396 | 1,932 | 444 | **$0.00115** |
| **MEDIUM** (as briefed) | 2×542 = 1,084 | ~1,396 | 2,480 | 444 | $0.00062 + $0.00067 = **$0.00129** |
| HIGH | 2×1,094 = 2,188 | ~1,396 | 3,584 | 444 | **$0.00156** |
| Worst case: MEDIUM, output at the `MAX_TOKENS_CARD = 1400` cap | 1,084 | ~1,396 | 2,480 | 1,400 | **$0.00272** |

**All-in per scan** [estimate]:
- MEDIUM, $0.00129
- +2% for 503 retries
- about 0.2 edit calls per scan at roughly 400 in / 150 out ($0.0003 each), adding $0.00006
- send-challenge and synonym calls, which are rare
- Supabase edge invocations at $2 per million, which is ~$0 per call

Total: **≈ $0.0014 per scan.** The Replicate fallback, if kept, adds $0.004 × the escalation rate. At 10% escalation that is +$0.0004, about a 30% increase on the whole scan, for one fallback.

### 3b. Storage per sticker [estimate, worth measuring]

| Object | Size estimate |
|---|---|
| Cutout PNG, RGBA, long side ≤1280 (`OUTPUT_MAX_DIMENSION`), mostly transparent | ~300–600 KB |
| Memory photo JPEG ≤1280 px | ~200–300 KB |
| Voice note (optional, a few seconds of m4a) | ~30 KB |
| **Total** | **≈ 0.75 MB per sticker** |

To measure it:
`select avg((metadata->>'size')::bigint) from storage.objects where bucket_id='sticker-images';`

**Supabase Pro ($25/mo):**
- 100 GB of storage included, about **133,000 stickers**, then $0.021/GB-month.
- One sticker at 0.75 MB costs **$0.000016 per month**. A user with 1,000 stickers costs **$0.016 per month** to store.

**Egress:**
- 250 GB included, then $0.09/GB.
- Images use a stable `cacheKey` (the storage path) in `StickerCard`, `StudyCard` and `CutoutSticker` [code], so repeat reviews mostly hit the disk cache.
- Estimate: 20 reviews a day × 30% cache misses × 0.5 MB ≈ **90 MB per user-month**. 250 GB covers about 2,800 such users.

**Supabase Free is not viable at launch.** Its 1 GB of storage holds about 1,300 stickers in total, which is roughly 10 engaged users. Budget Pro from day one.

### 3c. Fixed costs

| Item | Monthly |
|---|---|
| Supabase Pro | $25 |
| Apple Developer ($99/yr) | $8.25 |
| Domain and email | ~$2 |
| EAS | free tier ($0) |
| **Total** | **≈ $35/mo** |

### 3d. Per-user variable cost

| User type | Scans/month | LLM | Storage added | Cost/month |
|---|---|---|---|---|
| Light free user | 3/day on 10 days ≈ 30 | $0.04 | 22 MB (negligible) | **≈ $0.05** |
| Engaged user | 5/day × 30 = 150 | $0.21 | 110 MB ≈ $0.002 cumulative | **≈ $0.22** |
| Maxes today's cap | 10/day × 30 = 300 | $0.42 | — | **≈ $0.45** |
| Abuse ceiling (§2c), worst case | 50/day × 30 = 1,500 | $2.10 | — | **≈ $2.10** (bounded) |

### 3e. What a free tier can afford

**Free at 5 scans/day:**
- Ceiling: 150 × $0.0014 = **$0.21 per user per month**.
- Realistic: usage follows a power law, so median free users scan far less. Assume a free-MAU average around **$0.05**.

**Budget:** 1,000 free MAU ≈ **$50/mo**, on top of the $35 fixed.

**Break-even**, with Apple's Small Business Program taking 15%:

| Plan | List | Net after 15% |
|---|---|---|
| Monthly | $3.99 | $3.39 |
| Yearly | $24.99 | $21.24, about $1.77/mo |

- Covering fixed costs alone takes $35 / $1.77 ≈ **20 annual subscribers**.
- **Contribution per payer:** $1.77 − $0.22 (their own scans) ≈ $1.55/mo.
- **Free-rider load per payer**, at freemium conversion of ~2–4% (03 §3): each payer carries 25–50 free users × $0.05 = $1.25–2.50/mo.

| Conversion | Free users per payer | Free cost per payer | Margin per payer |
|---|---|---|---|
| 3% | ~33 | $1.65 | ≈ **−$0.10** |
| 4% | 25 | $1.25 | ≈ **+$0.30** |

So at today's cap, the yearly plan is roughly break-even at ~3% conversion. Freemium sits at break-even unless one of these holds:

- (a) free users average ≤$0.04 per month, or
- (b) the price is $29.99/yr (net $2.12/mo, a +$0.25 margin at 3%), or
- (c) conversion is above 4%.

**The break-even price under these assumptions is about $26–30/yr.**

**Raw cost floor:** the cheapest price that covers one engaged user's own costs plus a share of fixed costs at 100 payers is $0.22 + $0.35 ≈ **$0.57/mo**. Pricing is about value and the free-rider ratio. COGS barely matters.

**Comparison:** CapWords charges $19.99–29.99/yr. The education median is $44.99/yr.

**Recommendation:**
- $29.99/yr, $4.99/mo, and a $69 lifetime plan. (Lifetime is safe because one user's lifetime COGS at 150 scans/month is about $2.50/yr.)
- Free tier: **5 scans a day, reviews always free, social always free.**
- **Never gate reviews.** They cost $0 in inference, and locking a user's own cards destroys trust (02 #14).

### 3f. The real economic constraint

**Founder hours and user minutes.** Each item below costs real money where tokens cost almost nothing:

- One EAS build of the 15/month quota is worth more than 1,000 scans.
- An hour of founder QA is worth about 40,000 scans at a $50/h opportunity cost.
- A user who quits takes their retained words to zero. Their scan cost was never the issue.

---

## 4. The bottleneck in the learning loop

**The equation:**

> **kept words per week** = (sessions that actually happen) × (honest retrievals per minute) × (study items per capture) × (fraction surviving to 21 d)

**The cost of one kept word today** [estimate]:

| Phase | User time |
|---|---|
| Capture: framing + wait (~2.3 s p50 for the LLM, plus cutout and upload, roughly 5–15 s) + reveal reading + Add | **~30 s** |
| Learning to maturity: ~6–8 retrievals × ~8 s (flip + grade) | **~1 min** |
| Lapses (assume ~25% of cards lapse once, adding ~3 retrievals each) | **~6 s** amortised |
| **Total** | **≈ 1.5 user-minutes per kept word**, and **only if the user comes back** |

**Ranking the candidates the brief named:**

1. **Sessions that happen (the return trigger). THE BINDING CONSTRAINT.**
   - If the session-occurrence term is zero, everything else multiplies by zero.
   - Today there are no review reminders (only social pushes), the daily goal points at capture, there's no streak or ritual, and the queue is uncapped, so a missed weekend grows into a guilt pile.
   - Anki's #1 quit cause is debt, not card quality (02 §1).
   - This term is also where Tabi is weakest relative to how good its capture half is.
2. **Honest retrieval (review quality).**
   - Image → L2 word is productive recall, which is the right direction. But it is *self-graded against a vivid personal photo*.
   - Carpenter & Olson: learners overrate picture-cued knowledge. A user sees their mug, feels "yes, I know that", flips, and taps Good without ever having produced the word.
   - Those reviews take time and build almost no retention. They inflate intervals, which later produce lapses.
3. **Study items per capture (the concrete-noun ceiling).**
   - Capture is the expensive step: ~30 s of user time, the object physically present, $0.0014.
   - Each capture yields exactly **one** study item (the noun). Yet the scan already pays for a sentence, a gloss and a grammar target, and none of them is ever *tested*.
   - Nouns are also the easy part of a language (de Groot & Keijzer, concreteness), and a user runs out of nouns in their flat within weeks.
   - Turning one capture into two or three study items raises the value of every scan without touching the costly step.
4. **Capture friction.** It matters for *activation* (the first scan) more than for retention. The fix is anonymous-first onboarding (§2a), not a faster pipeline. Capture is already 3 taps.
5. **Review direction.** Adding listening (audio → meaning) matters, but it comes after 1–3.

### The 3 highest-leverage changes

**Change 1. Close the return loop: reminders, a debt-proof queue, and a same-day first retrieval.**

*Reminders:*
- One local notification a day, at the hour the user usually studies (learned from the review log), and only when something is due.
- Copy in the notebook voice: "3 stickers from last week want to say hi. 2 min." It should never mention a streak.

*Debt-proof queue:*
- Cap sessions at about 50, with the most overdue mature cards first.
- Limit intake into study (10 new a day, overflow in the "to learn" tray, §2c).
- After an absence of 3 days or more, show a "welcome back" session of only 15 cards. Never show a count of 200.

*Same-day first retrieval:*
- Today a fresh card waits until midnight (`NEW_CARD_REST_DAYS`). Instead, start the first learning step at about **10 minutes after capture**.
- Deliver it as a "quick check" stamp card when the user leaves the scan tab, or bundled in the evening reminder ("Today's 4 finds: 1 min").
- That moves the most valuable retrieval into the window where it succeeds and strengthens memory.

*Effort:* M (JS-only; `expo-notifications` is already installed). *Expected effect:* this is the largest lever on the session term and on user retention.

**Change 2. Commit before flip: make every review an honest retrieval.**

*Before the card can flip,* the user does one overt act:
- **Say it** with press-and-hold on the existing mic. A pass/fail check via on-device `SFSpeechRecognizer` comes later; initially just record it and play it back against the TTS on the back. That is production practice using a component that already exists.
- or **type it** for kana/romaji/jyutping, optionally.
- or at minimum a deliberate "I've got it in my head" press with a short hold, instead of an instant tap.

*After the flip:*
- Grading becomes comparing what you said with the answer, not "do I feel I know it?".

*For cards with interval ≥7 days,* alternate the cue:
- every third review is **audio-only → meaning**, which needs no image and fights cue-dependence;
- or **a different photo**, with "reshoot a different X" as the leech fix (02 §2).

*Effort:* M. *Effect:* raises retention per review and fixes picture overconfidence. It also makes the voice-note feature *do* something.

**Change 3. Two study items per scan: a cloze card from the user's own sentence.**

- The scan already generates `sentence`, `gloss` (word segmentation) and `grammar_key`.
- From those, derive a second card: the scene photo plus the sentence with the **grammar-target chunk or a verb/adjective** blanked, shown with the English translation.
- That gets verbs, particles, classifiers (`yue.classifier`) and `fr.depuis` + present into retrieval practice without one extra capture or model call. The gloss chunks already mark the boundaries, and the validator already guarantees they reconstruct the sentence.
- Introduce it a few days after the noun card has graduated, so it reads as "level 2 of the same sticker" and doesn't double new-card load.
- It turns the syllabus work (skills.md §13) from decoration into curriculum.

*Effort:* M (one new card type in StudyCard, one scheduling row per derived card, or a `card_kind` column). *Effect:* about ~1.7–2× study items per expensive capture, and the first real step past the concrete-noun ceiling.

*Honourable mention:* a **leech → "reshoot a different X"** prompt. It is S effort, unique to a camera-first SRS, and backed by the varied-context finding.

---

## 5. Cycle time: pointing the harness

**What exists** [code, memory]:
- A Sonnet builder and a Haiku QA agent driving Maestro on the Simulator, with Opus brought in on a third failed attempt.
- Shell gates: typecheck, lint, tests and `deno check`.
- A worktree on Metro :8082.
- `feature_list.json` holds six drivability items (testIDs and a simulator cutout fixture). All of them are unpassed.
- Only 2 approved Maestro flows exist: sign-in and study-grade.
- No CI, no `expo-updates`, no staging backend (QA runs against prod).

**Step 1: question the requirement.** What is the dev loop *for*? It is for shortening the time from "idea" to "know whether it raised kept words". That cycle has two halves:

- (a) **code → verified build.** The harness is aimed here.
- (b) **build in users' hands → metric.** This half currently has **no instrument**: no TestFlight cohort, no OTA updates, no product analytics, no review log.

Half (b) is the slower one by orders of magnitude (weeks against minutes). Speeding up (a) while (b) is missing is optimising a part that shouldn't be the bottleneck.

**Ordered recommendations:**

1. **Instrument first.** Add a `review_log` table (card_id, ts, grade, elapsed_ms, interval_before/after, kind) and about 15 funnel events: signup, consent, scan_started/succeeded/failed(reason), saved, discarded, retry, review_session_started/finished, card_graded, reminder_opened, friend_added, challenge_sent/won, quota_hit. Without these, the harness can only verify that code *works*, not that it *matters*.
2. **Add EAS Update (`expo-updates`) and a TestFlight cohort of about 20–50 learners** (r/Cantonese, Japan-trip people).
   - EAS Update ships JS to installed builds with **zero build credits**, which removes the 15-builds-a-month ceiling as a constraint on iteration.
   - It requires *one* native build to add the module. **Ask the founder before running it** (memory: ask before EAS builds).
   - This is the single largest cycle-time gain available.
3. **Make the core loop drivable.** Finish `feature_list.json`'s **simulator cutout fixture plus scan flow** first, before any new feature work. The scan flow is the product, and today no automated test can reach it.
   - Inject a **stub LLM provider** in QA mode. `callModel` already accepts injected `providers` [code, skills §14], so `create-sticker` can return a fixture card from a header or env flag.
   - That makes flows deterministic, free, and independent of Gemini 503s.
4. **Add a staging Supabase project** on the free tier.
   - The loop currently runs `ALLOW_PROD_BACKEND=1`.
   - One mistaken migration or destructive QA flow on prod would cost more than the whole harness has saved.
5. **Seed states, not just accounts.** `seed.mjs` should create fixture users:
   - new and empty;
   - 30 due cards across learning, review and relearning;
   - a leech;
   - a 200-card backlog after an absence;
   - a pending challenge.
   Most of the review-loop changes in §4 can only be verified against these states.
6. **Redefine a `feature_list.json` entry** as *a behaviour plus the event that proves it ran*: "reminder fires → `reminder_opened` event emitted in the flow". That ties the build loop to the metric loop.
7. **Spend the founder's attention on taste only.** Have `run-loop.sh` emit one **contact sheet** per iteration: before/after screenshots of every touched screen, as one PNG or HTML page.
   - The founder's scarce input is aesthetic judgement ("prettier"), which Haiku can't supply.
   - One page per iteration is the right interface for it.
8. **Keep model roles as they are.**
   - Sonnet is right for the builder.
   - Point Opus at *design-level* work (scheduler and FSRS migration, onboarding rewrite) through explicit tasks, not only as a retry escalation. Escalating only on failure spends the strongest model on the hardest *bugs* instead of the highest-leverage *designs*.

**What to automate next, in order:**
1. **Nightly prompt-lab regression.** `scripts/prompt-lab.mts` already runs the shipping prompt on real photos. Run it daily, score object accuracy, gloss validity and headword presence (the `fr.pronom-cod` bug), and alert on regressions. A prompt is the one change that can't be reviewed by reading it (skills §13).
2. **Global spend breaker and balance alert** (§2c): a cron that checks the Gemini spend and prepay balance and emails when the balance is under 30 days of runway.
3. **Orphaned-storage garbage collection** via `pg_cron`.
4. **A weekly metrics digest:** a SQL view over `review_log` and events giving kept words per active user-week, D1/D7/D30 retention, and scan funnel conversion. Email it, or publish it as a dashboard artifact.
5. **CI** with GitHub Actions running `init.sh` on every push, so the gates hold even when the harness isn't running.

---

## 6. The next 10 things, ranked

Impact is on kept words, launch-readiness or growth. Effort: S < 1 day, M = 2–5 days, L > 1 week or needs a native build. Score ≈ impact ÷ effort, adjusted for dependencies.

| # | Thing | Why now | Impact | Effort | Build? |
|---|---|---|---|---|---|
| 1 | **Delete Groq** (`LLM_FALLBACK=off`, remove the adapter from the chain) and **settle the disclosure** (consent plus privacy, including Aptabase) | It is a launch blocker. Deleting is cheaper than disclosing a fallback that covers ~37 scans a day. | High (submission risk) | **S** | No; redeploy the function |
| 2 | **Instrument:** `review_log` table plus about 15 funnel events | Nothing below can be judged without it. FSRS needs it later. | High (enables everything) | **S–M** | No |
| 3 | **Local review reminder plus a capped, debt-proof queue plus a "welcome back" session** (§4.1) | Fixes the binding constraint: whether sessions happen at all | **Very high** | **M** | No |
| 4 | **Same-day first retrieval:** fresh cards enter learning step 1 about 10 min after capture, plus a post-scan "quick check" handoff | Uses the learning steps already built. Closes the capture → study gap. | High | **S** | No |
| 5 | **Replace the 10/day cap with three mechanisms:** a global spend breaker, a ~50/day abuse ceiling, and a study-intake cap with a "to learn" tray. Also stop charging for Retry and Discard. | Protects against the prepay cliff, prevents review debt by design, and drops the "Daily limit reached" alert from first sessions | High | **M** | No |
| 6 | **Anonymous-first onboarding plus Sign in with Apple upgrade.** Scan within 30 s of install; username and avatar deferred to the first friend action. | Activation. The magic moment is currently behind 4 fields and an email round-trip. | High | **M** | **Yes** (Apple auth module). Batch it with #7. |
| 7 | **One native build** containing `expo-updates`, Apple auth and the iOS 17 deployment target, then **TestFlight with 20–50 real learners** | Turns the 15 builds a month from a limit on iteration into a non-issue. Starts the metric loop. | **Very high** (cycle time) | **M** | **Yes** (one, with the founder's consent) |
| 8 | **Commit before flip** (say it or type it), plus an audio-only cue on mature cards (§4.2) | Honest retrieval, fixes picture overconfidence, makes the voice feature useful | High | **M** | No (expo-audio is already in) |
| 9 | **Cloze card from the user's own sentence** (§4.3) and a leech → "reshoot a different X" prompt | 1.7–2× study items per scan. The syllabus becomes curriculum and Tabi moves past nouns. | High (moat) | **M** | No |
| 10 | **Deletion pass:** Replicate and remove.bg (after reading `cutout_escalated`; use a Polaroid fallback); the home-wall editor and `home_stickers` (home shows the pinned board); `FeedRail` or `LatestStickers`; the two Profile appearance settings; the `DAILY_GOAL` target moved from finds to reviews | Fewer processors, fewer failure modes, less QA surface for every later design change | Medium (compounding) | **M** | No (the server-side removal is a redeploy) |

**Deliberately not in the top 10:**
- **FSRS.** It comes after the review log has a month of data.
- **Delight polish** (04's foley, stamps, maturing card). It is high value, but it decorates a loop that doesn't yet bring users back. Do it right after #3–#4, starting with 04's "card matures paper → stamp → foil", because that also *shows* the kept-word metric to the user. The north star becomes visible on the card itself.
- **Shareable challenge links and a 9:16 month export.** These are the growth loop. Start them as soon as TestFlight retention (D7) shows the core loop holds. Amplifying acquisition into a leaky bucket wastes the founder's one channel (founder-led TikTok).
- **Android.** Nothing currently requires it.

**The sequence in one sentence:** delete the risky parts (1), make the loop measurable (2), make it bring people back (3–5), get it into real hands quickly (6–7), make each minute of review count (8–9), then trim the rest (10). Delight and growth go on top of a loop that is already known to retain.
