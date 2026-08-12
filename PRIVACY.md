# Privacy Policy for Souvenir

**Effective date:** July 26, 2026

Souvenir ("we," "our," "the app") lets you point your camera at real
objects in your daily life to build a personal, photo-based vocabulary
collection. This policy explains what information the app collects, how
it's used, who it's shared with, and how you can delete it.

## Information We Collect

**Account information.** When you create an account, we collect your email
address, a password (stored securely and never visible to us in plain
text), and a username you choose. Your username is visible to other users
of the app so they can find and add you as a friend.

**Photos and stickers.** When you scan an object, we process and store:
- The cropped "sticker" image of the object (background removed).
- The full, uncropped photo of the scene, if you choose to keep one — this
  can later be viewed again from that sticker's detail screen.
- The word, translation, pronunciation guide, an example sentence about the
  scene, and an optional short language-learning note, all generated for
  that object.

**Voice recordings.** If you record yourself practicing a word's
pronunciation, that audio clip is stored so you can play it back later.
This only happens if you actively choose to record — the app never records
audio in the background.

**Location.** If you grant location permission, we store the GPS
coordinates and a general place name (e.g. a neighborhood or city) for
where a sticker was captured, so your collection can be organized by where
things happened. This is entirely optional, and declining it doesn't limit
any other part of the app.

**Personal notes and favorites.** Any notes you write on a sticker, and
whether you've marked it a favorite, are stored with that sticker.

**Friends and challenges.** If you add friends within the app, we store
that connection. You can send a friend a "challenge" based on one of your
stickers — this stores a snapshot of that sticker's word, translation,
reading, sentence, and image at the time you sent it, so the challenge
still works even if you later change or delete the original.

**Push notification tokens.** If you allow notifications, we store a device
token used only to deliver notifications for things like friend requests
and challenges.

## How Your Information Is Used

We use the information above to:
- Operate the core features of the app — generating vocabulary cards,
  organizing your collection by time/place, letting you review and edit
  your stickers.
- Deliver the friends and challenge features you choose to use.
- Send push notifications you've opted into (e.g. "X sent you a
  challenge").
- Maintain and secure your account.

We do not sell your personal information, and we do not use your photos or
sticker content for advertising.

## Sharing With Other Users

Souvenir has social features. Adding someone as a friend lets you send
each other challenges, but does not give them access to your sticker
collection — your notes, voice recordings, memory photos, and location tags
stay private to you.

**Sending a challenge** shares a snapshot of that sticker's word,
translation, reading, sentence, and image with the specific friend you send
it to — this is the only way sticker content becomes visible to another
user.

## Third-Party Service Providers

Souvenir relies on the following outside services to operate. Each
receives only what it needs to perform its specific function:

- **Supabase** — our database, authentication, file storage, and backend
  hosting provider. Supabase stores your account data, stickers, photos,
  and voice recordings.
- **Groq** — an AI inference provider. When you scan an object, the
  cropped photo (and the full scene photo, if you chose to keep one) is
  sent to Groq to identify the object and generate the word, translation,
  and example sentence. Groq also processes text when you manually edit a
  word or sentence.
- **Replicate** — an AI hosting provider used to remove the background from
  your scanned photo so the object becomes a clean sticker cutout. Your
  photo is sent to Replicate for this processing only.
- **remove.bg** — a backup background-removal service, used only if
  Replicate is unavailable or fails.
- **Expo's push notification service** — delivers push notifications (like
  "you have a new challenge") to your device using your push token.

We don't control these providers' own data retention independently of our
use of them, but we only send them the specific content described above,
for the specific purpose described above.

## Data Retention & Deletion

Your data is retained for as long as your account exists. You can
permanently delete your account at any time from Settings → Delete
Account. Doing so:
- Deletes your profile, stickers, friendships, boards, challenges, and push
  tokens.
- Deletes your stored photos and voice recordings from our storage.
- Deletes your authentication record.

This action is immediate and cannot be undone.

## Children's Privacy

Souvenir is not directed at children under 13, and we do not
knowingly collect information from children under 13. If you believe a
child has provided us with personal information, please contact us at the
address below and we will remove it.

## Your Choices

Camera access is required to scan objects — the app's core function.
Photo library, microphone, and location access are all optional and only
requested when you use the specific feature that needs them (importing a
photo, recording your pronunciation, or tagging a location). You can review
or change any of these permissions at any time in your device's Settings.

## Security

We use industry-standard practices to protect your information, including
encrypted connections and per-user access controls so that, outside of the
friend-sharing described above, only you can access your own data.

## Changes to This Policy

We may update this policy as the app changes. If we make material changes,
we'll update the effective date above.

## Contact

Questions about this policy or your data? Contact us at
**privacy@souvenir.app**.
