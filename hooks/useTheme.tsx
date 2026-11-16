import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkTheme, lightTheme, type Scheme, type Theme } from '@/constants/theme';
export type { Theme };

// One provider, mounted once in app/_layout.tsx (docs/lessons.md #1), so a
// change in Profile -> Appearance repaints every mounted screen at once.
//
// The preference is System / Light / Dark, persisted in AsyncStorage. "System"
// follows iOS only in a build whose Info.plist allows it (app.json
// userInterfaceStyle "automatic"); in a build still pinned to "light" the OS
// reports light and System therefore means light. Light and Dark always work.
export type ThemePreference = 'system' | 'light' | 'dark';

const KEY = 'tabi.theme-preference';

type ThemeContextValue = Theme & {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  /** False until the saved preference has been read; the root holds the splash until then. */
  ready: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (live && (v === 'light' || v === 'dark' || v === 'system')) setPreferenceState(v);
      })
      .catch(() => {})
      .finally(() => { if (live) setReady(true); });
    return () => { live = false; };
  }, []);

  const scheme: Scheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;

  // Native chrome (keyboard, alerts, pageSheet grabber, date pickers, the
  // status-bar default) follows the window's interface style, not our
  // palette. Pin it to the choice so the app is never half dark. null hands
  // control back to the OS.
  useEffect(() => {
    Appearance.setColorScheme(preference === 'system' ? null : preference);
  }, [preference]);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    AsyncStorage.setItem(KEY, p).catch(() => {});
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ ...(scheme === 'dark' ? darkTheme : lightTheme), preference, setPreference, ready }),
    [scheme, preference, setPreference, ready],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}

/**
 * Build a StyleSheet from the live theme, memoised on the scheme.
 *   const makeStyles = ({ colors }: Theme) => StyleSheet.create({ ... });
 *   const styles = useThemedStyles(makeStyles);
 * `factory` must be a module-level function (stable identity).
 */
export function useThemedStyles<T>(factory: (theme: Theme) => T): T {
  const { scheme } = useTheme();
  return useMemo(() => factory(scheme === 'dark' ? darkTheme : lightTheme), [factory, scheme]);
}
