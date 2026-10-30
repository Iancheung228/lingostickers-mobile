#!/bin/bash
# Runs Maestro flows against the booted Simulator and prints a SHORT summary:
# one line per flow, plus the failing step, its error and the screenshots to
# look at. Deterministic and token-free: models read the summary, never the
# raw Maestro output.
#
#   harness/qa.sh                            # every flow in .maestro/ and .maestro/agent/
#   harness/qa.sh .maestro/agent/tabs.yaml   # one flow
#   METRO_PORT=8082 harness/qa.sh            # against the loop's own Metro
#
# Exit 0 = all passed, 1 = a flow failed, 2 = environment not ready (no test ran).
# Also writes harness/logs/qa-status.json, which scripts/test-drivable.mts reads.
set -uo pipefail
cd "$(dirname "$0")/.."
PORT=${METRO_PORT:-8081}
mkdir -p harness/logs
STATUS=harness/logs/qa-status.json

not_ready() { echo "QA NOT RUN: $1"; echo '{"ready": false}' > "$STATUS"; exit 2; }

# --- Preflight: every check here is a way we have already been fooled ---------
# MAESTRO_DEVICE (set by run-loop.sh) is the loop's own Simulator; unset means
# whichever one is booted.
DEVICE=${MAESTRO_DEVICE:-booted}
if [ "$DEVICE" = booted ]; then
  xcrun simctl list devices booted 2>/dev/null | grep -q Booted || not_ready "no booted Simulator"
else
  xcrun simctl list devices 2>/dev/null | grep "$DEVICE" | grep -q Booted || not_ready "Simulator $DEVICE is not booted"
fi
xcrun simctl get_app_container "$DEVICE" com.iancheung228.lingostickers >/dev/null 2>&1 \
  || not_ready "Tabi Stickers dev build not installed on Simulator $DEVICE"
# A flow-level `env:` default beats `maestro -e`, so a pinned METRO_PORT
# silently sends the app to another Metro's code.
pinned=$(grep -lE '^[[:space:]]+METRO_PORT:' .maestro/*.yaml .maestro/agent/*.yaml 2>/dev/null)
[ -z "$pinned" ] || not_ready "these flows pin METRO_PORT in env:, which overrides :$PORT — remove it: $pinned"
pid=$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | head -1)
[ -n "$pid" ] || not_ready "no Metro on :$PORT"
cwd=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | grep '^n' | cut -c2-)
[ "$cwd" = "$PWD" ] || not_ready "Metro on :$PORT serves $cwd, not this tree ($PWD) — tests would run someone else's code"
# A Metro started with CI set never re-bundles, so it serves stale code forever.
ps eww -p "$pid" 2>/dev/null | grep -qE '(^| )CI=(1|true)( |$)' \
  && not_ready "Metro on :$PORT runs in CI mode (stale bundle). Restart it with: env -u CI npx expo start --dev-client --port $PORT"

# The dev client loads the manifest's launch asset. If that bundle doesn't
# build, the app keeps showing whatever it ran last and every flow tests stale
# code — so build it here, and refuse to test if it fails.
launch=$(curl -sf -H "Accept: application/expo+json,application/json" -H "expo-platform: ios" "http://localhost:$PORT/" \
  | /usr/bin/python3 -c 'import json,sys; print(json.load(sys.stdin)["launchAsset"]["url"])' 2>/dev/null)
[ -n "$launch" ] || not_ready "Metro on :$PORT returned no manifest"
bundle=$(curl -s -o /dev/null -w '%{http_code}' --max-time 300 "$launch")
[ "$bundle" = "200" ] || not_ready "the app bundle from Metro on :$PORT fails to build (HTTP $bundle): $launch"

# --- Run --------------------------------------------------------------------
flows=("$@")
if [ ${#flows[@]} -eq 0 ]; then
  flows=(.maestro/*.yaml)
  [ -d .maestro/agent ] && compgen -G ".maestro/agent/*.yaml" >/dev/null && flows+=(.maestro/agent/*.yaml)
fi
rm -rf .maestro/output
METRO_PORT=$PORT .maestro/run.sh "${flows[@]}" > harness/logs/qa-raw.txt 2>&1
code=$?

# --- Summarise ----------------------------------------------------------------
/usr/bin/python3 - "$STATUS" "${flows[@]}" <<'EOF'
import json, os, sys, glob
status_path, flows = sys.argv[1], sys.argv[2:]
out, any_fail = {"ready": True, "flows": {}}, False
for f in flows:
    name = os.path.splitext(os.path.basename(f))[0]
    d = f".maestro/output/{name}"
    cmds_path = f"{d}/commands.json"
    if not os.path.exists(cmds_path):
        out["flows"][f] = {"passed": False, "error": "did not run (see harness/logs/qa-raw.txt)"}
        any_fail = True
        continue
    cmds = json.load(open(cmds_path))
    failed = [c for c in cmds if c.get("metadata", {}).get("status") == "FAILED"]
    shots = sorted(glob.glob(f"{d}/takeScreenshot/*.png")) + sorted(glob.glob(f"{d}/screenshots/*.png"))
    rec = {"passed": not failed, "screenshots": shots}
    if failed:
        any_fail = True
        c = failed[0]
        rec["failed_step"] = json.dumps(c.get("command"))[:200]
        rec["error"] = ((c.get("metadata", {}).get("error") or {}).get("message") or "")[:300]
    out["flows"][f] = rec
json.dump(out, open(status_path, "w"), indent=2)
for f, r in out["flows"].items():
    print(("PASS  " if r["passed"] else "FAIL  ") + f)
    if not r["passed"]:
        print("      step:  " + r.get("failed_step", "?"))
        print("      error: " + r.get("error", "?"))
        if r.get("screenshots"):
            print("      look:  " + r["screenshots"][-1])
        print("      hint:  dump what Maestro sees with `harness/qa-hierarchy.sh` before changing a selector")
print("QA " + ("FAILED" if any_fail else "PASSED") + f"  (details: {status_path})")
sys.exit(1 if any_fail else 0)
EOF
summary=$?
[ $summary -ne 0 ] || [ $code -eq 0 ] || echo "note: maestro exited $code; see harness/logs/qa-raw.txt"
exit $summary
