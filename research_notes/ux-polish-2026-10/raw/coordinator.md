# Coordinator findings (seen during simulator setup)
### [UX] Sign-in error shows raw Supabase text
- where: sign-in, wrong password → "Invalid login credentials" (Supabase's own string)
- evidence: check-se.png (first version, overwritten), observed on iPhone SE
- idea: map to friendly copy ("That email and password don't match. Try again or reset your password.")
### [UX] SE: error banner pushes Sign In under the keyboard
- where: sign-in on iPhone SE 3rd gen; banner appears above fields, Sign In slides beneath keyboard
- evidence: check-se.png
### [UX] SE: tapping outside fields doesn't dismiss keyboard
- where: sign-in; tapping "WELCOME BACK" header left keyboard up on SE (worked on 18 Pro)
- idea: keyboardShouldPersistTaps/Keyboard.dismiss on background press; KeyboardAvoidingView / scroll
