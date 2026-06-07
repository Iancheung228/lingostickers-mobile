# rembg-server — preserved prototype (NOT in active use)

This is a self-hosted background-removal service kept as a **reference** for the
"Option B" path described in the main project README (`../README.md`, the
"Background Removal — Research & Future Work" section).

**The live app does NOT call this.** Production background removal goes through
remove.bg inside the `create-sticker` Supabase Edge Function. This folder was
saved when consolidating two old project clones so the Fly.io setup doesn't have
to be rebuilt from scratch if we later switch to self-hosted rembg.

## What it is

- FastAPI service wrapping [rembg](https://github.com/danielgatis/rembg) with the
  `u2netp` model (Apache-2.0 weights — commercial OK).
- `POST /remove-bg` (multipart `image_file`) → cut-out PNG.
- `GET /health` → `{"status": "ok" | "loading"}`.
- Model is lazy-loaded in a background thread so uvicorn boots immediately.
- Deployed to Fly.io as `lingostickers-rembg` (1GB shared VM, auto-suspend).

## Gotcha

Auto-suspend means a cold machine takes ~90s to load the model on wake, and
returns `503 "Model still loading"` until ready. Wire a retry/fallback if you
re-activate this.

## To re-activate

Point `removeBackground()` in `supabase/functions/create-sticker/index.ts` at
this server's `/remove-bg` endpoint instead of remove.bg, then `fly deploy`.
