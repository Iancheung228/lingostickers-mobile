# Tester B findings (Daniel, Anki power user, Collection tab)

### [IDEA] tooling: hier.sh reports the wrong device
- where: explore/hier.sh on ProMax UDID returned the SE (375x667) hierarchy (Friends screen) while the ProMax showed Collection
- evidence: B/s1.png vs hier output. (tooling, not app)

### [VISUAL] Collection top: lopsided/duplicated blocks on large phone
- where: Collection tab, ProMax; "Latest finds" tile + "Latest stickers" card + main list
- what: Latest finds is a single narrow tile pinned left with ~65% empty row; "Latest stickers" lists the same sticker (pomme) that is right below in the main list, so the same card shows 3 times (hero, latest stickers, list). Two stacked blocks before the actual searchable list push the list (and filter chips) below the fold: ~1 screen of scrolling before any filter/sort control. Anki users want the browse list first.
- evidence: B/o1/f1/takeScreenshot/scroll2.png, B/o2/f2/takeScreenshot/a2.png
- idea: collapse hero/latest into one strip, or sticky the filter/search row
### [UX] "Latest first" label looks like a tappable link/header text but meaning unclear; "0 FOUND TODAY" vs "GOAL 5" has no explanation
- evidence: same screenshots
### [VISUAL] Category chip row clipped at right with a half chip ("Study" then cut) and sort/fav buttons overlay it
- evidence: a2.png (chips row y~715)
### [UX] List shows one huge square card per row (~60% of screen height each)
- Anki-style browsing of 100s of cards would need endless scrolling; no compact/list/grid toggle seen.
- evidence: a2.png

(retracted earlier "one huge card per row": grid is 2-col; only 1 sticker existed so it looked huge. But see below.)
### [BUG] Search: tapping the top magnifier opens a search field that is out of sight (below the fold, under keyboard)
- where: Collection header magnifier (top right) 
- what I did → tapped it, keyboard appeared, typed "zzz" → screen stays scrolled at top; the search field (rendered after Hero/Latest finds/Latest stickers, ~1.3 screens down) is covered by the keyboard; no visible input, no results count, no Cancel. Looks like keyboard opened for nothing.
- evidence: B/o3/f3-4/takeScreenshot/search_empty.png; code: app/(tabs)/collection.tsx:~286 (searchBar rendered in list header after LatestStickers)
- idea: scroll list to the search bar on open, or pin the search bar at the top
### [IDEA] Category chips are fixed (Kitchen/Animals/Study…) – not user tags/decks
- code: collection.tsx CATEGORIES; Anki users expect custom tags and decks, tag search, multi-select filter

### [VISUAL] Sticker detail front: photo left-aligned, not filling card; large white void beneath it
- where: Collection > tap sticker (pomme), front face; ProMax
- evidence: B/o5/f5/takeScreenshot/detail.png (image ~75% width glued left, ~400px white gap below, then "What did you call this?")
### [VISUAL] Detail back: huge empty area below "In use"; edit pencil circles look clipped at the right edge
- evidence: B/o5/f5/takeScreenshot/detail2.png
### [UX] Detail flips on a swipe/tap; hint says "Tap to reveal"; no review stats (due date, interval, ease, lapses), no tags/deck, just "Card 9668 · FR / 2 reviews". Anki users want due date, interval, ease, history, tags, "suspend", "reset".

### [VISUAL] Detail front: photo is left-aligned at ~2/3 card width on every sticker (not just the sticker cutout) 
- evidence: B/o9/f9/takeScreenshot/sortmenu.png (flowers photo "petal" card, another tester's), detail.png
### [UX] Header says "DAY 3136" / "30 Friday MAR 2018" for an imported photo: the card's date is the photo's EXIF date, so the day counter/ "found" date is years in the past; confusing vs "found today"
- evidence: same screenshot
### [OK] Edit sheet: "The word" bottom sheet has grabber, scrim tap closes when unchanged, Cancel/Save, good helper copy ("Change it and how it's said and what it means follow"). evidence B/o6/f6/takeScreenshot/editword.png, B/o7
### [IDEA] I did not reach typed-word card creation: Scan tab shows a consent gate ("One quick thing") and I did not accept it on the shared account.

### [VISUAL] Meaning capitalisation inconsistent: grid shows "Apple", "Petal", "A Plant", "The Flower" (title-cased), detail shows "apple" lowercase; Latest stickers list shows lowercase "petal", "a plant", "The flower".
- evidence: B/o10/f10/takeScreenshot/list.png vs detail2.png
### [UX] Card dates mix: pomme "18h ago", others "30 Mar" (photo EXIF date, 2018) though added today -> "Latest first" ordering unclear which date it uses
- evidence: list.png
### [VISUAL] Full photo cards vs cut-out stickers have very different weight in the grid (rectangular photo thumbs w/ white gap beneath vs die-cut stickers)

### [UX] Sort options are only Latest first / Oldest first / Recently added; "Latest first" vs "Recently added" is not distinguishable (photo date vs add date?). No A-Z, by due date, by difficulty/lapses, by language, by part of speech. Sort is a 3-way cycle on single tap with no visible current mode other than a tint.
- evidence: B/o11/f11/takeScreenshot/sortmenu.png
### [OK] Long-press on sort opens a clear "Sort by" dialog with a check, dims background.

### [UX] Favourites-only with zero favourites says "No stickers yet" (title) – wrong/alarming when you own cards; the subtitle is right ("Tap the heart..."). Title should be "No favourites yet".
- evidence: B/o12/f12/takeScreenshot/kitchenfav.png; code collection.tsx ListEmptyComponent title has no favoritesOnly branch
### [UX] While the favourites filter is on, "Latest finds" and "Latest stickers" still show everything above the empty state; filters only affect the grid at the bottom, so it looks like the filter did nothing.
### [VISUAL] "Latest stickers" is a nested scroll box: inside it rows are clipped at the top edge mid-row (pomme cut in half) after scrolling the page
- evidence: kitchenfav.png (y~770)

### [VISUAL] A category filter with a single match renders the lone card full-width (huge, ~1 screen tall) instead of half-width like in the 2-col grid.
- evidence: B/o13/f13/takeScreenshot/kitchen.png (Kitchen -> only pomme, giant)
### [UX] Categories (Kitchen/Animals/Study...) are auto-assigned; detail view shows no category and there is no way to change it, add tags, or create decks. Kitchen filter matched "apple" only.

### [OK] Delete: trash in detail opens a native confirm "Delete card - Remove "un pétale" from your collection? The cutout, photo and any recording go with it." with Cancel / red Delete. Clear and safe (I cancelled; did not delete). evidence B/o14/f14/takeScreenshot/del.png
### [UX] Delete has no undo afterwards (confirm is the only guard); trash sits beside share/download with equal weight top-right.
### [IDEA] Anki-power-user gaps: no bulk select, no export (CSV/deck), no tags/decks, no per-card scheduling info (due/interval/ease), no table browser, no sort by due. Grep of collection.tsx found no multi-select/bulk/export code (code-only).
## Positive
- Edit sheet (grabber, scrim, Cancel/Save, helper copy); sort long-press dialog; delete confirm copy; detail back face lays out word/say it/means/in use clearly with per-field edit pencils; recording + play controls.
## Not covered
- Typed-word card creation (consent gate on Scan; didn't accept on shared account), editing/saving changes, discard-draft prompt, sentence editing, search results (search field hidden, see BUG), Arrange mode.
- Tooling: hier.sh returned another simulator's hierarchy; flows need whole-number % points.
