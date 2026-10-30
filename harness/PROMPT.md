You are one iteration of an unattended loop on Tabi Stickers (Expo SDK 54, iOS).
Nobody is watching. Do exactly ONE feature, verify it like a user would, then stop.

## 1. Orient (cheap — don't re-read what you don't need)
- `git log --oneline -8`, `harness-progress.md` (if present), `harness/logs/last-qa.txt` (if present).
- `node --experimental-strip-types scripts/test-drivable.mts` — pick the FIRST feature
  marked FAIL, and read only that entry of `harness/feature_list.json`.
- Read skills.md sections that match what you'll touch (hitSlop → #9, sheets → #8/#10,
  cutout → #6). Do not read the whole file.

## 2. Gate before you start
Run `harness/init.sh`. If it is not GATE GREEN, your only job this iteration is to
make it green again. Touch no feature.
If `harness/logs/last-qa.txt` shows a REGRESSION in a flow that used to pass,
fix that first: a broken flow is a broken app.

## 3. Build
Smallest change that satisfies the feature. Match the surrounding code style and
comment density. Do not change visible copy, layout or behaviour unless the feature
says to. TypeScript changes hot-reload on the Simulator; you never need an EAS build.

## 4. Verify like a user — delegate to the `qa-tester` subagent
Do NOT drive Maestro yourself; screenshots are expensive in your context.
Spawn the `qa-tester` subagent (it runs on a cheaper model) with:
- the feature id, its description and `flow_must_show`,
- the flow path to write (`flow` field, under `.maestro/agent/`),
- `METRO_PORT=$METRO_PORT` (the loop's Metro; the value is in your environment).
Ask it to write the flow if missing, run `harness/qa.sh <flow>` and then the full
`harness/qa.sh` (regression), and return its report.
- APP BUG in the report → fix the app, ask qa-tester to rerun. Max 3 rounds.
- FLOW BUG → qa-tester fixes its own flow.
- NOT RUN (environment) → stop, write it to HUMAN_REQUESTS.md.

## 5. Confirm and commit
- `harness/init.sh` must end GATE GREEN and your feature must print PASS
  (it reads the latest QA status, so QA must have run after your last change).
- `git add -A && git commit -m "harness: <feature-id>"`.
- Append 2–4 lines to `harness-progress.md`: what changed, what QA observed
  (flows + screenshots it judged), anything surprising — especially any APP BUG
  found that is outside this feature (don't fix those; list them).

## Hard rules
- Never edit harness/*, scripts/test-*.mts, skills.md, AGENTS.md, .env files,
  the human-approved flows `.maestro/*.yaml`, `.maestro/run.sh`, `.maestro/seed.mjs`.
  If you believe one is wrong, explain why in HUMAN_REQUESTS.md and stop.
- Never run eas, supabase deploy/db/link/secrets, git push, npm run test:live,
  or `maestro cloud`. Put requests for those in HUMAN_REQUESTS.md.
- Native changes (Swift, app.json plugins, new native deps) need a local rebuild
  of the dev client; don't make them — request them in HUMAN_REQUESTS.md.
- "PASS" means a script printed PASS. Never claim a check you did not run.
