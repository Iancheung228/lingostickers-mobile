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
| `qa.sh` | you | preflight (Simulator, dev build, Metro serving *this* tree, not stale) → Maestro → short summary + `logs/qa-status.json` |
| `qa-hierarchy.sh` | you | what Maestro can see right now, as matchable labels — instead of guessing selectors |
| `PROMPT.md` | you | the builder's per-iteration instruction |
| `guard.sh` + `settings.json` | you | blocks deploys/pushes/`maestro cloud`, `.env` reads, and edits to everything above and to the approved flows |
| `run-loop.sh` | you | worktree, Metro on :8082, loop, model escalation, regression, tamper check, cost total |
| `../.maestro/*.yaml`, `run.sh`, `seed.mjs` | you | human-approved flows and test tooling |
| `../.maestro/agent/*.yaml` | agents | flows the QA agent writes for new features |

## Before the first run

1. **Commit your work.** The loop branches from your last commit (it runs in
   `../tabi-harness`), so uncommitted fixes — and the approved flows that test
   them — won't be there.
2. A Simulator named **Tabi Harness** with the Tabi Stickers dev build
   installed. The loop runs every flow on it (`MAESTRO_DEVICE`), so yours is
   never touched. Once:
   ```bash
   UDID=$(xcrun simctl create "Tabi Harness" com.apple.CoreSimulator.SimDeviceType.iPhone-18-Pro com.apple.CoreSimulator.SimRuntime.iOS-27-0)
   xcrun simctl boot "$UDID"
   xcrun simctl install "$UDID" "$(xcrun simctl get_app_container booted com.iancheung228.lingostickers app)"
   ```
   Reinstall it the same way after rebuilding the dev client.
3. Backend: either create `.env.staging` (a second Supabase project), or pass
   `ALLOW_PROD_BACKEND=1` to run against production as the QA account only.

## Run

```bash
DRY_RUN=1 ALLOW_PROD_BACKEND=1 harness/run-loop.sh   # set up + QA baseline, no tokens
ALLOW_PROD_BACKEND=1 harness/run-loop.sh 1           # first time: one iteration, watch it
ALLOW_PROD_BACKEND=1 harness/run-loop.sh 6 3         # up to 6 iterations, $3 cap each
```

The loop uses Metro on **:8082**, so your own `npx expo start` on :8081 (and
your phone) keep working, and on its own Simulator, so yours does too.

Review with `cd ../tabi-harness && git log -p harness/drivable`, the QA
screenshots in `.maestro/output/`, `harness-progress.md` (including any app bugs
QA found outside the feature) and `HUMAN_REQUESTS.md`. Merge or cherry-pick
into main yourself.

## What the loop can't verify

The camera and the Vision cutout don't exist on the Simulator; native changes
need a local dev-client rebuild. Both stay with you, on your phone.
