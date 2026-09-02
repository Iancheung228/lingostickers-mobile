import { Language } from '@/lib/types';

/**
 * The three languages the app teaches, named once.
 *
 * This list had been written out four separate times — in `profile.tsx`,
 * `sign-up.tsx`, `DueTodayRail` and `ChallengeScreen` — which is how
 * `ChallengeSuccess` came to greet a Japanese learner with "Use it in a
 * sentence en français!". A fourth copy is not a style problem; it is the
 * mechanism by which one screen ends up disagreeing with the others.
 *
 * `native` is the endonym and leads in the UI: someone looking for Cantonese
 * scans for 廣東話, not for the eighth word of an English sentence about it.
 */
export const LANGUAGES: { code: Language; native: string; label: string }[] = [
  { code: 'fr',  native: 'Français', label: 'French' },
  { code: 'ja',  native: '日本語',    label: 'Japanese' },
  { code: 'yue', native: '廣東話',    label: 'Cantonese' },
];

const BY_CODE = new Map(LANGUAGES.map((l) => [l.code, l]));

/** English name — "French". Falls back to the code for a row from the future. */
export function languageLabel(code: string): string {
  return BY_CODE.get(code as Language)?.label ?? code;
}

/** Endonym — "Français", "日本語", "廣東話". Set it with `wordFontFor(code)`. */
export function languageNative(code: string): string {
  return BY_CODE.get(code as Language)?.native ?? code;
}
