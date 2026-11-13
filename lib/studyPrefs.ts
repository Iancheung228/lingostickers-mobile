import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Study preferences, kept on the device (SPEC: "stored on the device, editable
// in Profile"). One module-level store rather than a bare hook per call site
// (skills.md #1): the session host, the study card and the Profile toggles
// that R6 adds all read the same value and re-render together.

export interface StudyPrefs {
  /// Swipe left = Again, right = Good on the back of a card. Off by default.
  swipeGrading: boolean;
  /// Show only Again / Good.
  simpleGrading: boolean;
  /// New cards (never reviewed) introduced per day.
  newCardsPerDay: number;
  /// Speak the word once when the answer is revealed.
  autoplayAudio: boolean;
}

export const DEFAULT_STUDY_PREFS: StudyPrefs = {
  swipeGrading: false,
  simpleGrading: false,
  newCardsPerDay: 10,
  autoplayAudio: true,
};

const PREFS_KEY = 'tabi.studyPrefs.v1';
const NEW_TODAY_KEY = 'tabi.newCardsToday.v1';

let prefs: StudyPrefs = DEFAULT_STUDY_PREFS;
let loaded = false;
let newToday: { day: string; ids: string[] } = { day: '', ids: [] };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export function localDayKey(d: Date = new Date()): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function sanitize(raw: unknown): StudyPrefs {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<StudyPrefs>;
  const n = Number(r.newCardsPerDay);
  return {
    swipeGrading: typeof r.swipeGrading === 'boolean' ? r.swipeGrading : DEFAULT_STUDY_PREFS.swipeGrading,
    simpleGrading: typeof r.simpleGrading === 'boolean' ? r.simpleGrading : DEFAULT_STUDY_PREFS.simpleGrading,
    autoplayAudio: typeof r.autoplayAudio === 'boolean' ? r.autoplayAudio : DEFAULT_STUDY_PREFS.autoplayAudio,
    newCardsPerDay: Number.isFinite(n) && n >= 0 ? Math.min(200, Math.round(n)) : DEFAULT_STUDY_PREFS.newCardsPerDay,
  };
}

const ready: Promise<void> = (async () => {
  try {
    const [p, t] = await Promise.all([AsyncStorage.getItem(PREFS_KEY), AsyncStorage.getItem(NEW_TODAY_KEY)]);
    if (p) prefs = sanitize(JSON.parse(p));
    if (t) {
      const parsed = JSON.parse(t);
      if (parsed && typeof parsed.day === 'string' && Array.isArray(parsed.ids)) newToday = parsed;
    }
  } catch {
    // Storage can be unavailable; the defaults are a working app.
  }
  loaded = true;
  emit();
})();

/** Resolves once the stored values have been read (the session host awaits it). */
export const studyPrefsReady = (): Promise<void> => ready;

export function getStudyPrefs(): StudyPrefs { return prefs; }

export function setStudyPrefs(patch: Partial<StudyPrefs>) {
  prefs = sanitize({ ...prefs, ...patch });
  emit();
  AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs)).catch(() => {});
}

function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

/** The prefs, live. `set` merges a patch and persists it. */
export function useStudyPrefs(): StudyPrefs & { loaded: boolean; set: (patch: Partial<StudyPrefs>) => void } {
  const p = useSyncExternalStore(subscribe, getStudyPrefs, getStudyPrefs);
  const l = useSyncExternalStore(subscribe, () => loaded, () => loaded);
  return { ...p, loaded: l, set: setStudyPrefs };
}

// ── New cards introduced today ──────────────────────────────────────────
// The limit is per local day, and "new" is `review_count === 0`. The count of
// ids already introduced today is kept here because nothing in the schema says
// which day a card was first reviewed.

function todaysIds(): string[] {
  const day = localDayKey();
  return newToday.day === day ? newToday.ids : [];
}

export function newCardsIntroducedToday(): number { return todaysIds().length; }

export function recordNewCardIntroduced(id: string) {
  const ids = todaysIds();
  if (ids.includes(id)) return;
  newToday = { day: localDayKey(), ids: [...ids, id] };
  AsyncStorage.setItem(NEW_TODAY_KEY, JSON.stringify(newToday)).catch(() => {});
}

/** Undoing the grade that introduced a card gives its slot back. */
export function forgetNewCardIntroduced(id: string) {
  const ids = todaysIds();
  if (!ids.includes(id)) return;
  newToday = { day: localDayKey(), ids: ids.filter(x => x !== id) };
  AsyncStorage.setItem(NEW_TODAY_KEY, JSON.stringify(newToday)).catch(() => {});
}
