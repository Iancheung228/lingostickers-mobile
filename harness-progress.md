
## collection-search-visible
- collection.tsx: while searching, the search bar is pinned above the list (testIDs collection-search-input/-cancel) and hero / Latest finds / Latest stickers are hidden; Cancel restores them.
- QA: .maestro/agent/collection-search-visible.yaml PASS, full harness/qa.sh PASS. Screenshot 01 shows field with "pom", Cancel, "1 result", pomme card on screen; hero/Latest hidden.
- GAP: no software keyboard appeared in the screenshot (Simulator likely has hardware keyboard connected), so "above the keyboard" is only true structurally (bar is at top), not proven visually. Human: enable I/O > Keyboard > toggle Software Keyboard (Cmd+K) to confirm.

## signin-keyboard
- No app change: sign-in.tsx already had keyboardShouldPersistTaps="handled" in KeyboardAvoidingView. Added .maestro/agent/signin-keyboard.yaml (wrong password -> banner -> real password -> FOUND).
- QA: new flow PASS, full harness/qa.sh PASS. Shots 01-03 show Sign In visible with and without the error banner.
- GAP: no software keyboard was drawn (hardware keyboard connected), so "above the keyboard" is NOT proven; assertVisible doesn't check occlusion. Human: Simulator I/O > Keyboard > uncheck Connect Hardware Keyboard, rerun the flow, check shots 01-03.

## collection-search-visible (re-verify)
- No app change; code was already in place. QA status had gone stale, so reran: flow PASS, full harness/qa.sh PASS (5 flows). Shots 01 (search bar pinned, hero/Latest hidden) and 02 (Cancel restores) judged OK. No new bugs.
