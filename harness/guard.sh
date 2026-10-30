#!/bin/bash
# PreToolUse hook for the harness loop. Exit 2 = block, and stderr goes back to the agent.
# Catches outward-facing commands (including inside sh -c / pipes) and writes to
# the files that define "done". run-loop.sh also diffs these after every
# iteration, because a hook on Bash can never see every way to write a file.
input=$(cat)
tool=$(echo "$input" | /usr/bin/python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_name",""))')
payload=$(echo "$input" | /usr/bin/python3 -c 'import json,sys; d=json.load(sys.stdin).get("tool_input",{}); print(d.get("command") or d.get("file_path") or d.get("notebook_path") or "")')

# Human-owned: the definition of done, the tests, the lessons, the secrets, and
# the human-approved Maestro flows + tooling. Agents may add flows under
# .maestro/agent/ only.
PROTECTED='harness/|scripts/test-|skills\.md|docs/lessons\.md|AGENTS\.md|CLAUDE\.md|\.env|\.claude/agents/|\.maestro/[^/]+\.(yaml|sh|mjs)$|\.maestro/[^/]+\.(yaml|sh|mjs)[ "]|\.maestro/qa\.env|\.maestro/fixtures/'

case "$tool" in
  Bash)
    if echo "$payload" | grep -Eq '(^|[^a-z-])(eas|eas-cli)( |$)|supabase +(db|functions|link|secrets|projects)|git +push|git +reset +--hard|rm +-rf +/|xcrun +altool|fastlane|maestro +cloud'; then
      echo "Blocked by harness guard: outward-facing or destructive command. Write the request to HUMAN_REQUESTS.md instead." >&2; exit 2
    fi
    if echo "$payload" | grep -Eq "(>|\\btee\\b|\\bsed +-i|\\bmv\\b|\\bcp\\b|\\brm\\b)[^|;&]*($PROTECTED)"; then
      echo "Blocked by harness guard: that path is owned by the human (feature list, tests, lessons, env)." >&2; exit 2
    fi
    if echo "$payload" | grep -Eq '(cat|less|head|tail|grep|source|\.)[^|;&]*\.env'; then
      echo "Blocked by harness guard: env files are off limits." >&2; exit 2
    fi ;;
  Edit|Write|MultiEdit|NotebookEdit)
    if echo "$payload" | grep -Eq "($PROTECTED)"; then
      echo "Blocked by harness guard: $payload is owned by the human. If you think it is wrong, say so in HUMAN_REQUESTS.md." >&2; exit 2
    fi ;;
  Read)
    if echo "$payload" | grep -Eq '/\.env'; then
      echo "Blocked by harness guard: env files are off limits." >&2; exit 2
    fi ;;
esac
exit 0
