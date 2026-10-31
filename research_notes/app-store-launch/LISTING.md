# Tabi Stickers — App Store listing and submission pack (v1.0)

Drafted 2026-10-31. Everything here is entered by hand in App Store Connect
(ASC) → Tabi Stickers → the 1.0 version page, unless marked otherwise.
Character limits were checked by script. Claims are limited to what v1
actually does: Friends and challenges are off for v1, so they are not mentioned.

## 1. Store text

| Field | Limit | Text |
|---|---|---|
| Name | 30 | Tabi Stickers *(already set on the ASC record)* |
| Subtitle | 30 | Flashcards from your photos *(27)* |
| Promotional text | 170 | Point your camera at anything and get a flashcard: the word, how to say it and a real sentence. Then review it right when it's about to slip. French, Japanese, Cantonese. *(170)* |
| Keywords | 100 | french,japanese,cantonese,vocabulary,spaced repetition,srs,flashcard,language,learn,idioms,verbs *(96)* |
| Primary category | — | Education |
| Secondary category | — | Reference |
| Support URL | — | https://tabistickers.com *(its page already shows a mailto link to your Gmail)* |
| Marketing URL | — | https://tabistickers.com *(optional)* |
| Privacy Policy URL | — | https://tabistickers.com/privacy.html |
| Copyright | — | 2026 Ian Cheung |

Keyword notes: words already in the name or subtitle (tabi, stickers,
flashcards, photos) count anyway and are left out. Competitor names (Anki,
Duolingo) are deliberately absent: putting another app's name in keywords is a
Guideline 2.3.7 rejection.

### Description (≈1,600 of 4,000)

```
Learn the words for the world around you.

Point your camera at a mug, a street sign or a bowl of ramen, and Tabi Stickers turns it into a flashcard: the word in French, Japanese or Cantonese, how to say it, and a natural example sentence with a word-by-word breakdown. The object becomes a sticker you can collect.

ONE PHOTO, MANY WORDS
Ask the same photo different questions. What's happening? gives you verbs. What's it like? gives you adjectives. Say it like a local gives you idioms and set phrases. Pick the ones you want and they all become cards.

ANY WORD, NOT JUST WHAT YOU PHOTOGRAPH
Type a word or phrase you met today and get the same complete card.

REVIEWS THAT STICK
Cards come back on a spaced-repetition schedule, just before you'd forget them. Grade each one Again, Hard, Good or Easy, and see exactly when it will return. New words go through short learning steps the same day, so they settle before they're scheduled days out.

HEAR IT AND SAY IT
Play the pronunciation, and record yourself to compare.

YOUR COLLECTION
Browse every card with search, categories and favourites. See what you found and reviewed on the calendar. Arrange stickers on boards, and save any sticker to Photos or share it.

PRIVATE BY DEFAULT
Cutouts are made on your iPhone when it can. Before your first scan, the app tells you exactly which services read your photo and asks for your OK. Location is never collected unless you add it to a sticker yourself. You can delete your account and everything in it from Profile.

Languages: French, Japanese and Cantonese, learned from English.
```

*(Check before pasting: "Type a word" and the scene prompts must be in the
build you submit. The type-a-word entry was added by the build loop on
2026-10-31; if that branch isn't merged, cut that paragraph.)*

### What's New (first version)

```
First release. Photograph anything to learn its word, ask one photo for verbs, adjectives and idioms, and review on a spaced-repetition schedule.
```

## 2. App Review information

**Sign-in required → yes. Demo account:** create a dedicated reviewer account
(not the Maestro QA account, which `seed.mjs` wipes before every test run).
Suggested: `appreview@tabistickers.com`, confirmed, target language French,
pre-loaded with ~8 real stickers (real photos, not the Expo placeholder) and
1–2 cards due, so the reviewer sees a populated app and a review session.
*Creating it writes to production — ask before running.*

**Notes for the reviewer** (paste into "Notes"):

```
Tabi Stickers turns a photo of an object into a vocabulary flashcard and schedules reviews.

Demo account: appreview@tabistickers.com / <password>. It already has stickers and cards due, so you can try a review from the Collection tab (tap the "due" pill at the top).

To make a new card: Scan tab (centre). Before the first scan the app shows a one-time screen naming the third-party AI services that process the photo (Google Gemini; Replicate and remove.bg only if on-device cutout fails) and asks for explicit consent (Guideline 5.1.2(i)). Choosing a photo with "Gallery" works without a camera.

Account deletion: Profile (gear icon) → Delete Account.
There are no in-app purchases, ads or tracking. Social features are not enabled in this version.
```

**Contact information:** your name, phone and email (ASC requires a phone
number here; it is not shown publicly).

## 3. App Privacy (ASC → App Privacy)

Updated from the Aug/Sep answer key. **Two additions** — the app stores both,
and the old key had neither:

| Data type | Collected | Linked to user | Tracking | Purpose |
|---|---|---|---|---|
| Contact Info → Email Address | Yes | Yes | No | App Functionality |
| User Content → Photos or Videos | Yes | Yes | No | App Functionality |
| **User Content → Audio Data** *(new: pronunciation recordings, stored as voice notes)* | Yes | Yes | No | App Functionality |
| **User Content → Other User Content** *(new: card notes and edits the user types)* | Yes | Yes | No | App Functionality |
| Location → Precise Location *(optional, per sticker)* | Yes | Yes | No | App Functionality |
| Identifiers → User ID | Yes | Yes | No | App Functionality |
| Identifiers → Device ID *(Expo push token)* | Yes | Yes | No | App Functionality |
| Usage Data → Product Interaction *(Aptabase)* | Yes | **No** | No | Analytics |

Everything else: Not Collected. "Used to track you across apps/companies": **No**.

Device ID: with Friends off, v1 never asks for notifications, so in practice no
push token is stored. Declaring it anyway keeps the label true for the update
that turns Friends back on and matches the privacy policy; over-declaring is
not a rejection reason, under-declaring is.

## 4. Age rating

Answer **None / No** to every content question (violence, sexual content,
profanity, drugs, gambling, horror, medical, etc.). Capabilities: no
unrestricted web access, **no user-generated content shared with others (Friends
is off)**, no messaging/chat, no advertising. Expected result: **4+**.
Re-answer when Friends is enabled: user-to-user content changes the rating
questions and brings Guideline 1.2 into scope.

## 5. Screenshots

Required: **6.9" display, 1320 × 2868 portrait** (ASC scales them for smaller
iPhones). The iPhone 18 Pro Simulator captures at exactly 1320 × 2868, so no
device is needed. iPad: none needed (`supportsTablet: false`).

Take them **after** the icon is in and the build loop's fixes are merged, on the
demo account (real stickers, no placeholder images). 3 minimum, 5–6 planned:

1. A scan result: the cutout sticker with its word, reading and sentence
2. Scene prompts: one photo, with verbs/adjectives/idioms picked
3. Review: card back with the four grade buttons and their intervals
4. Collection: the grid full of stickers
5. Calendar: a month with finds and reviews
6. (optional) Type a word → card preview

Caption text, if you want overlay captions, comes later. Plain screenshots are
accepted.

## 6. Before you submit — checklist

Items marked **you** need you; the rest can be done in a session.

- [ ] **you** App icon: 1024 × 1024 PNG, no transparency, no rounded corners (iOS rounds it). Replace `assets/icon.png` + the splash.
- [ ] Build-loop fixes merged into `main` (harness/drivable), plus the 4 proposed features in `research_notes/ux-polish-2026-10/proposed-features.json` — including `hide-social-v1`, which this listing assumes.
- [x] Migration 044 (`username_available`) applied 2026-10-31; verified as anon (`maestro_qa` → false, unused name → true, `profiles` still `[]`). The app only benefits once the `username-availability-rpc` feature lands.
- [x] Support contact: Gmail, decided 2026-10-31. tabistickers.com and the privacy page already link `iancheung228@gmail.com`, which satisfies the Support URL requirement; Profile → Report a problem uses the same address.
- [x] Demo account created 2026-10-31 (`appreview@tabistickers.com`, username `tabi_demo`, French; password in `.maestro/demo.env`) and populated with 7 cards from the CC0 photos in `demo-photos.md` (croissant ×2, théière, pomme, chat, vélo, tasse). New cards are due the next day, so a reviewer will have reviews waiting.
- [ ] **Scan reliability:** while populating, 2 of 9 scans failed with "We couldn't read that photo just now" (an `unavailable`/`timeout`/`empty` LlmError after retries and failover); both succeeded on a plain retry. Check the `create-sticker` logs in the Supabase dashboard for which kind it was before launch: a reviewer whose first scan fails may reject for 2.1 (app completeness).
- [ ] Preview build (1 EAS credit) → your device run of the 21-step script → fix anything found.
- [ ] Screenshots captured (§5).
- [ ] Production build (1 EAS credit) → `eas submit` → TestFlight smoke test on your phone.
- [ ] **you** ASC: paste §1–§4, upload screenshots, Pricing → Free, availability, then Submit for Review.
- [ ] Gemini prepay balance: turn on auto-reload (a $0 balance stops every scan app-wide).
