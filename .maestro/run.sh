#!/bin/bash
# Runs Maestro flows against the booted Simulator with the QA account.
#   .maestro/run.sh                     # every flow in .maestro/
#   .maestro/run.sh .maestro/sign-in.yaml
# Needs Metro on $METRO_PORT (default 8081; `npx expo start --dev-client`) and
# .maestro/qa.env (create it once with .maestro/create-qa-user.sh).
#   METRO_PORT=8082 .maestro/run.sh     # e.g. the harness loop's own Metro
set -euo pipefail
cd "$(dirname "$0")/.."
export JAVA_HOME="$HOME/.local/jdk-21/Contents/Home"
export PATH="$JAVA_HOME/bin:$HOME/.maestro/bin:$PATH"
[ -f .maestro/qa.env ] || { echo "Missing .maestro/qa.env; run .maestro/create-qa-user.sh"; exit 1; }
# Reset the QA account to a known state (one card, due now) before every run.
node .maestro/seed.mjs
args=()
while IFS='=' read -r k v; do [ -n "$k" ] && args+=(-e "$k=$v"); done < .maestro/qa.env
args+=(-e "METRO_PORT=${METRO_PORT:-8081}")
# MAESTRO_DEVICE (a Simulator UDID) pins the run to one device — the harness
# loop has its own, so it never reinstalls the app on yours.
device=()
[ -n "${MAESTRO_DEVICE:-}" ] && device=(--device "$MAESTRO_DEVICE")
# Screenshots and logs land in .maestro/output/ (gitignored), flat, overwritten per run.
exec maestro ${device[@]+"${device[@]}"} test --test-output-dir .maestro/output --debug-output .maestro/output --flatten-debug-output \
  "${args[@]}" "${@:-.maestro/}"
