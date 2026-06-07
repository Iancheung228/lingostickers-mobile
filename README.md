# lingostickers-mobile

---

## Background Removal — Research & Future Work

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
