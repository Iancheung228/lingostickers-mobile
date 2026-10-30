# Skills — index of lessons from bugs already hit in this codebase

One line per lesson: when it applies, and the rule. The full write-up (symptom,
root cause, fix pattern, file pointers) is the same-numbered section of
`docs/lessons.md`. **Read that section before working in its area** — these
lines are the trigger, not the whole lesson.

1. **Cross-screen state** — two components must agree on a value (auth, profile, friends, challenges) → one Context provider mounted in `app/_layout.tsx`, never a bare hook per call site.
2. **One user sees another user's file** — Storage RLS is per-owner folder; signed URLs don't bypass it → copy via service-role edge function, or mint the URL server-side after your own auth check.
3. **`supabase.functions.invoke` errors** — never show `error.message`; unwrap the body with `getFunctionErrorMessage` (`lib/functionError.ts`) and remap copy there.
4. **Build/test loop** — dev client + Metro hot reload; EAS builds are rationed (15/month, ask first); phone connects over LAN, not tunnel; edge functions deploy separately.
5. **Any Expo API** — this is SDK 54; check https://docs.expo.dev/versions/v54.0.0/ before assuming an API's shape.
6. **Cutout picks the wrong object** — the model must be told the selection (promptable Vision instances), not corrected after; segment with padding; keep gate thresholds in TS (`lib/cutout.ts`).
7. **Full-resolution image work in Swift** — budget memory, not speed: compute coefficients at 1/4 scale, apply at full; do `w*h*4` × live planes before choosing a resolution.
8. **Custom bottom sheets** — every drawn affordance (grabber, scrim) must work; all exits route through one guard (`components/BottomSheet.tsx`); worklet flags are shared values; compare specs by key.
9. **Two actions on one surface / rows of buttons** — the rarer action gets a drawn control; `hitSlop` is anisotropic and `gap >= left_slop + right_slop`.
10. **Exits the OS performs (pageSheet swipe)** — can't be vetoed, so make them non-destructive: key drafts to the subject; `onBlur` is not "done".
11. **Text inputs and forms** — debounce + sequence-ticket every search; declare `textContentType`/`autoComplete`; chain `returnKeyType`; passwords use `PasswordField`.
12. **Grading scale / scheduler** — the ramp is red→green with no brand colour; buttons must differ in outcome; learning steps in minutes (`lib/review.ts`); one `nextOutcome()` for label and write.
13. **Model output that must correspond to something** — make the target an input (syllabus), read the choice back, validate whole and drop on mismatch; re-check at render; mind CJK punctuation.
14. **LLM providers** — adapters behind `_shared/llm/`; retry/failover decided by `LlmError.kind`; never fail over on `invalid` or `blocked`; cap backoff.
15. **Response shape** — one registry (`_shared/cardSchema.ts`) renders prose and JSON Schema; field order is load-bearing; assert the rendered block `JSON.parse`s.
16. **Edge-function types** — `npm run typecheck:functions` (deno check) is the gate; probe esm.sh module shape at runtime before "fixing" an import; verify image code by running it.
