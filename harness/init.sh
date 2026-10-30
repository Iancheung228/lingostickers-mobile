#!/bin/bash
# The gate. Cheapest check first; any failure means the tree is not shippable.
# Never runs test:live (it spends real Gemini quota).
set -o pipefail
cd "$(dirname "$0")/.."
step() { printf '\n== %s\n' "$1"; shift; "$@" || { echo "GATE FAILED at: $*"; exit 1; }; }
step "typecheck"           npm run -s typecheck
step "lint"                npm run -s lint
step "unit tests"          npm test --silent
step "edge function types" npm run -s typecheck:functions
echo; echo "== feature status (informational)"
node --experimental-strip-types scripts/test-drivable.mts 2>/dev/null
echo; echo "GATE GREEN"
