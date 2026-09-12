import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import {
  Modal, View, StyleSheet, Pressable, Keyboard,
  KeyboardAvoidingView, Platform, LayoutChangeEvent, DimensionValue,
} from 'react-native';
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS,
} from 'react-native-reanimated';
import { colors, radii, spacing, shadows } from '@/constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// How far down, or how fast, a drag has to go before letting go means "leave".
// Distance alone makes a quick flick feel ignored; velocity alone makes a slow
// deliberate pull-down feel like it never committed.
const DISMISS_DISTANCE = 96;
const DISMISS_VELOCITY = 800;
// Upward drag is resisted rather than blocked — the sheet gives a little so
// the gesture feels alive, but can't be dragged off the top of its own edge.
const UPWARD_RESISTANCE = 0.18;
const SPRING = { damping: 22, stiffness: 260 };
const EXIT_MS = 210;

export interface BottomSheetHandle {
  /// Slide off screen, then call `onClosed`. The caller's decision, not the
  /// gesture's — so a dismissal can be vetoed before anything moves.
  close: () => void;
  /// Put the sheet back where it rests. Used when a dismissal is refused.
  settle: () => void;
}

interface BottomSheetProps {
  /// The user asked to leave: scrim tap, drag-down, Android back, or a
  /// VoiceOver escape. This does *not* close anything on its own — decide,
  /// then call `close()` or `settle()` on the ref. Splitting it this way is
  /// what lets an unsaved-changes prompt sit between the gesture and the exit.
  onRequestClose: () => void;
  /// Runs once the sheet is actually off screen. Unmount here.
  onClosed: () => void;
  /// Drawn under the grabber, inside the drag zone: the sheet's title block.
  /// Kept out of any scroll view the children set up, so it stays put.
  header?: React.ReactNode;
  children: React.ReactNode;
  maxHeight?: DimensionValue;
}

// The chrome every bottom sheet in this app shares, and — more to the point —
// the dismissal gestures its looks promise. A rounded top edge, a grabber and
// a dimmed backdrop are all read as "this one closes when I swipe it or tap
// away"; a sheet that only closes via its Cancel button is making a promise
// it doesn't keep, which is exactly how the field editor felt trapping.
const BottomSheet = forwardRef<BottomSheetHandle, BottomSheetProps>(function BottomSheet(
  { onRequestClose, onClosed, header, children, maxHeight }, ref,
) {
  const y = useSharedValue(0);
  // Measured, not assumed: the exit has to clear the sheet's real height or
  // its bottom edge stays visible above the home indicator. Seeded large so a
  // close fired before first layout still travels far enough.
  const height = useSharedValue(900);
  // A shared value, not a ref: the pan worklets run on the UI thread, where a
  // React ref is only ever the frozen copy captured when the worklet was
  // built — a mid-exit drag would still move the sheet.
  const closing = useSharedValue(false);

  const close = () => {
    if (closing.value) return;
    closing.value = true;
    Keyboard.dismiss();
    y.value = withTiming(height.value, { duration: EXIT_MS }, finished => {
      if (finished) runOnJS(onClosed)();
    });
  };

  const settle = () => { y.value = withSpring(0, SPRING); };

  useImperativeHandle(ref, () => ({ close, settle }));

  // Called through a ref so the gesture below can be built once. The owner's
  // handler closes over its own draft and is therefore a new function on every
  // keystroke; depending on it directly would tear down and re-attach the pan
  // handler for each character typed.
  const latest = useRef(onRequestClose);
  latest.current = onRequestClose;
  const askToClose = useCallback(() => { latest.current(); }, []);

  const pan = useMemo(() => Gesture.Pan()
    // Only claims the gesture once it's clearly vertical, so a sideways swipe
    // or a tap on the header is still delivered to whatever's underneath.
    .activeOffsetY([-12, 12])
    .failOffsetX([-24, 24])
    .onUpdate(e => {
      if (closing.value) return;
      y.value = e.translationY < 0 ? e.translationY * UPWARD_RESISTANCE : e.translationY;
    })
    .onEnd(e => {
      if (closing.value) return;
      const left = e.translationY > DISMISS_DISTANCE
        || (e.translationY > 24 && e.velocityY > DISMISS_VELOCITY);
      // Asks rather than closes. The sheet holds its dragged position for the
      // one frame it takes the owner to answer.
      if (left) runOnJS(askToClose)();
      else y.value = withSpring(0, SPRING);
    }), []);

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  // The backdrop lightens as the sheet travels, so a half-committed drag shows
  // you how far from leaving you are instead of being a blind pull.
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(Math.max(y.value / Math.max(height.value, 1), 0), 1),
  }));

  const onSheetLayout = (e: LayoutChangeEvent) => {
    height.value = e.nativeEvent.layout.height;
  };

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onRequestClose}>
      {/* Gestures inside an RN Modal need their own root — the one in
          app/_layout.tsx sits outside the modal's view hierarchy. */}
      <GestureHandlerRootView style={styles.root}>
        <AnimatedPressable
          style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}
          onPress={onRequestClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <KeyboardAvoidingView
          style={styles.avoider}
          pointerEvents="box-none"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Animated.View
            style={[styles.sheet, !!maxHeight && { maxHeight }, sheetStyle]}
            onLayout={onSheetLayout}
            onAccessibilityEscape={onRequestClose}
          >
            <GestureDetector gesture={pan}>
              {/* The drag zone. Wide enough to grab without aiming, and the
                  title rides along so pulling it down feels like moving the
                  sheet rather than tugging a 40px bar. */}
              <View style={styles.dragZone}>
                <View style={styles.grabber} />
                {header}
              </View>
            </GestureDetector>
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
});

export default BottomSheet;

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrim: { backgroundColor: 'rgba(43, 42, 40, 0.45)' },
  avoider: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    ...shadows.card,
  },
  dragZone: { paddingTop: spacing.xs, paddingBottom: spacing.xs },
  grabber: {
    alignSelf: 'center',
    width: 40, height: 4,
    borderRadius: radii.full,
    backgroundColor: colors.border,
    marginBottom: spacing.ms,
  },
});
