
## collection-search-visible
- collection.tsx: while searching, the search bar is pinned above the list (testIDs collection-search-input/-cancel) and hero / Latest finds / Latest stickers are hidden; Cancel restores them.
- QA: .maestro/agent/collection-search-visible.yaml PASS, full harness/qa.sh PASS. Screenshot 01 shows field with "pom", Cancel, "1 result", pomme card on screen; hero/Latest hidden.
- GAP: no software keyboard appeared in the screenshot (Simulator likely has hardware keyboard connected), so "above the keyboard" is only true structurally (bar is at top), not proven visually. Human: enable I/O > Keyboard > toggle Software Keyboard (Cmd+K) to confirm.
