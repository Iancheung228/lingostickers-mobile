# 12 · Engineering readiness: launch blockers, observability, debt, feature cost, harness

Reviewer stance: staff mobile engineer, pre-App-Store. Repo `/Users/school/lingostickers-mobile/lingostickers-mobile` @ `59f753c` (main).
This was a read-only review. I did not edit any repo file, deploy or build anything.

## 0. What I ran (verified by running it, not by reasoning)

| Check | Result |
|---|---|
| `git status` (main) | **clean**. The brief said there were uncommitted changes, but there are none on main. The uncommitted work is in the harness worktree `../tabi-harness` (branch `harness/drivable` @ `9af772a "harness: scaffold"`): `M app/(auth)/sign-in.tsx`, `M app/(auth)/sign-up.tsx`, `?? .maestro/agent/auth-ids.yaml`. The loop's first iteration got partway into `auth-ids` and never committed. |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | 0 errors, 43 warnings (all `react-hooks/exhaustive-deps`; the 2026-09-01 audit recorded 63) |
| `npm test` | 65/65 pass (prompt, gloss and LLM logic only) |
| `npm run typecheck:functions` (deno check) | exit 0 |
| `scripts/test-drivable.mts` | 6/6 FAIL: no testIDs on main yet, and no agent flows run |

The following were **inferred from code and not verified against production**: deployed secrets (`LLM_FALLBACK`, `DAILY_LIMIT_*`), the state of the storage bucket, and Supabase spend.

---

## 1. Launch blockers (severity-ranked)

### P0: fix before you submit

**B1. Groq receives user photos but is disclosed nowhere.**
- `supabase/functions/_shared/llm/index.ts:72-73`: `if ((Deno.env.get('LLM_FALLBACK') ?? 'groq') !== 'off') chain.push(createGroqProvider(...))`. The fallback is **on by default**.
- `lib/aiConsent.ts:35-39`: `AI_PROCESSORS` lists only Google, Replicate and remove.bg.
- `docs/privacy.html:86-88`: the processor table has the same three. Groq is absent.
- The file's own header (`aiConsent.ts:6-11`) cites Guideline 5.1.2(i), which requires consent *before* data goes to a third-party AI. Today a Gemini 5xx sends the photo to an undisclosed vendor, and that vendor runs a Preview-grade model.
- **Fix, choose one:**
  - (a) `npx supabase secrets set LLM_FALLBACK=off` today. This is one command with no app build. You lose failover, and Gemini 3.1 Flash-Lite stands alone.
  - (b) Add Groq to `AI_PROCESSORS` and to `privacy.html`, and bump `PREFIX` to `aiConsent:v2:` so everyone is asked again.
- I recommend (a) for launch. The 2026 bake-off already shows Groq is the worse model, and a silent drop in quality on fallback is the scenario lesson #14 warns about.

**B2. Analytics (Aptabase) is live in every EAS environment but is not in the privacy policy.**
- Memory confirms that `EXPO_PUBLIC_APTABASE_APP_KEY` was set in all three EAS environments on 2026-08-31, so production builds *do* send events.
- `grep -i "aptabase\|analytic" docs/privacy.html` returns nothing.
- App Store Connect's privacy nutrition label must declare "Usage Data → Product Interaction" (not linked, not tracking). The policy needs a paragraph.
- This is cheap to fix, and the mismatch is a rejection or complaint risk.

**B3. Signing out leaves this device's push token attached to the previous user (a cross-account privacy leak).**
- `hooks/useAuth.ts:58-60`: `signOut` only calls `supabase.auth.signOut()`.
- `lib/notifications.ts:65-67` upserts `(user_id, token)`, and nothing ever deletes it. `push_tokens` is referenced only in `006_friendships.sql`, and there is no cleanup trigger.
- On a shared or handed-down phone, User A's friend-request and challenge pushes (which contain names) keep arriving on the lock screen after User B signs in on that device.
- **Fix:** delete `push_tokens where token = <this device token>` *before* `signOut()`, using the still-valid session. When the next user registers, also delete other users' rows for the same token. The cleanest way is a SECURITY DEFINER RPC `claim_push_token(token)`.

**B4. Grades given offline are silently lost, and the session claims they were saved.**
- `components/StudyCard.tsx:421-437`: `onGraded` is called *before* the write. On `error` the local patch is rolled back, but the session (`StudySessionHost.tsx:43-55`) has already advanced and re-queued from the *patched* copy.
- The `ReviewSummary` then counts reviews the server never stored. Nothing tells the user. On the subway, a whole session evaporates.
- This is real data loss in the app's core loop. See the `grade-write-queue` entry in §5 for the fix.

**B5. A scan the user paid for can be lost, and its storage orphaned.**
- `app/(tabs)/scan.tsx:646-676`: the draft lives only in React state.
  - If the app is killed or evicted while DiscoveryReveal is showing, the draft is gone, but the cutout and memory photo already sit in `sticker-images/{uid}/` and the quota unit is spent.
  - If `insert` fails (offline), `Alert.alert('Save failed', error.message)` shows a raw PostgREST or fetch message, and the draft survives only until the user navigates away.
- **Fix:**
  - Persist the draft to AsyncStorage (`draft:v1:{uid}`) on reveal, restore it on next mount, and clear it on add or discard.
  - Server side, run a nightly `pg_cron` job that lists `storage.objects` in `sticker-images` older than 48 h whose path no `stickers.image_path`, `memory_photo_path` or `voice_note_path` references, and removes them.

### P1: fix in launch week

**B6. No crash reporting, so you are blind on day 1.**
- The root `ErrorBoundary` (`app/_layout.tsx:37`) renders a retry screen and reports nothing.
- No Sentry, Crashlytics or Bugsnag dependency is in `package.json`.
- Native crashes in `modules/subject-cutout` (Swift, about 1,680 lines) would surface only as App Store Connect crash logs, which arrive with a 1–2 day lag and are not symbolicated for JS.
- See §2.

**B7. No app-wide AI spend ceiling.**
- `supabase/functions/_shared/rateLimit.ts:26-31` sets per-user daily caps (create-sticker 10, translate-word 30, translate-sentence 30, send-challenge 30). Nothing caps the total.
- Sign-up needs only a confirmed email, so N throwaway accounts can make 10N scans a day, each with a Gemini call and possibly a Replicate call.
- There is also **no request-size check** on `image`, `memoryImage` or `contextImage` (`create-sticker/index.ts:41-55`). Only the platform's body limit applies.
- **Fix, two layers:**
  - (1) A provider-side hard budget: a Google Cloud billing budget with a Pub/Sub kill-switch, or a capped prepaid key. Replicate and remove.bg are prepaid credit, so keep balances low.
  - (2) A global row in `api_usage` (`user_id = '00000000-…'` sentinel, endpoint `global:create-sticker`) claimed by the same atomic `consume` RPC with `DAILY_LIMIT_GLOBAL` (for example 2,000). When it is spent, return 503 "Scanning is busy, try later". This reuses migration 027's atomicity and is about 20 lines.

**B8. Supabase auth never pauses token auto-refresh in the background.**
- `lib/supabase.ts:7-15` sets `autoRefreshToken: true`, but there is no `AppState` listener calling `supabase.auth.startAutoRefresh()` / `stopAutoRefresh()`. That listener is the documented requirement for React Native.
- The only AppState listener (`app/_layout.tsx:90`) clears the badge.
- **Symptoms in the wild:**
  - Refresh attempts fire while the app is suspended and fail.
  - On resume, the first request uses an expired JWT and the edge functions return 401. The user sees "Scan failed" after the phone has slept for over an hour.
- **Fix:** about 6 lines, next to the badge listener.

**B9. Memory pressure in native image work: moderate and bounded, but unmeasured on an old device.**
- The inputs are capped: `SEGMENT_MAX_DIMENSION = 1600` and `OUTPUT_MAX_DIMENSION = 1280` (`lib/cutout.ts:61-62`), with `ImageIO.loadCGImage(maxDimension:)` doing a thumbnail decode (`ImageIO.swift:18-29`). MatteRefiner already uses the 1/4-scale coefficient trick (lesson #7).
- **Residual risks:**
  - There is no `autoreleasepool` around the per-call pipeline in `SubjectCutoutModule.swift` (`runOnQueue(global)` :83).
  - Nothing serialises calls, so a fast Retry Extraction can overlap two pipelines with a live camera session.
  - Vision requests are not cancelled when the screen unmounts.
- **Action:** run one Instruments Allocations pass on the oldest iOS 17 device you can borrow (iPhone XS/XR class): 10 rapid scans plus a retry. Add a serial queue in Swift. This needs a native rebuild, so batch it with Sentry (§4).

**B10. Offline behaviour is undesigned.**
- No NetInfo, and nowhere in app, components, hooks or lib checks connectivity.
- **Consequences:**
  - A scan offline spends a full progress animation and then shows a system Alert.
  - Collection fetch failures show the retry states that already exist (good).
  - Grading is covered by B4.
  - Images are disk-cached by storage path (`cacheKey: sticker.image_path`, `StudyCard.tsx:980,1154`; `StickerCard.tsx:79`), so a cached collection *can* render offline. That makes offline study cheaper than it looks (§4).
- **Minimum for launch:** B4's queue, plus a pre-flight check on the Scan tab that says "You're offline: scanning needs a connection" before the shutter.

### P2: should fix, not blocking

- **B11. Privacy manifest.** `app.json` has no `ios.privacyManifests`. Expo SDK 54 aggregates the manifests of pods that ship one. Run Xcode → Archive → *Generate Privacy Report* on the production build and confirm that `NSPrivacyAccessedAPICategoryUserDefaults` (used by AsyncStorage) and `FileTimestamp` are declared, so you don't get an ITMS-91053 email.
- **B12. Raw backend errors in Alerts.** The pattern `Alert.alert('Save failed', error.message)` (`scan.tsx:675`) is repeated: 64 `Alert.alert` calls across 18 files. Users will see strings like `TypeError: Network request failed`.
- **B13. Hidden quota cost.** Discard and Retry Extraction still spend scan quota (`create-sticker/index.ts:88`, claimed before any work). With a 10-a-day cap, an enthusiastic first session can hit "Daily limit reached". Consider raising launch-week `DAILY_LIMIT_CREATE_STICKER` to 20 once B7's global cap exists.
- **B14. The Android notification colour is off-palette.** `#A7D7C5` mint in the `expo-notifications` plugin. Android isn't shipping, so this is cosmetic.
- **B15. AI consent is device-local** (`aiConsent.ts:20-22`) and has no revoke. That is acceptable for 5.1.2(i), but add a server audit row (`profiles.ai_consent_at`, `ai_consent_version`) when you next touch it. GDPR-style requests ("when did I consent?") can't be answered today.

---

## 2. Observability for day 1

### Crash reporting: Sentry (`@sentry/react-native`)
- **Why Sentry:**
  - It is the Expo-documented path (docs.expo.dev/guides/using-sentry). It ships a config plugin (`@sentry/react-native/expo`) and Metro integration (`getSentryExpoConfig`).
  - It captures JS errors, native iOS crashes (including the Swift cutout module) and ANR-style hangs in one place.
  - Its free tier (5k errors a month) is enough for about 200 users a month.
  - Crashlytics would need `@react-native-firebase`, which brings Google services config and a heavier native footprint.
- **Cost:** a native dependency, so one dev-client rebuild plus one production build (respect the 15-a-month EAS budget; ask first).
- **Setup:**
  - Set `SENTRY_AUTH_TOKEN` as a *secret* EAS env var so source maps upload automatically on EAS Build.
  - Wrap the root with `Sentry.wrap`.
  - Call `Sentry.captureException` from the existing `ErrorBoundary`.
  - Set `sendDefaultPii: false`.
  - Set the user to the Supabase uid (not the email).
  - Add a breadcrumb on each scan stage (`ScanProgress` stages already exist).
- **Edge functions:** use Supabase's built-in function logs, plus a `console.error(JSON.stringify({fn, kind, provider, ms}))` structured line in `_shared/llm/index.ts` on every failover or failure. This is grep-able in the dashboard and needs no new vendor.
- **Privacy:** Sentry must also be added to `docs/privacy.html` (crash diagnostics), so do it together with B2.

### Funnel events (Aptabase, already wired)
Today there are only 6 events: `app_launched`, `cutout_local`, `cutout_escalated`, `cutout_upload_failed`, `sticker_shared` and `sticker_saved_to_photos`. Add these, with props kept coarse and no PII:

| Event | Where | Props |
|---|---|---|
| `signup_completed` | `hooks/useAuth.ts` signUp success | `language` |
| `email_confirmed_first_session` | first SIGNED_IN for a uid (AsyncStorage flag) | (none) |
| `consent_accepted` | `AiConsentGate` accept | (none) |
| `scan_started` | `scan.tsx` handleCapture / extractor extract | `source: camera\|gallery`, `mode: box\|lasso\|frame` |
| `scan_succeeded` | DiscoveryReveal shown | `ms_total`, `cutout: device\|server\|raw`, `provider` |
| `scan_failed` | catch in scan | `kind: quota\|network\|llm\|cutout\|unknown` |
| `sticker_saved` | `handleAdd` success | `n_total` bucketed (1, 2–5, 6–20, 21+), `is_first` |
| `sticker_discarded` / `extraction_retried` | the respective handlers | (none) |
| `review_session_started` | StudySessionHost mount | `due_count` bucket, `entry: home\|calendar` |
| `card_graded` | handleGrade **after** a successful write | `grade`, `phase: learning\|review\|relearning` |
| `review_session_completed` | ReviewSummary | `n_reviewed`, `is_first_ever` |
| `quota_hit` | 429 path | `endpoint` |
| `friend_added`, `challenge_sent`, `challenge_won` | the respective hooks | (none) |
| `reminder_opened` | notification response handler (once reminders exist) | `kind` |

- **D1 return:** Aptabase has no cohort retention view. Derive D1 from `app_launched` plus a client-computed `days_since_signup` prop (store `signup_at` locally, or read `profiles.created_at`). Then "users with `days_since_signup = 1`" divided by "signups yesterday" is your D1.
- **Server truth (Supabase SQL):** this is more reliable than client events, so use both:
  - D1, D7: from `stickers.created_at` and `last_reviewed_at` per user.
  - First scan: `min(stickers.created_at) - auth.users.created_at`.
  - First review: `min(last_reviewed_at)`. There is no review log, so the *first* review is only recoverable while `review_count = 1`. **Add a `review_log` table now** (`user_id, sticker_id, grade, reviewed_at, interval_before, interval_after`). It is cheap, it is the only way to measure retention and SRS calibration, and the Reviews calendar needs it anyway.

### Minimal dashboard (one page)
1. **Activation funnel, daily:** signup → consent → first scan_succeeded → first sticker_saved → first review_session_completed → D1 return.
2. **Scan health:**
   - success rate, from `scan_failed` and `kind`
   - p50/p95 `ms_total`
   - device vs server cutout share
   - Groq failover count (from function logs)
3. **Cost:** `api_usage` sums per endpoint per day, against the B7 global cap and the per-provider spend.
4. **Retention:** D1 and D7 cohorts from the SQL above. Reviews per DAU.
5. **Stability:** Sentry crash-free sessions (target ≥ 99.5 %) and the top 5 issues.

Build items 1, 2 and 4 as saved SQL in the Supabase dashboard (or a tiny artifact dashboard fed by a read-only view). Aptabase's own UI covers the event counts.

---

## 3. Tech debt that will slow the next 3 months

| Debt | Evidence | Cost if left | Pay now? |
|---|---|---|---|
| **No tests on the SRS scheduler** | `lib/review.ts` is 594 lines with 0 tests. `npm test` covers only prompt, gloss and LLM. The file does `import { Language, Sticker } from '@/lib/types'` (:32), a *value* import through a path alias, so `node --experimental-strip-types` can't even load it. | Every reminder, offline or reverse-direction feature touches scheduling. A silent ladder bug corrupts every user's queue. | **Yes.** Change it to `import type` (one line), then add a human-authored `scripts/test-review.mts`: about 20 table tests for the ladder (lesson #12's "four buttons, four answers", the floor stacking, local-midnight placement). This is also the oracle the harness needs (§5). |
| **System `Alert.alert` everywhere** | 64 calls in 18 files. They show raw `error.message`. | They break the design language, can't be tested by Maestro reliably, and leak backend strings. | **Partly.** Add a `lib/errors.ts` `userMessage(err)` mapper now (the same idea as lesson #3) and route every Alert through it. Replace the high-traffic ones (scan fail, save fail, quota) with an in-app toast/banner component. Leave the destructive confirms as system Alerts (they are idiomatic on iOS). |
| **Token naming drift** | `constants/theme.ts`: `sky = #FAF4EA` (cream), `skyDeep = blush = #E4A0A1`, `terra = rust = blushDeep = #9D4D51`, `sage` is sand. These names are used about 187 times in app and components. | Every new screen an agent builds picks a name by its meaning (`sky` → blue) and gets the wrong colour. This matters doubly for a Sonnet builder. | **Yes, cheaply.** Add semantic aliases (`bg`, `band`, `cta`, `ctaPressed`, `accent`, `ink`…) as the *only* documented names, keep the old keys as deprecated aliases pointing at the same values, and codemod over 2–3 harness iterations. Add an eslint `no-restricted-syntax` rule later. |
| **God components** | `StudyCard.tsx` is 1,485 lines (recorder lifecycle, editor, grading, export). `scan.tsx` is 1,149 lines of interleaved async state. | Reverse-direction review and offline mode both land in StudyCard. Agents produce merge-conflict-prone diffs in 1.5k-line files. | **Before reverse review:** extract `useCardRecorder`, `useGrade` (with the B4 queue) and the `FrontFace`/`BackFace` renderers into files. Leave scan.tsx alone until onboarding touches it. |
| **No review history** | Only the current schedule state is stored. | You can't compute retention, calibrate the SRS, show "reviews done", or build streaks. | **Yes** (part of §2). |
| **43 hook-deps lint warnings** | `npm run lint` | Noise hides new warnings. Some of them are real stale-closure bugs (StudyCard:409). | Triage over time. Make `--max-warnings 43` a ratchet in `init.sh` so the count only goes down. |
| **Stale docs** | ROADMAP says the languages are fr and ja (yue has shipped). Phase 6 search status is wrong. The Story view was deleted. | Agents read docs and build to them. | Fix the 3 lines now. |
| **Leftover branches and dead flags** | the `dev`, `feature/*` branches, and `CUTOUT_DRY_RUN` (`lib/cutout.ts:82`) | Low | Later. |

---

## 4. Feature-enablement: what's cheap and what's expensive in this architecture

The key constraint is that **any new native dependency costs a dev-client rebuild (EAS credit or a local Xcode build), and the harness loop cannot make native changes at all** (PROMPT.md hard rules). So **batch every native dependency you'll want in Q1 into one rebuild**: Sentry, `expo-apple-authentication`, `react-native-purchases`, `@shopify/react-native-skia`, `@react-native-community/netinfo`, plus any widget target. After that, every feature below is JS-only and loop-buildable.

| Feature | Native? | Cost | Notes |
|---|---|---|---|
| **Review reminders (local notifications)** | No. `expo-notifications ~0.32` is already installed with its plugin, and local scheduling is JS. | **Cheap (S)** | `scheduleNotificationAsync` with a `DAILY` trigger at the user's chosen hour, body "N cards due". Reschedule on app background (compute tomorrow's due count from the cached collection). iOS keeps only 64 pending local notifications, so schedule a single rolling daily one. Reuse the in-context pre-prompt pattern from `lib/notifications.ts`, and add a Profile toggle and time picker. Best retention lever per hour of work. |
| **Onboarding** | No | **Cheap–medium (S–M)** | Expo Router stack under `(auth)`, or a first-run gate in `_layout.tsx`. Seed one sample sticker server-side (an RPC that copies a bundled fixture into the user's folder, using lesson #2's copy pattern) so the home screen isn't empty. Fully loop-buildable and Maestro-verifiable with an "empty account" seed. |
| **Post-save handoff ("Study it now" / "Place on a board")** | No | **Cheap (S)** | `scan.tsx` handleAdd currently leaves the user on the camera. Also consider `NEW_CARD_REST_DAYS = 1` (`lib/review.ts:46`): letting a just-saved card into a 1-minute learning step is a one-constant product decision. |
| **Reverse review direction (word→picture, audio→picture)** | No (TTS through `expo-speech`, voice notes already exist) | **Medium (M)** | The scheduler is per-card. A second direction needs **per-direction schedule state**, which means a schema change (a `card_reviews(sticker_id, direction, ease, interval, due_at, step)` table, or columns). Do the `review_log` and StudyCard extraction first. A choose-the-picture mode needs distractors from the user's own collection, which is a pure function and easy to test. |
| **Offline study** | NetInfo (native, batch it) | **Medium (M)** | Images are already disk-cached by storage path. What's needed: (1) persist the last-fetched collection JSON in AsyncStorage (or `expo-sqlite`, already in Expo, if it grows); (2) the B4 grade write queue, with last-write-wins on `stickers` keyed by `last_reviewed_at`; (3) an offline banner. Scanning stays online-only. |
| **Sign in with Apple** | `expo-apple-authentication` plus an entitlement (`ios.usesAppleSignIn: true`) | **Cheap code, but native (S + rebuild)** | Not *required* by Guideline 4.8, because the app offers only email login, but it is the single biggest sign-up friction reducer. Supabase `signInWithIdToken({provider:'apple'})`. Handle a private-relay email and a missing username, which means a username step after first sign-in, the same screen onboarding needs. Account deletion must also **revoke the Apple token** (a 5.1.1(v) requirement for SIWA apps), which is an extra call in the `delete-account` function. |
| **StoreKit / RevenueCat paywall** | `react-native-purchases` (native) | **Medium–large (M–L)** | Code is small. Product work isn't: entitlement → quota mapping (`rateLimit.ts` reads `DAILY_LIMIT_*`; make it read a per-user tier from a RevenueCat webhook → `profiles.tier`), App Store Connect products, a restore button, and review-guideline copy. Can't be verified on the Simulator without a StoreKit config file, so plan on human verification. |
| **Skia foil/holo effects** | `@shopify/react-native-skia` (native, about 6 MB) | **Medium (M) + rebuild** | Reanimated 4 plus Skia shaders work fine. The cost is GPU on old phones, and the Maestro agent can't judge "looks shiny", so a human must verify. Confine it to one surface (DiscoveryReveal or rare stickers). |
| **Home-screen widget ("N due today" / today's sticker)** | Yes: a WidgetKit Swift target. Use `@bacons/apple-targets` (config plugin) and an App Group for shared data. | **Expensive (L)** | A Swift/SwiftUI target outside the React Native runtime, App Group entitlements (provisioning profile changes), data written from JS to shared UserDefaults (needs a small native module or `react-native-shared-group-preferences`), and timeline refresh. Can't be loop-built. Do it after reminders prove that a re-engagement surface moves D7. |

---

## 5. Harness readiness

### Verdict: fit for testID chores, not yet fit to drive feature work
What is good:
- The gate is real (typecheck, lint, tests, deno check).
- qa.sh preflight catches stale Metro and a bundle that fails to build.
- Protected files are guarded and tamper-diffed.
- A cheap QA model is used.
- There is model escalation.

Gaps that will produce false PASSes or stuck loops once features are product-shaped:

1. **QA results aren't tied to the code they tested.**
   - The problem: `harness/logs/qa-status.json` has no commit or tree hash. `test-drivable.mts` trusts whatever ran last. PROMPT.md *asks* that QA run after the last change, but no script enforces it.
   - The fix: qa.sh writes `"tree": $(git rev-parse HEAD^{tree})` plus a dirty-diff hash, and test-drivable reports FAIL "stale QA" on a mismatch.
2. **The oracle is written by the agent being judged.**
   - The problem: Haiku writes `.maestro/agent/<id>.yaml` *and* runs it. A weak flow (assert the home screen shows) passes. The only constraint is the prose `flow_must_show`, and no script reads it.
   - The fix: each feature declares **`flow_asserts`**, the literal selectors and strings the flow YAML must contain (test-drivable greps the YAML), and optionally a **human-approved acceptance flow** under `.maestro/accept/` that is protected and must pass too.
3. **Product logic has no unit-test hook.**
   - `test-drivable` only greps source. The agent *can't* write `scripts/test-*.mts`, because they are guarded, which is correct since tests are oracles. But that means feature logic (scheduling, queues, funnel props) is either untested or tested only through the UI.
   - The fix: the human pre-writes `scripts/test-<feature>.mts` (TDD acceptance tests) *before* the loop runs. The feature entry names it, and test-drivable runs it with `node --test` and requires it to pass. Allow the agent its own extra tests under `scripts/spec/` (not guarded, run by a new `npm run test:spec` in init.sh).
4. **There is one seed state.**
   - The problem: `.maestro/seed.mjs` always produces "one card, pomme, due now". Onboarding needs an empty account. Reminders need N due tomorrow. Offline needs a cached collection. The agent can't edit seed.mjs (it is guarded).
   - The fix: the human adds named seed profiles (`node .maestro/seed.mjs --profile empty|one-due|ten-mixed|challenge-pending`). Each feature names its profile, and flows choose one with `runScript` or an env var.
5. **Nothing makes invisible effects visible.**
   - The problem: scheduled notifications, analytics events and queued writes don't show in the UI, so Maestro can't assert them.
   - The fix: a `__DEV__`-only debug route (`app/__debug.tsx`, reachable via `lingostickers://__debug`) that renders `getAllScheduledNotificationsAsync()`, the last 50 `trackEvent` calls (a ring buffer in `lib/analytics.ts` under `__DEV__`) and the pending write queue. Maestro uses `openLink` and asserts text. **This is the first feature to build**, as harness infrastructure. It must be stripped from release; check that with a static `forbid` check that it's gated.
6. **Native, backend and human-only work blocks the loop.**
   - The problem: `first_failing` picks the first FAIL in list order. A feature needing a migration, an edge-function deploy or a native dependency will stall twice, then stop.
   - The fix: each entry has `"executor": "loop"|"human"` and `depends_on`. test-drivable skips `human` entries and any entry whose deps don't pass. Migrations can be *written* by the loop under `supabase/migrations/` but are applied by the human. Use `"requires_human": ["apply migration 043"]` and a status of `BLOCKED_ON_HUMAN`, not FAIL.
7. **The loop runs against production.**
   - The problem: `ALLOW_PROD_BACKEND=1`. Product features write rows (reminder settings, review_log, drafts). The QA account is isolated by RLS, but new migrations would be tested only in production.
   - The fix: before any feature that writes schema, create `.env.staging` (a second Supabase project on the free tier) and make migration-carrying entries require it (`"backend": "staging"`).
8. **Regression is not ratcheted.**
   - The problem: the full suite reruns, but `test-drivable` doesn't require previously passing features to *still* pass before picking new work. Only PROMPT prose does.
   - The fix: test-drivable prints `REGRESSED <id>` for a feature that passed at a previous commit and fails now, and `first_failing` returns regressions first.
9. **Lint warnings can grow without limit.** Add `--max-warnings 43` to the gate.

The required human-side changes are to `scripts/test-drivable.mts`, `harness/qa.sh`, `.maestro/seed.mjs`, and a new `.maestro/accept/` folder. All are guarded, so the founder makes them: about 150 lines in total.

### Proposed `feature_list.json` v2 schema

```jsonc
{
  "schema": 2,
  "goal": "string",
  "rules": "string",
  "features": [{
    "id": "kebab-id",
    "title": "short human title",
    "kind": "infra | feature | fix | chore",
    "executor": "loop | human",            // human = skipped by first_failing, listed in a TODO
    "depends_on": ["ids that must PASS first"],
    "requires_human": ["one-line actions the loop cannot do; status BLOCKED_ON_HUMAN until listed artifacts exist"],
    "backend": "none | staging",           // staging = refuse to run against prod
    "seed": "empty | one-due | ten-mixed | challenge-pending",
    "spec": {
      "user_story": "As a … I want … so that …",
      "acceptance": ["numbered, observable behaviours (each maps to a check or a flow assert)"],
      "copy": { "key": "exact user-visible string (the agent must use verbatim)" },
      "out_of_scope": ["things the agent must NOT do"]
    },
    "checks": {
      "static": [{ "file": "path", "testIDs": [], "includes": [], "forbid": ["strings that must NOT appear"] }],
      "unit":   [{ "file": "scripts/test-<id>.mts", "owner": "human", "min_pass": 1 }],
      "events": ["analytics event names that must appear in a trackEvent('<name>' call somewhere under app|components|hooks|lib"]
    },
    "flows": [{
      "path": ".maestro/agent/<id>.yaml",            // agent-written
      "owner": "agent | human",                      // human flows live in .maestro/accept/ and are guarded
      "must_show": "prose for the QA agent",
      "asserts": ["literal selectors/strings the YAML must contain"],
      "screenshots": ["names the flow must takeScreenshot"]
    }],
    "budget": { "max_attempts": 3, "max_usd_per_attempt": 3 },
    "verify_human": "what a person checks on a real device afterwards (camera, haptics, notification banner)"
  }]
}
```

How test-drivable v2 evaluates an entry:
- PASS requires all of these:
  - the deps pass
  - every static check passes, and every `forbid` string is absent
  - every unit file exists, is owned by the human (committed before the scaffold commit) and passes
  - every event appears in a `trackEvent(` call
  - every flow exists, contains every `asserts` string, and passed in a qa-status whose `tree` equals the current tree
- `executor: human` or unmet `requires_human` → `BLOCKED_ON_HUMAN`. Neither is picked as the next target.

### Three fully-written example entries

```json
[
  {
    "id": "dev-debug-surface",
    "title": "Dev-only debug screen that makes invisible state assertable",
    "kind": "infra",
    "executor": "loop",
    "depends_on": [],
    "requires_human": [],
    "backend": "none",
    "seed": "one-due",
    "spec": {
      "user_story": "As the QA agent I need to see scheduled notifications, recent analytics events and pending writes as on-screen text so Maestro can assert them.",
      "acceptance": [
        "1. lib/analytics.ts keeps the last 50 trackEvent calls (name + props JSON) in an in-memory ring buffer ONLY when __DEV__ is true, and still forwards to Aptabase exactly as before.",
        "2. A route app/__debug.tsx renders three sections with headers 'SCHEDULED', 'EVENTS', 'PENDING WRITES'; each item is one Text line; empty sections show 'none'.",
        "3. SCHEDULED lists Notifications.getAllScheduledNotificationsAsync() as '<identifier> · <trigger type> · <hour>:<minute>' when available.",
        "4. The route renders null and redirects to '/' when __DEV__ is false.",
        "5. Opening lingostickers://__debug in the Simulator shows the screen; a 'Refresh' button re-reads all three sections."
      ],
      "copy": { "title": "Debug", "refresh": "Refresh", "empty": "none" },
      "out_of_scope": ["No link to this screen from any visible UI", "No change to existing analytics event names or props"]
    },
    "checks": {
      "static": [
        { "file": "lib/analytics.ts", "includes": ["__DEV__", "getRecentEvents"], "forbid": [] },
        { "file": "app/__debug.tsx", "testIDs": ["debug-refresh", "debug-scheduled", "debug-events", "debug-pending"], "includes": ["__DEV__", "getAllScheduledNotificationsAsync"], "forbid": [] }
      ],
      "unit": [],
      "events": ["app_launched"]
    },
    "flows": [
      {
        "path": ".maestro/agent/dev-debug-surface.yaml",
        "owner": "agent",
        "must_show": "Sign in, openLink lingostickers://__debug, assert the three section headers, tap Refresh, assert an 'app_launched' line in EVENTS.",
        "asserts": ["openLink", "lingostickers://__debug", "SCHEDULED", "EVENTS", "PENDING WRITES", "debug-refresh", "app_launched"],
        "screenshots": ["debug-screen"]
      }
    ],
    "budget": { "max_attempts": 3, "max_usd_per_attempt": 3 },
    "verify_human": "Build a preview (release) bundle and confirm lingostickers://__debug lands on home, not the debug screen."
  },
  {
    "id": "review-reminder",
    "title": "Daily local review reminder with a Profile toggle and time",
    "kind": "feature",
    "executor": "loop",
    "depends_on": ["dev-debug-surface"],
    "requires_human": [],
    "backend": "none",
    "seed": "one-due",
    "spec": {
      "user_story": "As a learner I want one gentle daily nudge when cards are due so I come back without having to remember.",
      "acceptance": [
        "1. Profile gains a REMINDERS section with a switch (testID reminder-toggle) and a time row (testID reminder-time) defaulting to 19:00; the time row is hidden while the switch is off.",
        "2. Turning the switch on calls the existing in-context permission flow from lib/notifications.ts; if permission is denied the switch returns to off and an inline note with the copy 'deniedNote' is shown (no system Alert).",
        "3. When on, exactly ONE local notification is scheduled with identifier 'review-reminder' using a DAILY trigger at the chosen hour and minute; changing the time replaces it (still exactly one).",
        "4. Turning it off cancels 'review-reminder'.",
        "5. Setting persists per user in AsyncStorage key 'reminder:v1:<userId>' as {enabled, hour, minute} and is restored on relaunch; signing out cancels the reminder.",
        "6. Pure helper lib/reminders.ts exports reminderBody(dueCount: number): string returning copy.body_some for n>=1 with n substituted and copy.body_none for 0, and nextReminderPlan(settings) returning {identifier, hour, minute} or null; scripts/test-review-reminder.mts (human-owned) must pass.",
        "7. trackEvent('reminder_enabled', {hour}) and trackEvent('reminder_disabled') fire on the respective toggles."
      ],
      "copy": {
        "section": "REMINDERS",
        "toggle": "Daily review reminder",
        "deniedNote": "Notifications are off for Tabi Stickers. Turn them on in Settings to get reminders.",
        "body_some": "{n} cards are ready for review",
        "body_none": "Find something new today?",
        "title": "Tabi Stickers"
      },
      "out_of_scope": ["No remote push changes", "No streaks", "No native/config-plugin changes", "Do not ask for notification permission at launch"]
    },
    "checks": {
      "static": [
        { "file": "lib/reminders.ts", "includes": ["scheduleNotificationAsync", "cancelScheduledNotificationAsync", "review-reminder", "DAILY"], "forbid": ["requestPermissionsAsync()"] },
        { "file": "app/profile.tsx", "testIDs": ["reminder-toggle", "reminder-time"], "includes": ["REMINDERS"], "forbid": ["Alert.alert('Notifications"] },
        { "file": "hooks/useAuth.ts", "includes": ["cancelReviewReminder"], "forbid": [] }
      ],
      "unit": [{ "file": "scripts/test-review-reminder.mts", "owner": "human", "min_pass": 6 }],
      "events": ["reminder_enabled", "reminder_disabled"]
    },
    "flows": [
      {
        "path": ".maestro/agent/review-reminder.yaml",
        "owner": "agent",
        "must_show": "Sign in, open Profile, tap reminder-toggle (accept the iOS permission dialog), open lingostickers://__debug, assert a SCHEDULED line containing 'review-reminder' and '19:00'; return to Profile, toggle off, refresh debug, assert SCHEDULED shows 'none'.",
        "asserts": ["reminder-toggle", "lingostickers://__debug", "review-reminder", "19:00", "debug-refresh", "none"],
        "screenshots": ["reminder-on", "debug-scheduled", "reminder-off"]
      }
    ],
    "budget": { "max_attempts": 3, "max_usd_per_attempt": 3 },
    "verify_human": "On a phone, set the time 2 minutes ahead, background the app, confirm the banner shows the due count and tapping it opens the app on home."
  },
  {
    "id": "grade-write-queue",
    "title": "Grades survive a failed write: queue, retry, and honest summary",
    "kind": "fix",
    "executor": "loop",
    "depends_on": ["dev-debug-surface"],
    "requires_human": [],
    "backend": "none",
    "seed": "one-due",
    "spec": {
      "user_story": "As a learner reviewing on the subway, I want my grades kept when the network drops, so a session is never silently thrown away.",
      "acceptance": [
        "1. New pure module lib/pendingWrites.ts: enqueue({stickerId, patch, at}), coalesce so only the latest patch per stickerId is kept, list(), remove(stickerId); persisted to AsyncStorage key 'pendingGrades:v1:<userId>'. Pure functions take an injectable storage so they can be unit-tested.",
        "2. StudyCard.handleGrade no longer rolls back on error (components/StudyCard.tsx ~L424-437): on a failed update it enqueues the patch, keeps the optimistic state, and the session continues.",
        "3. A flush runs on app foreground, on session end, and after any successful grade; each queued patch is written with .update(patch).eq('id', stickerId) and only applied if the server row's last_reviewed_at is older than the patch's (last-write-wins); success removes it.",
        "4. ReviewSummary shows copy.pending with the count when any grades remain queued at session end; otherwise unchanged.",
        "5. trackEvent('card_graded', {grade, queued}) fires once per grade with queued=true|false.",
        "6. scripts/test-grade-queue.mts (human-owned) passes: coalescing, persistence round-trip, last-write-wins ordering, removal on success, no loss on a throwing writer."
      ],
      "copy": { "pending": "{n} reviews will sync when you're back online" },
      "out_of_scope": ["No NetInfo or other native dependency", "No offline scanning", "No change to lib/review.ts scheduling math"]
    },
    "checks": {
      "static": [
        { "file": "lib/pendingWrites.ts", "includes": ["pendingGrades:v1:", "export function enqueue", "export async function flush"], "forbid": [] },
        { "file": "components/StudyCard.tsx", "includes": ["enqueue("], "forbid": ["// Roll back rather than leave the card claiming"] },
        { "file": "components/ReviewSummary.tsx", "includes": ["sync when you're back online"], "forbid": [] }
      ],
      "unit": [{ "file": "scripts/test-grade-queue.mts", "owner": "human", "min_pass": 5 }],
      "events": ["card_graded"]
    },
    "flows": [
      {
        "path": ".maestro/agent/grade-write-queue.yaml",
        "owner": "agent",
        "must_show": "Regression of the happy path with the queue in place: same journey as .maestro/study-grade.yaml (grade Good, 2 / 2 requeue, Session done, 1 card reviewed), then open lingostickers://__debug and assert PENDING WRITES shows 'none' and EVENTS contains 'card_graded'. (Offline itself is verified by the unit test; the Simulator has no scriptable airplane mode.)",
        "asserts": ["Good — next review in", "2 / 2", "Session done", "lingostickers://__debug", "PENDING WRITES", "none", "card_graded"],
        "screenshots": ["session-done", "debug-pending-empty"]
      }
    ],
    "budget": { "max_attempts": 3, "max_usd_per_attempt": 3 },
    "verify_human": "On a phone: start a session, enable Airplane Mode, grade 3 cards, end — summary shows '3 reviews will sync…'; disable Airplane Mode, foreground the app, confirm in Supabase that the 3 rows have new last_reviewed_at."
  }
]
```

### Suggested order for the next list (after the 6 testID items)
1. `dev-debug-surface` (infra)
2. `scheduler-tests-enable`, *human*: `import type` fix plus `scripts/test-review.mts`
3. `grade-write-queue` (B4)
4. `draft-persistence` (B5 client half)
5. `signout-push-token` (B3; needs an RPC, so the human applies the migration)
6. `funnel-events` (§2 table; `events` checks plus a debug-surface flow)
7. `user-error-messages` (`lib/errors.ts` and the scan/save/quota banners)
8. `review-reminder`
9. `post-save-handoff`
10. `onboarding-first-run` (seed `empty`)
11. `theme-semantic-aliases` (codemod in slices)

These are *human* or *native* items, outside the loop: B1, B2 and B7 (config and policy), B8 (it could go in the loop: JS only), Sentry and SIWA (one batched native rebuild), and widgets.
