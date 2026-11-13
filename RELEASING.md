# Environments, deploys and releases

How a change gets from this repo to users, and the rules that keep test work
away from real users. Set up 2026-11-12, after the app went live, following
Expo's [app variants](https://docs.expo.dev/build-reference/variants/) and
[EAS environment variables](https://docs.expo.dev/eas/environment-variables/)
guides, Supabase's [managing environments](https://supabase.com/docs/guides/deployment/managing-environments)
guide, and the usual TestFlight + phased-release practice for App Store apps.

## Environments

Two backends, three apps. Every app except the store app talks to staging.

| | Tabi Dev | Tabi Preview | Tabi Stickers |
|---|---|---|---|
| What it is | dev client, loads JS from Metro | release build for testing | the App Store app |
| Bundle id | `com.iancheung228.lingostickers.dev` | `….lingostickers.preview` | `com.iancheung228.lingostickers` |
| Icon | red DEV band | blue PREVIEW band | normal |
| EAS profile / environment | `development` | `preview` | `production` |
| Backend | **staging** | **staging** | **production** |
| Analytics (Aptabase) | off | off | on |
| OTA channel | — (Metro) | `preview` | `production` |

All three install side by side. `app.config.js` derives each identity from
`APP_VARIANT` (set per profile in `eas.json`; unset means production).

| Backend | Supabase project | Ref | Used by |
|---|---|---|---|
| staging | `tabi-staging` | `ecqmbmbieajufyvlvwbz` | local dev, Simulator, Maestro, harness loop, Tabi Dev/Preview |
| production | `LingoStickers` | `vilowlcvzbbthuiplykn` | Tabi Stickers (real users), App Review demo account |

Where the settings live (all gitignored or remote, never committed):

| File / place | Holds |
|---|---|
| `.env` | staging URL + anon key. What Metro bundles and what every script uses by default |
| `.env.production` | production URL, anon key, Aptabase key. Scripts use it only with `TABI_ENV=production` |
| `.maestro/qa.env` / `.maestro/qa.production.env` | the QA account (`maestro-qa@tabi.test`) on each project; different passwords |
| `.maestro/demo.env` | App Review demo account (production) |
| EAS environment variables | what cloud builds get: `development`/`preview` = staging, `production` = production |
| Supabase secrets (per project) | `GEMINI_API_KEY` (separate key per project), `DAILY_LIMIT_OVERRIDES` (that project's QA account id), etc. |
| macOS Keychain, "Tabi staging DB password" | staging database password |

`scripts/lib/backend.sh` / `backend.mjs` pick the backend for every script and
**refuse to run if `.env` points at production**.

## Day to day

```bash
npm run dev            # Metro, dev variant, file watching on, staging backend
```

Open **Tabi Dev** on the phone (same Wi-Fi; "Enter URL manually" →
`http://<Mac LAN IP>:8081`) or on the Simulator. JS/TS changes hot-reload. Your
staging account is separate from your real one; sign up on staging once.

A new **dev build** is needed only for native changes: a native package, a
permission, `modules/` Swift, the icon, `app.json`/`app.config.js`, `plugins/`.
Simulator builds are local and free (see `harness/README.md`); phone builds
are EAS builds (15/month; the owner says yes each time).

To look at production data from a dev build (read-only debugging, never
"testing"): `set -a; . ./.env.production; set +a; npm run dev`. Exported
variables beat `.env`.

## Backend changes (migrations, edge functions)

Staging first, every time. `scripts/deploy.sh` enforces it.

1. Write the migration (`supabase/migrations/NNN_name.sql`) or function change.
   Migrations must be **additive and backward-compatible**: the store app
   already in people's hands keeps calling the old shape until they update
   (see "Compatibility" below).
2. `scripts/deploy.sh staging db` and/or `scripts/deploy.sh staging functions [names]`.
   Functions are type-checked first (`npm run typecheck:functions`).
3. Test on Tabi Dev / the Simulator (`harness/qa.sh`).
4. Commit, merge to `main`, push. CI (`.github/workflows/ci.yml`) runs the gate.
5. `scripts/deploy.sh production db|functions|all`. It refuses unless you're on
   `main`, clean, pushed, and this exact commit went to staging; then you
   type the production ref to confirm.

Secrets are per project and not covered by the script:
`npx supabase secrets set --project-ref <ref> NAME=value`. Setting a secret on
production is a production change: same care as a deploy.

The Supabase CLI stays linked to **staging**. `deploy.sh` links production only
for the duration of a production db push and re-links staging on exit.

### Compatibility (why order matters)

The backend is shared by every installed version of the app, and you can't
make people update. So:

- **Backend before app.** Ship the backend change that works with old *and*
  new app versions, then the app release that uses it, then (weeks later)
  remove the old path.
- Never rename or drop a column, function parameter or response field that a
  released app version reads. Add the new one; stop using the old one; drop it
  only after old versions are gone.
- An edge function must not start *requiring* a field the store app doesn't send.

## App releases

1. Bump `version` in `app.json` for a user-visible release (build numbers
   auto-increment remotely).
2. Optional but recommended for anything risky: a **preview** build
   (`eas build -p ios --profile preview`) and test it on staging as a real
   release build.
3. `eas build -p ios --profile production` (the owner says yes first), then
   `eas submit -p ios --profile production`. Run non-interactively, EAS skips
   checking the provisioning profile with Apple unless these are set:
   `EXPO_APPLE_TEAM_ID=2LHHQXL6VF EXPO_APPLE_TEAM_TYPE=INDIVIDUAL EXPO_ASC_API_KEY_PATH=~/.eas-keys/AuthKey_7YCX8GPN5V.p8 EXPO_ASC_KEY_ID=7YCX8GPN5V EXPO_ASC_ISSUER_ID=9550a35f-5018-41d2-95f0-0d721ca80f9f`.
   A **new bundle id** (each variant's first build) can't get credentials
   non-interactively at all: the owner runs that first build in a terminal.
4. Install the build from **TestFlight** yourself and smoke-test it against
   production with your own account: sign in, scan, review. TestFlight is the
   closest thing to what users get (release build, real backend).
5. Submit for review with **phased release** on (App Store Connect → the
   version → "Phased Release for Automatic Updates"). It rolls out over 7 days
   to auto-updaters and can be paused if something breaks. It does not undo
   installs, and people who update manually get it straight away.
6. Watch the first 24–48 h: Aptabase, Supabase function logs, reviews.

Any App Store Connect action (submit, release, phased-release changes,
metadata) is the owner's or needs their explicit yes for that release.

## Over-the-air updates (EAS Update)

`expo-updates` is installed with `runtimeVersion: { policy: "fingerprint" }`.
An update reaches only builds whose native fingerprint matches, so a JS update
can never land on a binary missing the native code it needs.

- **The current App Store build (1.0.0, Nov 2026) predates this and can't
  receive updates.** The next production build is the first that can.
- Publish (JS/assets only, and only after testing on staging):
  `eas update --channel production --environment production --message "…"`.
  `eas update` evaluates `app.config.js` locally, so for the preview channel
  run it as `APP_VARIANT=preview eas update --channel preview --environment preview …`.
- Users get it on the **second** launch after publishing (downloaded in the
  background, applied next start).
- Roll back: `eas update:rollback` (or republish the previous commit).
- Apple allows OTA for fixes and small changes, not for changing what the app
  fundamentally does. Native changes always need a store build.
- Publishing an update to `production` is a release: the owner says yes.

## Limits and risks to know

- **Staging is on Supabase's free tier and pauses after ~1 week idle.** DNS
  stops resolving and sign-in fails; restore it from the dashboard.
- **Staging auth emails** use Supabase's built-in mailer, which only delivers
  to members of the Supabase org and only a few per hour. Test accounts are
  made pre-confirmed with the admin API (`.maestro/create-qa-user.sh`) or you
  sign up with your own address. Password-reset links point at
  tabistickers.com, which talks to production, so they don't work for staging.
- **Staging has no data from production**: no real users' stickers, by design.
  Seed what you need; never copy production user data into it.
- **AI calls cost money on both projects.** The QA budget (100 AI calls/UTC
  day, `node scripts/qa-budget.mjs`) is per project.
- **The Simulator has no Apple Vision**: on-device cutouts and thumbnails need
  a real iPhone (`docs/lessons.md` §17).
- **App fixes are slow.** Build + review (~1 day) + users updating. Until OTA
  is live in a store build, put kill switches and tunable values server-side.
- **Universal links** (tabistickers.com) open only the store app; Tabi Dev and
  Tabi Preview don't claim the domain.
