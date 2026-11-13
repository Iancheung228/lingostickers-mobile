# Expo HAS CHANGED

This project is on **Expo SDK 54**. Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

# Verify UI changes on the Simulator, cheaply

After any change a user could see or tap, verify it with Maestro on the iOS
Simulator before calling it done. Don't drive Maestro from the main session —
delegate to the `qa-tester` subagent (Haiku), which runs `harness/qa.sh`,
judges the screenshots and reports PASS/FAIL with evidence. New flows go in
`.maestro/agent/`; `.maestro/*.yaml` are human-approved and not to be edited.
Needs Metro with file watching (`npm run dev`) and the Tabi Dev build on a
booted Simulator; `harness/qa.sh` checks both and
says exactly what's missing. The unattended version of this is
`harness/run-loop.sh` — see `harness/README.md`.

# Staging by default; production is the owner's call

The app is live. Local dev, the Simulator, Maestro and Tabi Dev/Preview builds
use the **staging** Supabase project (`.env`); real users are on production
(`.env.production`, reached only with `TABI_ENV=production`). Backend changes
go through `scripts/deploy.sh staging` first. Never deploy to production, set
production secrets, publish an `eas update`, build, submit, or touch App Store
Connect without the owner's yes for that specific change. How everything
ships, and the limits: `RELEASING.md`.

@skills.md
