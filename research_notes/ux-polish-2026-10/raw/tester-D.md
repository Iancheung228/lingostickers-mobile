# UX tester D findings (Priya, small iPhone, social/profile/signed-out)
Sim note: device "Tabi QA SE" reports a 375x667 pt screen but the screenshot shows no home button; layout OK-sized as small.
D=/private/tmp/claude-502/-Users-school-lingostickers-mobile-lingostickers-mobile/b094f4e6-324a-42a6-a567-2e0df1438a28/scratchpad/explore/D

### [VISUAL] "Find a friend" CTA label is dark-on-terracotta, near-unreadable
- where: Friends tab empty state, components/FriendsEmpty.tsx
- saw: button text+icon (colors.inkDark) on colors.terra looks dim/muddy; reads like a disabled button. Primary CTA of the whole tab.
- evidence: $D/fr1.png ; code: components/FriendsEmpty.tsx:36,68
- idea: white/cream label like the other primary buttons.

### [VISUAL] Profile header right side has an empty white circle that looks like a button
- where: My Profile top-right
- saw: blank white round "button" mirrors the back button; tapping does nothing (it's a spacer View styled backBtn).
- evidence: $D/pr1.png ; code: app/profile.tsx:190
- idea: remove the background on the spacer or put a real action (e.g. share/edit) there.

### [UX] No app version / build number, no Terms of Service link anywhere in Profile
- where: Profile > ABOUT (Scanner, Privacy Policy only)
- saw: a sceptical user can't tell which version, and there is no Terms/EULA, licences, or data-export/"download my data" next to Delete Account.
- evidence: $D/pr2.png
- idea: add "Version 1.0 (build)" row, Terms link, and "Export my data".

### [UX] Log Out button label is pale grey on white (looks disabled)
- where: Profile bottom
- evidence: $D/pr2.png ; code: app/profile.tsx:594 (inkFaint)
- idea: use ink-mid; the destructive confirm is already in an alert.

### [UX] "Report a problem" row exposes the developer's personal gmail as the visible subtitle; opens external mail app
- evidence: $D/pr2.png. For a privacy-minded user a personal gmail looks unprofessional; use support@tabistickers.com.

### [UX] Privacy Policy opens in Safari, leaving the app (tiny "◀ Tabi Stickers" back link)
- evidence: $D/pp2.png ; page itself loads (200) and is clear. idea: SFSafariViewController via expo-web-browser. Page styling (blue sans on cream) is off-brand but fine.

### [VISUAL] Copy "watercolor memory" in the profile greeting
- saw: "You've captured 1 watercolor memory so far" - app calls them stickers everywhere else; "watercolor/memory" is leftover wording. Also stat tile says "Captured". ($D/pr1.png)

### [IDEA] Accessibility: selected language/wall-style rows say only "Français, French" - checkmark state is not announced (hier.sh shows no "selected").
- evidence: hier on profile; rows labelled 'Français, French', '日本語, Japanese'. idea: accessibilityState={{selected}}.

## Positive
- Delete Account is present, with a clear honest dialog ("permanently deletes your account, all 1 sticker, and everything else ... can't be undone"), Cancel on left ($D/del1.png). Log Out confirms too ($D/lo1.png).
- Blocked accounts sheet has a thoughtful empty state ($D/bl3.png). Learning-language list clear with Latin+native names ($D/pr1.png).
- Add Friend search: debounced, "Type at least 2 characters" hint, "No users found" state; keyboard dismisses on tapping the body ($D/fr3.png, fr7.png). Search is by username only, via RPC that honours blocks (privacy-friendly; no email shown).
- Friends empty state explains what challenges are.

### [UX] No way to change username, display name, email or password from Profile
- where: My Profile card (username/email text only; no edit affordance), no "Change password" anywhere signed-in
- evidence: $D/pr1.png ; code: app/profile.tsx (no edit/password handlers). A privacy-conscious user expects to rotate a password.

### [UX] Sign-in form: malformed email ("abc") + 1-char password enable "Sign In" and go to the server; no inline validation
- where: sign-in; same on Forgot Password ("notanemail" enables "Send Reset Code")
- evidence: $D/si2.png, $D/fp4.png ; code: sign-in.tsx:24 (only length>0), forgot-password.tsx:22
- idea: simple email regex + inline "Enter a valid email" so the user isn't told "Invalid login credentials" for a typo.

### [UX] Sign-in error is Supabase's raw "Invalid login credentials", and with the keyboard up the Sign In button is hidden under it (verified)
- evidence: $D/si4.png (no keyboard: fits), $D/si5.png (error + keyboard: button cut off, Sign Up link unreachable). The error banner pushes the form up/down by ~50px so layout jumps.
- tapping the "Tabi Stickers" title DID dismiss the keyboard for me both times (si3/si6) - could not reproduce the coordinator's no-dismiss. There is no drag-to-dismiss (keyboardDismissMode not set), so on SE the only escape is the title tap or return key.
- idea: "That email and password don't match. Forgot your password?" and keyboardDismissMode="on-drag".

### [BUG] iOS "Save Password?" prompt appears after a FAILED login when you navigate to Forgot Password
- what: after the invalid login (abc / x), tapping "Forgot password?" pops the system "Save Password?" sheet for the rejected credentials, over the Reset screen.
- evidence: $D/fp1.png
- idea: only unmount/navigate away from the form on success; or mark the password field so iOS doesn't treat nav as submit (clear the fields before navigating).

### [VISUAL] Auth screens are inconsistent: Sign-in/Sign-up are plain cream, Forgot-password has an illustrated night-sky scene
- where: Forgot Password. Dark-maroon "Reset Password" title on the rose sky has weak contrast and an animated cloud drifts over it with the keyboard up.
- Sign-in has ~35% empty cream space above the hero (bottom-anchored form), no logo/icon.
- evidence: $D/fp3.png, $D/fp4.png, $D/si2.png/si6.png

### [UX] Sign Up gives no Terms/Privacy notice and says nothing about what data is collected
- where: Create Account screen (photo + email + username + password), grep shows no "privacy"/"terms" in sign-up.tsx
- evidence: $D/su2.png. A sceptical user wants "By creating an account you agree to ... Privacy Policy" before committing. Also required vs optional isn't marked for username/email.

### [BUG] Username field accepts spaces and punctuation and says "Username available"
- what: typed "a b!tabc" -> green "Username available"; the friend search is by username, so such names are unsearchable/ugly.
- evidence: $D/su5.png
- idea: restrict to [a-z0-9_.] (3-20 chars) with live message.

### [VISUAL] Sign-up screen is taller than the SE: with the keyboard up the Create Account button is only visible after scrolling; the "Already have an account? Sign In" link sits at y=655-669 on a 667pt screen (edge) before scrolling.
- evidence: hier on su2 (bounds [49,655][326,669]); $D/su2.png

### [IDEA] Bottom links "Don't have an account? Sign Up" / "Already have an account? Sign In" are one accessibility element, small target (~14pt high).
- evidence: hier: "Don't have an account?  Sign Up" [49,596][326,610]. VoiceOver can't jump to the actual link; tap target should be >=44pt.

### [IDEA] Positive: sign-up has sensible touches
- pre-selected language pills, optional photo, live "Username available", Password hint "(min 6 characters)", eye toggle, return-key chaining. Check-email screen not reached (needs real submit) - code only.

### [UX] Re-signing in with valid credentials: with both fields filled and the keyboard up, Sign In is hidden under the keyboard, so the scripted tap on "Sign In" didn't submit (stuck on screen; $D/end.png). Only the return key (pressKey Enter) submitted. Same root cause as the keyboard-overlap finding above; it hits every login on a small phone, not only after an error.
Not tested: check-email screen (needs real sign-up), challenges (no friends), avatar crop after picking (didn't pick). AI calls used: 0.
