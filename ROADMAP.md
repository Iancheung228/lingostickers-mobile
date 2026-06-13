# LingoStickers — Product Roadmap

> Living document. This is a multi-day plan — check items off, add notes,
> and update "Open questions" as decisions get made. Pick up wherever you
> left off.

## The vision

Stop building a vocabulary app with a camera bolted on. Build **a visual
diary of your language life that happens to teach you the language.** Every
sticker is a *memory capsule*: the object, the word, how to say it, a
sentence about what was happening, and where/when it happened. Reviewing
your collection should feel like flipping through a scrapbook of your own
life — in French, in Japanese, eventually in Teochew.

Target languages for now: **French (fr) + Japanese (ja)**. Teochew is a
later, fundamentally different effort (low-resource — see "Future: Teochew"
at the bottom) and shouldn't block this plan.

## The north-star shape of a "sticker" (memory capsule)

Today a sticker is `{name, translation, pronunciation, category, image_path}`.
Where we're going:

```
{
  language: 'fr' | 'ja'
  word: string              // target-language word/phrase, native script
  reading: string           // how to say it — see Phase 2 (real pronunciation)
  translation: string       // English meaning
  sentence: string          // target-language sentence about THIS scene
  sentence_translation: string
  audio_path: string        // TTS clip of word (+ later, sentence)
  image_path: string        // the cutout sticker (current pipeline)
  memory_photo_path: string // full uncropped original photo (Phase 5)
  memory_video_path?: string// short clip / "live sticker" (Phase 5, stretch)
  category: Category
  tags: string[]            // user labels: "dorm room", "commute", "office"
  latitude / longitude       // optional, for future map view
  location_label: string     // reverse-geocoded place, e.g. "Montreal"
  discovered_at: timestamptz // already exists — date + time-of-day
}
```

Every phase below is a step toward this shape. None of them require the
others to be "done" — they're additive columns/fields, so we can ship
incrementally.

---

## Phase 1 — Language abstraction (foundation, do first)

**Why first:** everything else (pronunciation, sentences, even the prompts)
is currently hardcoded to French. Nothing else can ship cleanly until this
is sorted.

- [x] Add `profiles.target_language` (`'fr' | 'ja'`, default `'fr'`) — the
      user's active learning language, set in a simple Settings screen.
- [x] Add `stickers.language` column (same enum) — store per-sticker so a
      user's collection can mix languages if they ever switch.
- [x] Redesign the language-specific fields to be neutral:
      - `name` → `word` (the word/phrase in the target script — "Le Café" /
        "コーヒー")
      - `pronunciation` → `reading` (see Phase 2 for what goes here)
      - keep `translation` as-is (English)
- [x] Refactor `identifyWithGroq` (create-sticker) and `translateWithGroq`
      (translate-word) into **one prompt-builder function parameterized by
      `language`**, with fr/ja templates. Japanese needs to specify: word in
      kanji/kana, romaji reading, category — same JSON contract shape, just
      different field content.
- [x] Update `DiscoveryReveal`, `StickerDetailView`, `StickerCard` to render
      `word` / `reading` generically (no UI strings assume "French").
- [x] Settings screen: language picker (persists to `profiles.target_language`,
      used as the default for new captures).

**Status (2026-06-13): Shipped.** Migration `002_language_support.sql`
applied, `create-sticker`/`translate-word` deployed with the shared
`supabase/functions/_shared/vocab.ts` prompt module, Settings screen live
behind the gear icon on Collection.

**Open questions**
- Does Groq's vision model (`llama-4-scout`) reliably produce *correct*
  Japanese (kanji + accurate romaji) at temperature 0.1? **Not yet verified
  on-device** — try scanning ~10 household objects with the language set to
  日本語 and sanity-check the kanji/romaji before relying on it.
- Category enum (`Kitchen/Animals/Study/Nature/Other`) — keep as-is for now,
  revisit if it stops making sense for Japanese vocab.

---

## Phase 2 — Real pronunciation (TTS audio)

**Why:** "phonetic spelling in English" is already lossy for French and
breaks down for Japanese pitch accent. Audio is non-negotiable for actually
learning to *say* the word.

- [ ] New Supabase Storage bucket `sticker-audio`.
- [ ] New column `stickers.audio_path`.
- [ ] Pick a TTS provider that covers fr + ja well and is cheap at low
      volume (see open question below). Call it from `create-sticker`
      (parallel with the Groq + bg-removal calls) and from `translate-word`
      when the user edits the detected word.
- [ ] `reading` field becomes a *romanization* (romaji for ja, a clean
      pronunciation respelling for fr) — useful as a fallback/caption, but
      audio is now the primary "how do I say this" mechanism.
- [ ] UI: a play button (speaker icon) next to the word in `DiscoveryReveal`
      and `StickerDetailView`.

**Open questions**
- TTS provider: candidates are OpenAI TTS (`gpt-4o-mini-tts`, cheap, good
  multilingual coverage), Google Cloud TTS (generous free tier, strong
  ja/fr neural voices), ElevenLabs (best quality, pricier). Groq does not
  currently offer fr/ja TTS (their TTS models are English/Arabic only) —
  don't assume Groq covers this. Needs a quick cost/quality comparison on
  ~10 words in each language.
- Cache audio per *word* (not per sticker) — "Le Café" only needs to be
  synthesized once ever, regardless of how many users/stickers reference it.
  Could key the storage path by a hash of `(language, word)` to dedupe.

---

## Phase 3 — Sentences, not just words

**Why:** a word in isolation is an Anki card. A sentence about *this scene*
("I drink my coffee from this cup every morning") teaches grammar in context
and makes the capsule feel like *theirs*.

- [x] Extend the Groq prompt (same vision call as Phase 1) to also return
      `sentence` (target language, describing the object *in the scene
      just photographed*) and `sentence_translation` (English). With Phase
      5a shipped, the *memory photo* (full scene) is the better input for
      this than the cropped cutout — passed to the vision call as a second
      image when available.
- [x] New columns: `stickers.sentence`, `stickers.sentence_translation`.
- [x] UI: show the sentence below the word in `DiscoveryReveal` — target
      language sentence plus a tap-to-edit English translation row.
- [x] Manual edit: the user can edit the English sentence in
      `DiscoveryReveal`, which re-translates it into the target language via
      a new `translate-sentence` edge function (same pattern as
      `handleEditWord` / `translate-word`).
- [ ] Stretch: TTS the sentence too (Phase 2 infra), `sentence_audio_path`.

**Status (2026-06-13): Shipped (minus TTS stretch).** Migration
`004_sentences.sql` adds `stickers.sentence` / `stickers.sentence_translation`
(`NOT NULL DEFAULT ''`, so old stickers render fine with no sentence).
`identifyWithGroq` now sends both the cropped object photo and (when present)
the full memory photo in one Groq call, with a prompt that uses the second
image for scene context. New `translate-sentence` edge function +
`translateSentenceWithGroq` handle the manual-edit path. `StickerDetailView`
shows the sentence + its English translation as a caption overlay on the
memory-photo flip side.

This was a near-zero marginal cost addition once Phase 1's prompt refactor
was in place — same image(s), same API call, two more JSON fields.

---

## Phase 4 — The story layer: when, where, what was happening

**Why:** this is the heart of "transform a word into a memory." Right now
`discovered_at` exists but nothing is *done* with it.

- [ ] New columns: `stickers.tags TEXT[]` (default `'{}'`), `latitude`,
      `longitude`, `location_label`.
- [ ] Capture flow: after a successful scan, optionally prompt for a tag
      ("dorm room", "office", "commute") — autocomplete from the user's
      previously-used tags (`SELECT DISTINCT unnest(tags) ...`). Keep this
      *fast* — one tap on a suggested chip, or skip entirely.
- [ ] GPS capture via `expo-location` (with permission prompt) — store
      raw lat/long silently for a future map view; reverse-geocode to a
      coarse `location_label` (city/neighborhood) as a bonus, not the
      primary organizing concept (tags are user-meaningful, GPS is bonus
      enrichment).
- [ ] Collection screen: beyond the category filter, add views/filters for
      **date** (today / this week / by month) and **tags**. A "Timeline"
      view grouped by day, alongside the existing grid.
- [ ] Time-of-day badge (morning/afternoon/evening/night) — derived from
      `discovered_at`, no new column needed.

**Open questions**
- Location permission is a trust moment — make the ask contextual ("tag
  where this memory happened?") rather than a cold OS prompt on first
  launch.

---

## Phase 5 — The full memory: uncropped photo & "live sticker"

**Why:** tapping a sticker should be able to take you back to the actual
moment — the whole photo, not just the cutout.

### 5a — Store the original photo (low effort, ship first)
- [x] Upload the full, uncropped, pre-bg-removal photo alongside the cutout
      (new `memory_photo_path`, new or shared storage bucket). The capture
      pipeline already has this image in memory — it's currently discarded
      after cropping/bg-removal.
- [x] UI: tapping a sticker in `StickerDetailView` reveals the original
      photo — implemented as a tap-to-flip 3D card (Reanimated `rotateY` +
      `backfaceVisibility: hidden`), front = sticker, back = memory photo.
      Stickers without a memory photo (pre-Phase-5a) just don't flip.

**Status (2026-06-13): Shipped.** Migration `003_memory_photo.sql` adds
`stickers.memory_photo_path` (nullable). `create-sticker` accepts an
optional `memoryImage` and uploads it to `sticker-images/{userId}/{uuid}-memory.jpg`
in parallel with vocab lookup + bg removal (non-fatal on failure). `scan.tsx`
captures the full uncropped frame (camera capture or imported photo),
downsamples it (long side capped at 1280px, no upscale) via a new
`prepareMemoryPhoto` helper, and sends it alongside the cropped sticker
image. `StickerDetailView` fetches a signed URL for the memory photo and
flips to reveal it; delete cleanup removes both storage objects.

Next up (per user, before Phase 3 proper): use this memory photo as scene
context for a sentence describing what's happening, with manual edit +
LLM re-translation — see the new bullet under Phase 3 below.

### 5b — Live sticker (stretch, needs research)
- [ ] Investigate Expo SDK 54's `expo-camera` video recording
      (`CameraView.recordAsync`) as a 2-3s "memory clip" captured alongside
      the still — **check the versioned docs at
      https://docs.expo.dev/versions/v54.0.0/ first**, per AGENTS.md, before
      assuming Expo Go compatibility.
- [ ] True Apple `PHLivePhoto` is iOS-only and likely requires a native
      module + `expo prebuild` / dev client — same CNG tradeoff already
      documented in the bg-removal research below. **If we end up needing a
      dev client for this, that's the trigger to also do the on-device
      background-removal migration (Option A) — two birds, one prebuild.**

---

## Phase 6 — Search

**Why:** once the collection has words + translations + sentences + tags +
locations, browsing alone won't cut it.

- [ ] Search bar in Collection screen, client-side filter to start
      (`word`, `translation`, `sentence`, `tags`, `location_label` —
      collection sizes are small per-user, no need for server-side search
      yet).
- [ ] Revisit with Postgres full-text search (`tsvector`) only if/when
      collections get large enough that client-side filtering feels slow.

---

## Ongoing / parallel track — remove.bg's 50/month limit

Already documented in detail under "Background Removal — Research & Future
Work" below in this README. Status unchanged: not urgent yet, but:

- Keep an eye on usage as more people (friends) start using the app —
  50 images/month disappears fast with multiple users.
- If Phase 5b forces a dev-client/prebuild anyway, jump straight to
  **Option A (on-device, iOS Vision + ML Kit)** — it becomes nearly free to
  add once the prebuild tax is already paid, and fully removes the cost
  wall instead of just deferring it.
- Otherwise, **Option C (cheap pay-per-use API, ~$0.002/img)** remains the
  zero-effort bridge if the cap becomes annoying before Phase 5b happens.

---

## Suggested order

1. **Phase 1** (language abstraction) — unblocks everything, do this first.
2. **Phase 3** (sentences) — almost free once Phase 1's prompt refactor
   exists, big "memory" payoff.
3. **Phase 5a** (store original photo) — small change, immediately makes
   every future sticker richer; do it early so memories start accumulating.
4. **Phase 2** (TTS audio) — needs a provider decision, otherwise contained.
5. **Phase 4** (tags/location/timeline) — the organizing/browsing layer,
   makes more sense once there's a backlog of richer stickers to organize.
6. **Phase 6** (search) — once there's enough data to search.
7. **Phase 5b** (live sticker) — revisit alongside the bg-removal migration.

---

## Future: Teochew (heritage language mode)

Deliberately out of scope for this plan. Teochew is low-resource enough that
an LLM-generated romanization is likely to be *wrong*, not just imprecise.
The eventual idea: instead of the AI being the source of truth, the app
becomes a tool for **capturing a word from a real object, then recording a
real person (family) saying it** — building a personal/family audio
dictionary anchored to objects and memories. This reuses the Phase 2 audio
infrastructure (storage, playback UI) but flips the source from TTS to a
voice recording. Don't design for this now — but Phase 2's `audio_path` /
playback UI should stay provider-agnostic so a "record instead of
synthesize" path can slot in later without a schema change.

---

## Appendix — Background Removal Research & Future Work

> Status (as of 2026-06): **Still using remove.bg.** This section documents
> research into replacing it so the next person doesn't have to redo it. No
> migration is in progress — it's a deliberate "later" decision (see Trigger).

### Current state

Background removal lives in the `create-sticker` Supabase **Edge Function**
(`supabase/functions/create-sticker/index.ts`):

1. App resizes the photo to 800px wide and sends base64 to the edge function.
2. Edge fn runs Groq vocab identification **and** `removeBackground()` in
   parallel, then `addStickerBorder()` (pure-JS dilation via UPNG), then uploads
   the result to Supabase Storage.
3. `removeBackground()` calls **remove.bg** (`api.remove.bg`). On failure it
   degrades gracefully: uploads the original JPEG and returns a `bgIssue` notice
   the app shows to the user.

> Note: the comment header in `index.ts` mentions "HuggingFace RMBG-1.4" — that
> is **stale**. The live code calls remove.bg.

### The problem

remove.bg free tier = **50 images/month**. Fine for MVP, but not scalable. This
is a *scaling* cost, so it only bites once there's real usage.

### Why "run an open-source model inside the edge function" does NOT work

Tempting idea: run U2Net/RMBG via Transformers.js/ONNX directly in the Deno edge
function. **Not viable** — Supabase edge functions are memory- (~256MB) and
CPU-time-constrained; these models are 80–180MB with slow CPU inference. Ruled
out.

### Options evaluated

| Option | Per-image cost | Scales? | Effort | Main catch |
|---|---|---|---|---|
| **A. On-device native** (iOS Vision + Android ML Kit) | **$0** | ∞ | Med | Needs Expo prebuild + dev client (no Expo Go); **iOS 17 floor** |
| **B. Self-host rembg (U2Net)** on Fly.io / Cloud Run | server compute only | high | Med | Run/maintain a server + cold starts. **Prototype already exists** (see below) |
| **C. Cheaper pay-per-use API** (Replicate / fal.ai / Photoroom) | ~$0.001–0.01 | high | **Low** | Still a per-image cost. Good *bridge* — ~10-line edge-fn change |
| **D. On-device ONNX** (U2Net/RMBG via `onnxruntime-react-native`) | $0 | ∞ | High | +app bundle size; RMBG weights are **non-commercial** |

### The key finding (Option A)

Both mobile OSes now ship **free, on-device, _class-agnostic_** subject
segmentation — cuts out *any* object, not just people, which is exactly our use
case (objects on tables → stickers):

- **iOS**: Vision `VNGenerateForegroundInstanceMaskRequest` — class-agnostic,
  on-device, but **iOS 17+ only** (verified vs Apple docs). Does **not** run on
  the iOS Simulator — needs a real device.
- **Android**: ML Kit **Subject Segmentation** — objects/pets/humans, on-device,
  API 24+, ~200ms on a Pixel 7 Pro. Currently beta.
- MIT wrapper: [`react-native-background-remover`](https://github.com/atlj/react-native-background-remover)
  wraps both behind one JS call. ⚠️ Its README claims "iOS 15+" but the
  underlying API is iOS 17 — it likely falls back to *person-only* segmentation
  on iOS 15/16 (useless for objects). **Verify this before relying on it.**

This is the only option that fully removes the cost wall ($0/image, infinite
scale, offline, better privacy) instead of just lowering it. Trade-off: leaves
the zero-config Expo Go workflow behind (one-time CNG prebuild + EAS dev-client
build; routine JS edits still fast-refresh normally), and a minority of older
iPhones (iOS <17) must use a fallback.

### Existing prototype (Option B)

There is a **working self-hosted rembg prototype** preserved in
[`rembg-server/`](./rembg-server/) (FastAPI + rembg `u2netp` model, deployed to Fly.io as
`lingostickers-rembg`, 1GB shared VM, auto-suspend). It exposes `POST /remove-bg`
and `GET /health`, and lazy-loads the model in a background thread so uvicorn
boots fast. To use it, point `removeBackground()` at that endpoint instead of
remove.bg. Watch out for **cold starts** (auto-suspend → ~90s model load on wake;
the server returns 503 "still loading" until ready).

### Licenses (matters for a commercial app)

- rembg = MIT; **U2Net weights = Apache-2.0** (commercial OK ✅)
- **BRIA RMBG-1.4 / 2.0 = non-commercial** ❌ (avoid for Option D)
- Apple Vision & Google ML Kit = free for commercial use under normal platform ToS ✅

### Recommendation

**On-device native (A) is the destination; don't migrate until there's a real
trigger.** Until then:

1. Keep remove.bg (or swap to a cheap pay-per-use API (C) as a near-zero-effort
   bridge if the 50/month cap becomes annoying during dev — ~$0.002/img).
2. When convenient, run the **quality benchmark** (Phase 0 below) — it's the only
   genuinely risky unknown.

**Pull the trigger on the on-device build when EITHER:**
- bg-removal cost becomes a line item you actually notice (real volume), **or**
- you're already adding a dev client for some other native feature (CNG tax
  already paid → on-device segmentation becomes nearly free to add).

### Verification plan (when migrating to Option A)

- **Phase 0 — Quality benchmark (½ day, do this first):** run ~25 representative
  real photos (objects on tables, varied lighting/clutter) through remove.bg
  (baseline), Apple Vision, ML Kit, and rembg-u2net. Compare cutouts side by
  side. **Gate:** native quality ≈ remove.bg on *our* inputs. If native is weak
  on cluttered scenes, fall back to B or C.
- **Phase 1 — Build feasibility (½ day):** `expo prebuild`, add the native lib,
  build a dev client, run on a **real iOS 17 device** + an Android device.
  **Gate:** builds and returns a cutout on both. Confirm what the lib actually
  does on iOS 15/16 → defines the fallback trigger.
- **Phase 2 — Wire the new flow:** device removes bg → sends cutout (+ original)
  to edge fn; edge fn keeps Groq + `addStickerBorder` + upload; fallback to a
  cheap API for unsupported devices/failures (reuse existing `bgIssue` pattern).
  Measure on-device latency vs current round-trip.
- **Phase 3 — Ship behind the existing fallback,** monitor `bgIssue` rates,
  then retire remove.bg.

### Sources

- [react-native-background-remover](https://github.com/atlj/react-native-background-remover)
- [Apple VNGenerateForegroundInstanceMaskRequest](https://developer.apple.com/documentation/vision/vngenerateforegroundinstancemaskrequest) · [Lift subjects from images (WWDC23)](https://developer.apple.com/videos/play/wwdc2023/10176/)
- [ML Kit Subject Segmentation](https://developers.google.com/ml-kit/vision/subject-segmentation) · [Android guide](https://developers.google.com/ml-kit/vision/subject-segmentation/android)
- [rembg](https://github.com/danielgatis/rembg) · [onnxruntime-react-native](https://onnxruntime.ai/docs/get-started/with-javascript/react-native.html)
- [Expo: Adopt Prebuild](https://docs.expo.dev/guides/adopting-prebuild/) · [Dev Client](https://docs.expo.dev/versions/latest/sdk/dev-client/)
