#!/bin/bash
# Runs Maestro flows against the booted Simulator with the QA account.
#   .maestro/run.sh                     # every flow in .maestro/
#   .maestro/run.sh .maestro/sign-in.yaml
# Needs Metro on $METRO_PORT (default 8081; `npm run dev`) and the QA account
# for the backend (create it once with .maestro/create-qa-user.sh).
#   METRO_PORT=8082 .maestro/run.sh     # e.g. the harness loop's own Metro
# Backend: staging (.env, .maestro/qa.env) unless TABI_ENV=production. Metro
# must have been started against the same backend, or sign-in fails.
set -euo pipefail
cd "$(dirname "$0")/.."
export JAVA_HOME="$HOME/.local/jdk-21/Contents/Home"
export PATH="$JAVA_HOME/bin:$HOME/.maestro/bin:$PATH"
. scripts/lib/backend.sh
[ -f "$QA_ENV_FILE" ] || { echo "Missing $QA_ENV_FILE; run TABI_ENV=${TABI_ENV:-staging} .maestro/create-qa-user.sh"; exit 1; }
args=()
while IFS='=' read -r k v; do [ -n "$k" ] && args+=(-e "$k=$v"); done < "$QA_ENV_FILE"
args+=(-e "METRO_PORT=${METRO_PORT:-8081}")
# MAESTRO_DEVICE (a Simulator UDID) pins the run to one device — the harness
# loop has its own, so it never reinstalls the app on yours.
device=()
[ -n "${MAESTRO_DEVICE:-}" ] && device=(--device "$MAESTRO_DEVICE")
# Flows say `appId: ${APP_ID}`. Prefer the "Tabi Dev" build (.dev bundle id);
# the older dev build that shares the store app's id is the fallback.
if [ -z "${APP_ID:-}" ]; then
  for id in com.iancheung228.lingostickers.dev com.iancheung228.lingostickers; do
    xcrun simctl get_app_container "${MAESTRO_DEVICE:-booted}" "$id" >/dev/null 2>&1 && { APP_ID=$id; break; }
  done
fi
[ -n "${APP_ID:-}" ] || { echo "No Tabi dev build installed on the Simulator"; exit 1; }
args+=(-e "APP_ID=$APP_ID")
# Reset the QA account to a known state (one card, due now) before EVERY flow,
# not once per run: a flow that grades the card leaves nothing due for the next.
# Screenshots and logs land in .maestro/output/<flow>/ (gitignored), overwritten per run.
flows=("$@")
[ ${#flows[@]} -eq 0 ] && flows=(.maestro/*.yaml)
code=0
for flow in "${flows[@]}"; do
  node .maestro/seed.mjs
  maestro ${device[@]+"${device[@]}"} test --test-output-dir .maestro/output --debug-output .maestro/output --flatten-debug-output \
    "${args[@]}" "$flow" || code=1
done
exit $code
