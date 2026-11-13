# Tabi harness — build with one agent, QA with another

Each iteration: a fresh builder session picks the first failing feature, writes
the code, hands verification to a cheaper QA agent that drives the real app on
the iOS Simulator with Maestro, fixes what QA finds, and commits. After every
iteration the loop re-runs the full Maestro suite as a regression check.
"Done" is decided by scripts, never by the agent's own say-so.

## Who does what (and on which model)

| Role | Model | Why that one |
|---|---|---|
| Gate, Maestro runs, summaries (`init.sh`, `qa.sh`) | none — shell | Deterministic work costs zero tokens; models read a ~5-line summary |
| Builder (`PROMPT.md`) | Sonnet (`BUILDER_MODEL`) | Writes code and reasons about the codebase |
| QA tester (`.claude/agents/qa-tester.md`) | Haiku | Runs flows, reads 1–2 screenshots, writes YAML: cheap vision work kept out of the builder's context |
| Escalation | Opus (`ESCALATION_MODEL`) | Only on the 3rd attempt at a feature that failed twice running |

## Files

| File | Owner | Role |
|---|---|---|
| `feature_list.json` | you | what to build; each UI feature names the Maestro flow that proves it |
| `../scripts/test-drivable.mts` | you | PASS only when static checks pass AND the feature's flow passed on the Simulator |
| `init.sh` | you | the gate: typecheck → lint → tests → deno check |
| `qa.sh` | you | preflight (Simulator, dev build, Metro serving *this* tree, not in CI mode, bundle builds, no flow pins `METRO_PORT` in `env:`) → Maestro → short summary + `logs/qa-status.json`. Exit 0 pass, 1 flow failed, 2 environment not ready |
| `qa-hierarchy.sh` | you | what Maestro can see right now, as matchable labels — instead of guessing selectors |
| `PROMPT.md` | you | the builder's per-iteration instruction |
| `guard.sh` + `settings.json` | you | blocks deploys/pushes/`maestro cloud`, `.env` reads, and edits to everything above and to the approved flows |
| `run-loop.sh` | you | worktree, Metro on :8082, loop, model escalation, regression, tamper check, cost total |
| `../.maestro/*.yaml`, `run.sh`, `seed.mjs`, `fixtures/` | you | human-approved flows and test tooling |
| `../.maestro/qa.env`, `qa.production.env`, `create-qa-user.sh` | you | QA account credentials per backend (gitignored; the loop copies the right one into the worktree as `qa.env`) and the script that creates the account |
| `../scripts/lib/backend.sh` | you | which backend (staging unless `TABI_ENV=production`); refuses a `.env` that points at production |
| `../scripts/qa-budget.mjs` | you | how many AI calls the QA account has left today on that backend (cap: 100 per UTC day); builders check it before any scan or lookup flow |
| `../.maestro/agent/*.yaml` | agents | flows the QA agent writes for new features |

## Before the first run

1. **Commit your work.** The loop branches from your last commit (it runs in
   `../tabi-harness`), so uncommitted fixes — and the approved flows that test
   them — won't be there.
2. A Simulator named **Tabi Harness** with the **Tabi Dev** build installed.
   The loop runs every flow on it (`MAESTRO_DEVICE`), so yours is never
   touched. Build Tabi Dev for the Simulator locally (free, no EAS credit, no
   signing; `EXPO_SCENE_LIFECYCLE=1` is needed under Maestro on iOS 27):
   ```bash
   APP_VARIANT=development EXPO_SCENE_LIFECYCLE=1 npx expo prebuild --clean --platform ios
   xcodebuild -workspace ios/TabiDev.xcworkspace -scheme TabiDev -configuration Debug \
     -sdk iphonesimulator -derivedDataPath ios/build build
   APP=ios/build/Build/Products/Debug-iphonesimulator/TabiDev.app
   ```
   Then, once:
   ```bash
   UDID=$(xcrun simctl create "Tabi Harness" com.apple.CoreSimulator.SimDeviceType.iPhone-18-Pro com.apple.CoreSimulator.SimRuntime.iOS-27-0)
   xcrun simctl boot "$UDID"
   xcrun simctl install "$UDID" "$APP"
   # The old dev build shared the store app's bundle id and the same
   # exp+lingostickers-mobile:// link; keep only one dev build per Simulator.
   xcrun simctl uninstall "$UDID" com.iancheung228.lingostickers
   # Show the on-screen keyboard even after a hardware one was seen, so
   # keyboard-occlusion features can be tested; reboot once to apply.
   xcrun simctl spawn "$UDID" defaults write com.apple.keyboard.preferences AutomaticMinimizationEnabled -bool false
   xcrun simctl shutdown "$UDID" && xcrun simctl boot "$UDID"
   ```
   Reinstall it the same way after rebuilding the dev client.
3. Backend: **staging** (`.env` + `.maestro/qa.env`), always, unless you pass
   `ALLOW_PROD_BACKEND=1` (production, as the QA account only). Flows say
   `appId: ${APP_ID}`; `.maestro/run.sh` sets it to whichever dev build is
   installed (Tabi Dev preferred).

## Run

```bash
DRY_RUN=1 harness/run-loop.sh   # set up + one sign-in flow, no tokens (a real run starts with the full suite)
harness/run-loop.sh 1           # first time: one iteration, watch it
harness/run-loop.sh 6 3         # up to 6 iterations, $3 cap each
```

The loop uses Metro on **:8082** (`METRO_PORT`; started from the worktree if nothing is listening there), so your own `npx expo start` on :8081 (and
your phone) keep working, and on its own Simulator, so yours does too.

The worktree and branch (`../tabi-harness`, `harness/drivable`) are created once and then reused: later runs do not pick up new commits from main, and the protected files stay as they were at the `harness: scaffold` commit. To start over, remove the worktree (`git worktree remove --force ../tabi-harness && git branch -D harness/drivable`). The existing worktree predates staging and Tabi Dev (Nov 12, 2026); its own scripts still work against staging with the old dev build, but recreate it (after merging or saving its commits) to pick up `${APP_ID}` and `scripts/lib/`.

Review with `cd ../tabi-harness && git log -p harness/drivable`, the QA
screenshots in `.maestro/output/`, `harness-progress.md` (including any app bugs
QA found outside the feature) and `HUMAN_REQUESTS.md`. Merge or cherry-pick
into main yourself.

## When it stops

All features pass; the iteration cap; a protected file changed (the list is `PROTECTED` in `run-loop.sh`); two
iterations with no new *passing feature* (commits don't count — a blocked
builder commits notes); a human-approved flow failing the regression (no
builder may fix it); or an iteration that made no progress and added to
`HUMAN_REQUESTS.md`. Every iteration header in the log carries the time and
the passing count, so a stall is visible at a glance.

## Changing the harness or an approved flow

Run the full `harness/qa.sh` **twice** on the harness Simulator before
restarting the loop. One green run can't show a flaky flow, and a flaky
approved flow makes every iteration fail in a way no builder may fix.

## What the loop can't verify

The camera and the Vision cutout don't exist on the Simulator; native changes
need a local dev-client rebuild. Both stay with you, on your phone.
