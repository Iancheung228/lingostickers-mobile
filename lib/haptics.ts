import * as Haptics from 'expo-haptics';

// One map for every haptic in the app (B-app 10, B-core 0). Screens call
// `haptic.tap()` etc. and never import expo-haptics themselves. Throttled to
// one per 80 ms so a burst (a drag crossing detents, a double tap) doesn't buzz.
// None on scroll, sheet snap, flip-back or pull-to-refresh; never the only feedback.
const THROTTLE_MS = 80;
let last = 0;

function fire(fn: () => Promise<void>) {
  const now = Date.now();
  if (now - last < THROTTLE_MS) return;
  last = now;
  fn().catch(() => {}); // haptics are best-effort (simulator, disabled system setting)
}

export const haptic = {
  /** Light impact: tab change, favourite, undo, drag lift/drop, a normal commit. */
  tap: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Selection tick: chips, filters, picker, calendar day, crossing a threshold. */
  select: () => fire(() => Haptics.selectionAsync()),
  /** Medium impact: due pill, long-press menu, destructive confirm. */
  press: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Rigid impact: grading Again. */
  rigid: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid)),
  /** Saved, card added, board created, session ended. */
  success: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** A failure that needs action. */
  error: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};

export type HapticKind = keyof typeof haptic;
