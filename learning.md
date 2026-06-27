# Learning notes

Three bugs we hit this session, explained plainly. Each one teaches a
fundamental idea that will come up again in other apps, not just this one.

---

## Part 1: The image bug — how file storage permissions work

### What a "bucket" and a "file" are

Supabase Storage is basically a file server bolted onto a database. You
create a **bucket** (think: a top-level folder, like `sticker-images`), and
inside it you upload files at paths like `some-user-id/photo.jpg`. The
important detail: behind the scenes, every file's info (its path, who
uploaded it, etc.) is actually stored as a row in a database table. Because
it's a real database row, the database can apply rules to it — the same
kind of rules it applies to any other row in any other table.

### The rule that's checked on every file request

The rule for this app's files says, roughly: *"You may only see a file if
the first part of its path matches your own account ID."* Since every photo
gets saved at `{yourUserId}/{filename}`, this is a simple way to say
"everyone can only see their own stuff." This is the normal, recommended way
to keep private files private — nothing unusual about it.

The important part: this rule is checked **every single time** anyone asks
for a file, including when the app generates a temporary download link.

### Why this broke the challenge feature

When you send a friend a challenge, behind the scenes we save the path to
*your* photo on the challenge record — something like `your-id/photo.jpg`.

Now your friend opens the challenge. The app asks: "give me a link to view
this photo." But that request is made *as your friend*, not as you. The
database checks the rule: does your friend's ID match `your-id`? No. So the
database says "this file doesn't exist for you" — not an error, just
nothing. The app waits for a photo URL that never arrives, and just shows an
empty box (or, in one spot, a loading spinner that never stops, because
nothing ever told it to stop).

This is exactly why the sticker your friend *won* also wouldn't load — the
new sticker we gave them still pointed at a photo saved under *your* folder,
which they were never allowed to open.

### What a "temporary link" actually is

Think of it like asking the front desk for a hotel room key: you don't get
to walk in and grab one yourself, you have to ask, and the front desk checks
whether you're allowed before handing you a key — even if that key only
works for the next hour. Asking for a temporary download link is the same
"are you allowed?" check as opening the file directly. Getting a temporary
link doesn't skip the permission check — it just gives you a short-lived key
*if* the check passes.

### Two ways to fix a permission rule like this

1. **Loosen the rule** — "you can see it if it's yours, OR if it belongs to
   an accepted friend." Works, but now every friend can permanently see every
   one of your photos, which is a much bigger thing to have decided on
   purpose.
2. **Use a special "ignore the rules" key, but only on the server** —
   Supabase gives a backend-only key that skips all these checks entirely.
   It's meant to be used by trusted code that runs on a server (never sent
   to a phone or browser), specifically so that *your own backend* can do
   things a regular user request can't.

We used the second approach, in two ways:
- For the sticker your friend actually **wins**: the server makes an actual
  **copy** of the photo and puts the copy in *your friend's own* folder. Now
  your friend genuinely owns a copy of it, and the normal "you can see your
  own stuff" rule works for it forever, no special-casing needed again.
- For just **viewing** the challenge before winning it (no ownership change
  needed): a small piece of server code checks, in plain code, "is this
  person actually the sender or the receiver of this specific challenge?"
  — and if yes, it uses the special backend key to hand back a temporary
  link, just this once, for just this file.

The general lesson: any time one person's data needs to become visible to
or owned by someone else, that's worth stopping and deciding deliberately
*which* of these two things you mean — a permanent copy, or a one-time
peek — rather than just trying the obvious client-side code and being
confused when it silently does nothing.

---

## Part 2: The badge bug — where app state actually lives

### A "hook" is just a function — and functions don't share their memory

In this app, a few small functions (`useFriends`, `useChallenges`) are
responsible for fetching and remembering things like "your list of friends"
or "your challenge inbox." The easy-to-miss detail: if you call one of these
functions from *two different screens*, each screen gets its **own private
copy** of that memory. It's not like a shared notebook everyone writes in —
it's more like everyone getting handed their own personal notepad with the
same starting notes copied onto it. They look identical on day one, but if
one person crosses something out on their notepad, the other person's
notepad doesn't change.

### What actually happened

- The little number badge on the "Friends" tab and the actual Friends screen
  both separately asked "how many things are waiting for me?" when the app
  started.
- When you opened and resolved a challenge on the Friends screen, that
  screen updated *its own* notepad correctly.
- But the tab bar's badge was reading from *its own separate* notepad, which
  nobody ever told about the update. So it kept showing the old number.

This is the same underlying mistake that caused the earlier password-reset
bug too — a screen updated its own private memory, while a different part
of the app (deciding where to send you next) was checking a totally separate
private memory that never got the news.

### The fix: one shared notebook instead of many personal notepads

There's a standard tool for exactly this situation: instead of every screen
asking the same question and keeping its own answer, you ask the question
**once**, store the answer in **one place**, and every screen just looks at
that same shared answer. When anything updates it, everyone looking at it
sees the update immediately — automatically, with no extra plumbing to wire
up.

We changed the friends list and challenge inbox to work this way: one shared
notebook, created once near the very top of the app, that every screen reads
from instead of each keeping its own. Now resolving a challenge on the
Friends screen and the tab bar's badge are reading the exact same notebook —
so the badge updates the instant the underlying answer changes, not just
whenever that screen happens to ask again.

### A bonus bug this explained

There was a "Challenge" button on a sticker's detail screen that quietly
never worked — it always thought you had zero friends. It turned out nobody
had ever actually told that screen who the logged-in user was; it was always
asking its private notepad "what are MY friends" without ever filling in
"who is 'me'?" Once everything shares one notebook that already knows who's
logged in, there was no longer a blank to forget to fill in — the mistake
became impossible to make again, instead of just being patched in that one
spot.

**The general lesson:** any time two different parts of the screen need to
*agree* on something (are we logged in? how many things are pending?), give
them one shared place to read that answer from. If each part is independently
asking and remembering its own answer, they will eventually disagree, and
whichever one isn't currently visible on screen will be the one that's wrong.

---

## Part 3: The confusing error message — what the app says vs. what actually went wrong

### What happened

You tried to send the same challenge a second time and got a message that
basically just said "something went wrong" with a cryptic technical-sounding
phrase — even though, behind the scenes, the server had actually sent back
a perfectly clear reason: "you already sent this challenge, wait for your
friend to finish it."

### Why the clear reason never made it to the screen

When the app talks to the server, there are really two layers of
information coming back:
1. **Did the request succeed or fail, in general?** (a yes/no, basically)
2. **If it failed, why specifically?** (the actual sentence the server
   wrote, explaining the reason)

The tool the app uses to talk to the server, by default, only really hands
you layer 1 — "it failed" — in a generic, one-size-fits-all sentence. Layer
2, the actual specific reason, is technically still there, but you have to
deliberately go dig it out; it's not handed to you automatically.

Because nobody had written the code to go dig out that second layer, the app
showed you the generic "it failed" sentence instead of the real reason the
server had already written out for you.

### The fix

We added one small piece of code whose entire job is: "if a request failed,
go look for the actual reason the server gave, and use that instead of the
generic message." Now anywhere in the app that shows an error after talking
to the server, it shows the real, specific reason — not the generic one.

**The general lesson:** when something fails after talking to a server,
there's almost always a more specific reason available than the first
error message you see — it's just sometimes one extra step away from where
you're looking. It's worth checking, the first time you build this kind of
feature, whether you're showing the generic "it failed" message or the
actual reason — and fixing it once, in the one place all those requests go
through, rather than discovering the same disappointing message repeatedly
in different screens.
