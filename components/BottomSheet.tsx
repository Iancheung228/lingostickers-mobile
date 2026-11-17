import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { useMotion } from '@/lib/motion';
import {
  Modal, View, StyleSheet, Pressable, Keyboard,
  KeyboardAvoidingView, Platform, LayoutChangeEvent, DimensionValue, useWindowDimensions,
} from 'react-native';
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS,
} from 'react-native-reanimated';
import { radii, spacing } from '@/constants/theme';
import { useThemedStyles, type Theme } from '@/hooks/useTheme';

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
const ENTER_MS = 260;

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
  const styles = useThemedStyles(makeStyles);
  const { reduced } = useMotion();
  const { height: windowH } = useWindowDimensions();
  // Starts off screen and slides in itself: the Modal's own 'slide' would carry
  // the scrim up with the sheet instead of letting it fade (scrim = f(y)).
  const y = useSharedValue(reduced ? 0 : windowH);
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
    // Reduce Motion: no travel, the sheet just goes (the scrim follows y).
    y.value = withTiming(height.value, { duration: reduced ? 0 : EXIT_MS }, finished => {
      if (finished) runOnJS(onClosed)();
    });
  };

  // Ignored mid-exit: a spring here would replace the exit timing and onClosed
  // would never fire, leaving the sheet wedged open.
  const settle = () => {
    if (closing.value) return;
    y.value = reduced ? 0 : withSpring(0, SPRING);
  };

  useEffect(() => {
    if (y.value > 0) y.value = withTiming(0, { duration: reduced ? 0 : ENTER_MS });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({ close, settle }));

  // Called through a ref so the gesture below can be built once. The owner's
  // handler closes over its own draft and is therefore a new function on every
  // keystroke; depending on it directly would tear down and re-attach the pan
  // handler for each character typed.
  const latest = useRef(onRequestClose);
  latest.current = onRequestClose;
  // Requests during an exit are dropped (scrim tap, back, escape, drag).
  const askToClose = useCallback(() => {
    if (closing.value) return;
    latest.current();
  }, [closing]);

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
      else y.value = reduced ? 0 : withSpring(0, SPRING);
    }), [reduced]);

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
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={askToClose}>
      {/* Gestures inside an RN Modal need their own root — the one in
          app/_layout.tsx sits outside the modal's view hierarchy. */}
      <GestureHandlerRootView style={styles.root}>
        <AnimatedPressable
          style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}
          onPress={askToClose}
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
            onAccessibilityEscape={askToClose}
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

const makeStyles = ({ colors, e2 }: Theme) => StyleSheet.create({
  root: { flex: 1 },
  scrim: { backgroundColor: colors.scrim },
  avoider: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    // C-look 4 "Sheets": page-coloured, radius 24 top, e2, 20 gutters.
    backgroundColor: colors.cream,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: spacing.lg,
    ...e2,
  },
  dragZone: { paddingTop: spacing.xs, paddingBottom: spacing.xs },
  grabber: {
    alignSelf: 'center',
    width: 36, height: 5,
    borderRadius: radii.full,
    backgroundColor: colors.grabber,
    marginBottom: spacing.ms,
  },
});
