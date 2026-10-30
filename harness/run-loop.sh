#!/bin/bash
# Runs the harness loop in its own worktree so it never touches your working tree.
#   harness/run-loop.sh [iterations=5] [usd-per-iteration=3]
#   ALLOW_PROD_BACKEND=1 harness/run-loop.sh 3     # no staging yet: use .env (QA account only)
#   DRY_RUN=1 ALLOW_PROD_BACKEND=1 harness/run-loop.sh   # set everything up, run QA, spend nothing
#
# Models, cheapest that can do each job:
#   builder    sonnet  (BUILDER_MODEL)  — writes code; delegates QA
#   qa-tester  haiku   (.claude/agents/qa-tester.md) — runs flows, judges screenshots
#   escalation opus    (ESCALATION_MODEL) — only for a feature that failed 2 iterations running
# Deterministic work (gate, Maestro runs, summaries) is shell, not tokens.
#
# Stops when every feature passes, at the iteration cap, if the agent touches a
# protected file, or after two iterations in a row with no new commit.
set -uo pipefail
REPO=$(cd "$(dirname "$0")/.." && pwd)
WT="$REPO/../tabi-harness"
BRANCH=harness/drivable
ITERS=${1:-5}
BUDGET=${2:-3}
BUILDER_MODEL=${BUILDER_MODEL:-sonnet}
ESCALATION_MODEL=${ESCALATION_MODEL:-opus}
export METRO_PORT=${METRO_PORT:-8082}   # 8081 stays free for your phone session
notify() { osascript -e "display notification \"$1\" with title \"Tabi harness\"" 2>/dev/null; echo ">> $1"; }

# Files that define "done". Byte-identical to the scaffold commit, or the run stops.
PROTECTED=(harness/feature_list.json harness/guard.sh harness/init.sh harness/PROMPT.md
  harness/settings.json harness/qa.sh harness/qa-hierarchy.sh scripts/test-drivable.mts skills.md docs/lessons.md
  .maestro/sign-in.yaml .maestro/study-grade.yaml .maestro/run.sh .maestro/seed.mjs
  .claude/agents/qa-tester.md)

# --- Backend: staging if you have one; production only when you say so --------
if [ -f "$REPO/.env.staging" ]; then
  prod_url=$(grep '^EXPO_PUBLIC_SUPABASE_URL=' "$REPO/.env" | cut -d= -f2-)
  stg_url=$(grep '^EXPO_PUBLIC_SUPABASE_URL=' "$REPO/.env.staging" | cut -d= -f2-)
  [ -n "$stg_url" ] && [ "$stg_url" != "$prod_url" ] || { echo ".env.staging points at production (or is empty). Refusing."; exit 1; }
  ENV_SRC="$REPO/.env.staging"
elif [ "${ALLOW_PROD_BACKEND:-}" = "1" ]; then
  ENV_SRC="$REPO/.env"
  echo "Using the PRODUCTION backend. The app signs in as the QA account only; deploys stay blocked."
else
  echo "No .env.staging. Re-run with ALLOW_PROD_BACKEND=1 to test against production as the QA account."; exit 1
fi
[ -f "$REPO/.maestro/qa.env" ] || { echo "Missing .maestro/qa.env — run .maestro/create-qa-user.sh"; exit 1; }

# --- Worktree -----------------------------------------------------------------
if [ ! -d "$WT" ]; then
  git -C "$REPO" worktree add "$WT" -b "$BRANCH" HEAD || exit 1
  ln -s "$REPO/node_modules" "$WT/node_modules"
  # .gitignore's `node_modules/` doesn't match a symlink; keep it out of commits.
  echo "node_modules" >> "$(git -C "$WT" rev-parse --git-path info/exclude)"
  # The harness is committed, so the scaffold is just a marker: the protected
  # files must stay byte-identical to this commit for the whole run.
  git -C "$WT" commit -q --allow-empty -m "harness: scaffold" || exit 1
fi
cp "$ENV_SRC" "$WT/.env"
cp "$REPO/.maestro/qa.env" "$WT/.maestro/qa.env"
SCAFFOLD=$(git -C "$WT" log --format=%H --grep='^harness: scaffold$' -1)
cd "$WT" || exit 1
mkdir -p harness/logs

# --- Metro, from the worktree, with file watching ON ---------------------------
# (A Metro started with CI set never re-bundles: tests would pass against stale code.)
if ! lsof -nP -iTCP:"$METRO_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  env -u CI nohup npx expo start --dev-client --port "$METRO_PORT" > harness/logs/metro.log 2>&1 &
  for _ in $(seq 60); do curl -sf "http://localhost:$METRO_PORT/status" >/dev/null && break; sleep 1; done
fi
harness/qa.sh .maestro/sign-in.yaml > harness/logs/last-qa.txt; rc=$?
[ $rc -eq 2 ] && { cat harness/logs/last-qa.txt; notify "QA environment not ready; fix it before looping."; exit 1; }
cat harness/logs/last-qa.txt
[ "${DRY_RUN:-}" = "1" ] && { echo "DRY RUN: worktree, backend, Metro :$METRO_PORT and QA all ready. No tokens spent."; exit 0; }

first_failing() {
  node --experimental-strip-types scripts/test-drivable.mts --json 2>/dev/null \
    | /usr/bin/python3 -c 'import json,sys; print(next((k for k,v in json.load(sys.stdin).items() if not v["passes"]), ""))'
}

# --- Loop ---------------------------------------------------------------------
stale=0; last_target=""; attempts=0
for i in $(seq 1 "$ITERS"); do
  target=$(first_failing)
  [ -z "$target" ] && { notify "All features pass."; break; }
  if [ "$target" = "$last_target" ]; then attempts=$((attempts+1)); else attempts=1; last_target=$target; fi
  model=$BUILDER_MODEL; [ $attempts -ge 3 ] && model=$ESCALATION_MODEL
  before=$(git rev-parse HEAD)
  echo "=== iteration $i/$ITERS: $target (attempt $attempts, $model, \$$BUDGET cap) ==="

  HARNESS=1 claude -p "$(cat harness/PROMPT.md)" \
    --model "$model" --settings harness/settings.json \
    --permission-mode auto --permission-prompts none \
    --max-budget-usd "$BUDGET" --output-format stream-json --verbose \
    | tee "harness/logs/iter-$i.ndjson" \
    | /usr/bin/python3 -c '
import json,sys
for line in sys.stdin:
    try: e=json.loads(line)
    except: continue
    if e.get("type")=="assistant":
        for c in e["message"].get("content",[]):
            if c.get("type")=="text": print("  ", c["text"][:300].replace("\n"," "))
            if c.get("type")=="tool_use": print("   ->", c["name"], str(c["input"])[:120])
    if e.get("type")=="result": print("   cost $%.2f, %s" % (e.get("total_cost_usd",0), e.get("subtype")))'

  if ! git diff --quiet "$SCAFFOLD" -- "${PROTECTED[@]}"; then
    notify "Iteration $i modified protected files. Stopped; see git diff $SCAFFOLD."; exit 2
  fi

  if [ "$(git rev-parse HEAD)" = "$before" ]; then stale=$((stale+1)); else stale=0; fi
  [ $stale -ge 2 ] && { notify "Two iterations without a commit. Stopped."; break; }

  harness/init.sh > "harness/logs/gate-$i.txt" 2>&1 || notify "Gate red after iteration $i (next iteration repairs it)."
  # Full regression on the Simulator after every iteration; the next one reads it.
  harness/qa.sh > harness/logs/last-qa.txt 2>&1
  if grep -q "^FAIL" harness/logs/last-qa.txt; then
    { echo "REGRESSION — fix before new work:"; cat harness/logs/last-qa.txt; } > harness/logs/last-qa.tmp
    mv harness/logs/last-qa.tmp harness/logs/last-qa.txt
  fi
  cat harness/logs/last-qa.txt
done

[ -f HUMAN_REQUESTS.md ] && notify "The loop left requests in HUMAN_REQUESTS.md"
total=$(cat harness/logs/iter-*.ndjson 2>/dev/null | /usr/bin/python3 -c 'import json,sys
t=0
for l in sys.stdin:
    try:
        e=json.loads(l)
        if e.get("type")=="result": t+=e.get("total_cost_usd",0)
    except: pass
print("%.2f"%t)')
notify "Done. Spent \$$total. Review: cd $WT && git log $SCAFFOLD..HEAD"
