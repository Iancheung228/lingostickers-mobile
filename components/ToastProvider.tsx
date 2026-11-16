import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import {
  AccessibilityInfo, Animated, Keyboard, PanResponder, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import { TAB, tabBarBottom } from '@/constants/tabBar';
import { AlertCircle, CheckCircle2, Info, Undo2 } from 'lucide-react-native';
import { fonts, radii, spacing, MIN_TAP } from '@/constants/theme';
import { dur, useMotion } from '@/lib/motion';
import { haptic } from '@/lib/haptics';
import { useTheme, useThemedStyles, type Theme } from '@/hooks/useTheme';

// App-wide toast (B-app 7, C-look 4). One provider in app/_layout.tsx (lesson 1),
// `useToast().show({ kind, message, action })`. The legacy per-screen
// components/Toast.tsx keeps working for the one caller that still mounts it.

export type ToastKind = 'success' | 'info' | 'error' | 'undo';

export interface ToastOptions {
  kind?: ToastKind;
  message: string;
  /** e.g. { label: 'Undo', onPress } */
  action?: { label: string; onPress: () => void };
  /** Sit above the floating tab bar (tab screens). */
  aboveTabBar?: boolean;
}

interface ToastApi {
  show: (opts: ToastOptions) => void;
  dismiss: () => void;
}

const ToastContext = createContext<ToastApi | null>(null);

// What a layer needs to draw the current toast. The provider's own layer sits
// at the app root, which a native Modal covers; a screen that presents a Modal
// mounts <ToastLayer/> inside it, and the root layer steps aside while one is
// mounted, so there is only ever one toast on screen.
interface ToastView {
  current: Item | null;
  opacity: Animated.Value;
  lift: Animated.Value;
  panHandlers: object;
  pause: () => void;
  resume: () => void;
  dismiss: () => void;
  kb: number;
  registerHost: () => () => void;
}
const ToastViewContext = createContext<ToastView | null>(null);

/** Routes that show the floating tab bar. */
const TAB_PATHS = ['/collection', '/calendar', '/scan', '/wall', '/profile', '/friends'];
const MAX_WAITING = 2;

type Item = Required<Pick<ToastOptions, 'kind' | 'message'>> & Pick<ToastOptions, 'action' | 'aboveTabBar'> & { id: number };

export function ToastProvider({ children }: { children: ReactNode }) {
  const { reduced } = useMotion();
  const [current, setCurrent] = useState<Item | null>(null);
  const currentRef = useRef<Item | null>(null);
  const queue = useRef<Item[]>([]);
  const nextId = useRef(1);
  const [kb, setKb] = useState(0);
  const screenReader = useRef(false);

  const opacity = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(12)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remaining = useRef(0);
  const startedAt = useRef(0);

  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then((v) => { screenReader.current = v; }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', (v) => { screenReader.current = v; });
    const show = Keyboard.addListener('keyboardWillShow', (e) => setKb(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKb(0));
    return () => { sub.remove(); show.remove(); hide.remove(); };
  }, []);

  const clearTimer = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };

  const setItem = (it: Item | null) => { currentRef.current = it; setCurrent(it); };

  const hide = useCallback((then?: () => void) => {
    clearTimer();
    Animated.timing(opacity, { toValue: 0, duration: reduced ? dur.fast : 150, useNativeDriver: true }).start(() => {
      then?.();
    });
  }, [opacity, reduced]);

  const present = useCallback((it: Item) => {
    setItem(it);
    opacity.setValue(0);
    lift.setValue(reduced ? 0 : 12);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: reduced ? dur.fast : dur.base, useNativeDriver: true }),
      Animated.timing(lift, { toValue: 0, duration: reduced ? 0 : dur.base, useNativeDriver: true }),
    ]).start();
    AccessibilityInfo.announceForAccessibility(it.message);
    if (it.kind === 'success') haptic.success();
    else if (it.kind === 'error') haptic.error();
    const base = screenReader.current ? 10000 : it.kind === 'error' || it.kind === 'undo' ? 6000 : 4000;
    remaining.current = base;
    arm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opacity, lift, reduced]);

  const advance = useCallback(() => {
    const nxt = queue.current.shift();
    if (nxt) present(nxt); else setItem(null);
  }, [present]);

  function arm() {
    clearTimer();
    startedAt.current = Date.now();
    timer.current = setTimeout(() => hide(advance), remaining.current);
  }
  const pause = () => {
    if (!timer.current) return;
    clearTimer();
    remaining.current = Math.max(1000, remaining.current - (Date.now() - startedAt.current));
  };

  const show = useCallback((opts: ToastOptions) => {
    const it: Item = { id: nextId.current++, kind: opts.kind ?? 'info', message: opts.message, action: opts.action, aboveTabBar: opts.aboveTabBar };
    const cur = currentRef.current;
    if (!cur) { present(it); return; }
    // An error is never replaced by a success/info; it queues behind it.
    if (cur.kind === 'error' && it.kind !== 'error') {
      if (queue.current.length < MAX_WAITING) queue.current.push(it);
      return;
    }
    queue.current = [];
    hide(() => present(it)); // crossfade replace
  }, [hide, present]);

  const dismiss = useCallback(() => { queue.current = []; hide(() => setItem(null)); }, [hide]);

  // Swipe down dismisses.
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderGrant: pause,
    onPanResponderRelease: (_e, g) => { if (g.dy > 24) hide(advance); else arm(); },
    onPanResponderTerminate: () => arm(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [hide, advance]);

  useEffect(() => () => clearTimer(), []);

  const api = useMemo<ToastApi>(() => ({ show, dismiss }), [show, dismiss]);

  const [hosts, setHosts] = useState(0);
  const registerHost = useCallback(() => {
    setHosts(n => n + 1);
    return () => setHosts(n => Math.max(0, n - 1));
  }, []);
  const resume = useCallback(() => { if (!timer.current && currentRef.current) arm(); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []);

  const view = useMemo<ToastView>(() => ({
    current, opacity, lift, panHandlers: pan.panHandlers, pause, resume, dismiss, kb, registerHost,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [current, opacity, lift, pan, dismiss, kb, registerHost, resume]);

  return (
    <ToastContext.Provider value={api}>
      <ToastViewContext.Provider value={view}>
        {children}
        {hosts === 0 && <ToastLayer root />}
      </ToastViewContext.Provider>
    </ToastContext.Provider>
  );
}

/**
 * Draws the current toast. The provider mounts one at the root; mount another
 * inside any Modal that should show toasts (the study card, the card detail,
 * the session summary). `bottomOffset` lifts it clear of a control row.
 */
export function ToastLayer({ root, bottomOffset = 0, bottom: fixedBottom }: { root?: boolean; bottomOffset?: number; bottom?: number }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const v = useContext(ToastViewContext);
  const register = v?.registerHost;
  useEffect(() => (!root && register ? register() : undefined), [root, register]);
  if (!v || !v.current) return null;
  const { current, opacity, lift, panHandlers, pause, resume, dismiss, kb } = v;
  // On a tab screen (root layer only) the toast clears the floating bar and
  // its crest: the bar's bottom edge + its height + the crest + 12.
  const overBar = !!root && (current.aboveTabBar || TAB_PATHS.includes(pathname));
  const barTop = tabBarBottom(insets.bottom) + TAB.height + TAB.crest + 12;
  const bottom = fixedBottom ?? ((kb > 0 ? kb + 8 : overBar ? barTop : insets.bottom + 16) + bottomOffset);
  const Icon = current.kind === 'error' ? AlertCircle : current.kind === 'success' ? CheckCircle2 : current.kind === 'undo' ? Undo2 : Info;

  return (
    <View style={[styles.wrap, { bottom }]} pointerEvents="box-none">
      <Animated.View
        {...panHandlers}
        onTouchStart={pause}
        onTouchEnd={resume}
        style={[styles.toast, current.message.length > 44 && styles.multi, { opacity, transform: [{ translateY: lift }] }]}
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
      >
        <Icon size={20} strokeWidth={1.75} color={current.kind === 'error' ? colors.errorOnDark : colors.card} />
        <Text style={styles.message} numberOfLines={3} maxFontSizeMultiplier={1.5} testID="toast-message">{current.message}</Text>
        {current.action && (
          <Pressable
            onPress={() => {
              if (current.kind === 'undo') haptic.tap();
              current.action!.onPress();
              dismiss();
            }}
            testID="toast-action"
            accessibilityRole="button"
            style={styles.actionHit}
          >
            <Text style={styles.action} maxFontSizeMultiplier={1.5}>{current.action.label}</Text>
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

const makeStyles = ({ colors, e2 }: Theme) => StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.md, right: spacing.md, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    backgroundColor: colors.charcoal,
    borderRadius: radii.full,
    minHeight: MIN_TAP,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.md,
    maxWidth: 560,
    ...e2,
  },
  multi: { borderRadius: radii.lg },
  message: { flexShrink: 1, fontFamily: fonts.text, fontSize: 16, lineHeight: 22, color: colors.card },
  actionHit: { minHeight: MIN_TAP, minWidth: MIN_TAP, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xs },
  action: { fontFamily: fonts.display, fontSize: 16, color: colors.blush },
});
