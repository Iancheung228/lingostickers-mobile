
- Simulator software keyboard is off (hardware keyboard connected), so keyboard-occlusion features (collection-search-visible, signin-keyboard) can't be visually verified. Toggle I/O > Keyboard > Connect Hardware Keyboard off (Cmd+Shift+K), then rerun `harness/qa.sh .maestro/agent/signin-keyboard.yaml`.

## learning-requeue-copy (blocked, changes left uncommitted in worktree)
Implemented: "Still learning — one more look" note (StudyCard `stillLearning` prop, set by StudySessionHost for re-shown cards), included in the card's accessibility label; singular "about 1 minute" in HomeHeader. Standalone flow `.maestro/agent/learning-requeue-copy.yaml` PASSES on a fresh seed (qa-tester screenshots 10-12).
Two things I can't fix under the hard rules:
1. `.maestro/study-grade.yaml` (human-approved) asserts `"What did you call this\\?"` on the 2 / 2 card. The spec'd label prefix makes it `Still learning — one more look. What did you call this?`, so the full-match regex fails. Needs `".*What did you call this\\?"`. (Alternative: drop the label prefix, but the feature spec asks for it.)
2. The full `harness/qa.sh` doesn't re-seed between flows, and study-grade consumes the one due card, so the new flow fails when it runs after it. Needs a re-seed per flow, or this flow run first.
After either is fixed, rerun `harness/qa.sh` and commit as "harness: learning-requeue-copy".
