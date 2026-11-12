# Human requests

Status audit 2026-11-11 (checked against the code in this tree). Items are
marked **RESOLVED** with evidence, **OPEN**, or **UNVERIFIED** (needs a human
or a live environment). Resolved items are kept for the record.

| Request | Status |
|---|---|
| Turn off Simulator hardware keyboard to verify keyboard occlusion | OPEN (needs a human) |
| learning-requeue-copy: study-grade regex + per-flow re-seed | RESOLVED |
| collection-search-visible flaky full run | UNVERIFIED (see below) |
| Flaky sign-in in human-approved flows | RESOLVED |
| username-format: database CHECK constraint | OPEN |


- **OPEN.** Simulator software keyboard is off (hardware keyboard connected), so keyboard-occlusion features (collection-search-visible, signin-keyboard) can't be visually verified. Toggle I/O > Keyboard > Connect Hardware Keyboard off (Cmd+Shift+K), then rerun `harness/qa.sh .maestro/agent/signin-keyboard.yaml`.

## learning-requeue-copy (RESOLVED)
Evidence: `.maestro/study-grade.yaml:45` now asserts `".*What did you call this\\?"`; `.maestro/run.sh` resets the QA account before every flow (comment at its line ~20); commit `6ed537f harness: learning-requeue-copy`. Original request below.

Implemented: "Still learning — one more look" note (StudyCard `stillLearning` prop, set by StudySessionHost for re-shown cards), included in the card's accessibility label; singular "about 1 minute" in HomeHeader. Standalone flow `.maestro/agent/learning-requeue-copy.yaml` PASSES on a fresh seed (qa-tester screenshots 10-12).
Two things I can't fix under the hard rules:
1. `.maestro/study-grade.yaml` (human-approved) asserts `"What did you call this\\?"` on the 2 / 2 card. The spec'd label prefix makes it `Still learning — one more look. What did you call this?`, so the full-match regex fails. Needs `".*What did you call this\\?"`. (Alternative: drop the label prefix, but the feature spec asks for it.)
2. The full `harness/qa.sh` doesn't re-seed between flows, and study-grade consumes the one due card, so the new flow fails when it runs after it. Needs a re-seed per flow, or this flow run first.
After either is fixed, rerun `harness/qa.sh` and commit as "harness: learning-requeue-copy".

## collection-search-visible (QA flaky) — UNVERIFIED
The suspected cause (sign-in focus race) was fixed in `.maestro/sign-in.yaml` (commit `c41c8cd`), and the feature is committed (`325b909`). No clean full run has been recorded since, and `harness/logs/qa-status.json` currently holds an unrelated scene-prompts run, so this is not confirmed. Auth rate limiting is still a possible cause (`scripts/qa-budget.mjs`). Original note below.

Feature was already implemented. Targeted flow PASSED once, but the final full `harness/qa.sh` rerun (2026-10-30) left qa-status.json with collection-search-visible FAILED ("FOUND" is visible, i.e. sign-in did not complete) and signin-keyboard FAILED (wrong-password banner "Invalid login credentials.*" never appeared); sign-in, study-grade and learning-requeue-copy passed. Earlier in the same session signin-keyboard also hit a Maestro XCTest driver failure before any step ran. Suspect auth rate limiting / QA-account throttling or Simulator slowness after many clean-state sign-ins (see scripts/qa-budget.mjs), not the app. Please check Supabase auth rate limits / Simulator health, then rerun `harness/qa.sh`.

## Flaky sign-in in human-approved flows (2026-10-30, loop iter) — RESOLVED
Evidence: `.maestro/sign-in.yaml` now taps each field, runs `waitForAnimationToEnd`, and taps again before `inputText` (commit `c41c8cd harness: make sign-in deterministic with the on-screen keyboard up`; noted in `11a6416`). Original note below.

- `.maestro/sign-in.yaml` (and every flow that includes it: study-grade, learning-requeue-copy, ...) fails intermittently at `visible: "FOUND"`. Two full `harness/qa.sh` runs back to back gave different results (run 2: sign-in, study-grade, learning-requeue-copy FAIL; collection-search-visible, signin-keyboard PASS).
- Screenshot `.maestro/output/sign-in/screenshots/step-015-assertCondition-FOUND.png`: the Email field holds `maestro-qa@tabi.testgQa-5WWRMn55...` and Password is empty, so `tapOn: "Password"` did not move focus and the password was typed into Email. Sign-in screen code (`app/(auth)/sign-in.tsx`, `PasswordField`) is unchanged since the last green run, so this looks like a tap/focus race in the flow, not an app regression.
- I can't edit `.maestro/*.yaml`. Suggested fix: after `tapOn: "Password"`, add an `extendedWaitUntil`/short wait, or give the inputs testIDs and tap those. The agent flow `signin-keyboard.yaml` shows a pattern that passed.
- No feature work done this iteration.

## username-format: database constraint (migration) — OPEN
Checked 2026-11-11: no migration in `supabase/migrations/` (001-044) adds a CHECK on `profiles.username`. `044_username_available.sql` only adds the `username_available(q)` RPC for the sign-up availability check (it does not validate format), and `008_username_unique.sql` only makes names unique. The client rule is still the only enforcement (`lib/username.ts`: `^[a-z0-9_.]{3,20}$`). Still needed: check existing rows for violations, then a migration with the CHECK and the signup-trigger change. Separately, per the owner's notes 044 may not yet be applied to production; I could not check that.

Client now enforces `^[a-z0-9_.]{3,20}$` (lib/username.ts). Please add a migration with the matching
CHECK on `profiles.username` (and the signup trigger), after checking existing rows for violations.
