#!/bin/bash
# Prints what Maestro can see on the Simulator right now: one line per element,
# as the label a selector must match. Use this instead of guessing selectors.
# Maestro matches text as a FULL-string regex against the accessibility label
# when there is one (on iOS it replaces the children's text).
cd "$(dirname "$0")/.."
export JAVA_HOME="$HOME/.local/jdk-21/Contents/Home"
export PATH="$JAVA_HOME/bin:$HOME/.maestro/bin:$PATH"
mkdir -p harness/logs
device=()
[ -n "${MAESTRO_DEVICE:-}" ] && device=(--device "$MAESTRO_DEVICE")
maestro "${device[@]}" hierarchy 2>/dev/null > harness/logs/hierarchy.json || { echo "maestro hierarchy failed"; exit 1; }
/usr/bin/python3 - <<'EOF'
import json
def walk(n):
    a = n.get("attributes", {})
    label = a.get("accessibilityText") or a.get("text") or ""
    rid = a.get("resource-id") or ""
    if label or rid:
        print(f"{label[:160]!r}" + (f"  id={rid}" if rid else ""))
    for c in n.get("children", []): walk(c)
walk(json.load(open("harness/logs/hierarchy.json")))
EOF
