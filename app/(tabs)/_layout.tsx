import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Keyboard, useWindowDimensions } from 'react-native';
import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  interpolateColor, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { haptic } from '@/lib/haptics';
import { dur, pressSpring, useMotion } from '@/lib/motion';
import { DueCountProvider, useDueCount } from '@/hooks/useDueCount';
import { SOCIAL_ENABLED } from '@/lib/features';
import { fonts } from '@/constants/theme';
import { TAB, tabBarBottom, tabBarWidth } from '@/constants/tabBar';
import TabBarShape from '@/components/tabbar/TabBarShape';
import TabBarFade from '@/components/tabbar/TabBarFade';
import TabDisc, { DISC_OUTER } from '@/components/tabbar/TabDisc';
import { TabIcon, type TabGlyph } from '@/components/tabbar/TabIcon';

// The "Crest" pill (spec: research_notes/tabbar-redesign-2026-11/index.html §11).
// Five equal slots, mirror-symmetric: Collection, Calendar, [Scan], Boards,
// Profile. The bar is a custom component (not tabBarButton overrides) because
// the crest and disc rise above the pill, and React Navigation's wrapper clips.
interface Slot {
  name: string;
  label: string;
  a11y: string;
  glyph?: TabGlyph;
}
const SLOTS: Slot[] = [
  { name: 'collection', label: 'Collection', a11y: 'Collection', glyph: 'collection' },
  { name: 'calendar', label: 'Calendar', a11y: 'Calendar', glyph: 'calendar' },
  { name: 'scan', label: 'Scan', a11y: 'Scan a new sticker' },
  { name: 'wall', label: 'Boards', a11y: 'Boards', glyph: 'boards' },
  { name: 'profile', label: 'Profile', a11y: 'Profile', glyph: 'profile' },
];
const CENTRE = 2;

function useFocusProgress(focused: boolean) {
  const p = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    p.value = withTiming(focused ? 1 : 0, { duration: dur.fast });
  }, [focused, p]);
  return p;
}

function SlotLabel({ text, focused }: { text: string; focused: boolean }) {
  const p = useFocusProgress(focused);
  const style = useAnimatedStyle(() => ({ color: interpolateColor(p.value, [0, 1], [TAB.inkOff, TAB.inkOn]) }));
  return (
    <Animated.Text style={[styles.label, style]} numberOfLines={1} maxFontSizeMultiplier={1.15}>
      {text}
    </Animated.Text>
  );
}

/** Outline and filled drawings stacked; focus cross-fades them with a small pop. */
function SlotGlyph({ glyph, focused, reduced }: { glyph: TabGlyph; focused: boolean; reduced: boolean }) {
  const p = useFocusProgress(focused);
  const pop = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (focused && !reduced) pop.value = withSequence(withTiming(1.08, { duration: 70 }), withSpring(1, pressSpring));
  }, [focused, reduced, pop]);
  const box = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const off = useAnimatedStyle(() => ({ opacity: 1 - p.value }));
  const on = useAnimatedStyle(() => ({ opacity: p.value }));
  return (
    <Animated.View style={[styles.icon, box]}>
      <Animated.View style={[StyleSheet.absoluteFill, off]}><TabIcon name={glyph} active={false} /></Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, on]}><TabIcon name={glyph} active /></Animated.View>
    </Animated.View>
  );
}

function Badge({ count, reduced }: { count: number; reduced: boolean }) {
  const s = useSharedValue(1);
  const prev = useRef(count);
  useEffect(() => {
    if (prev.current !== count && !reduced) {
      s.value = withSequence(withTiming(1.25, { duration: dur.fast }), withTiming(1, { duration: dur.fast }));
    }
    prev.current = count;
  }, [count, reduced, s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View style={[styles.badge, style]} pointerEvents="none">
      <Text style={styles.badgeText} maxFontSizeMultiplier={1}>{count > 9 ? '9+' : String(count)}</Text>
    </Animated.View>
  );
}

function PillTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { dueCount } = useDueCount();
  const { reduced } = useMotion();
  const [keyboardUp, setKeyboardUp] = useState(false);
  const [scanDown, setScanDown] = useState(false);

  // tabBarHideOnKeyboard does not apply to a custom bar.
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', () => setKeyboardUp(true));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboardUp(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  if (keyboardUp) return null;
  const focusedName = state.routes[state.index]?.name;

  const press = (slot: Slot) => {
    const route = state.routes.find(r => r.name === slot.name);
    if (!route) return;
    const focused = focusedName === slot.name;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) {
      if (slot.name !== 'scan') haptic.tap();
      navigation.navigate(route.name as never);
    }
  };

  const W = tabBarWidth(screenWidth);
  const bottom = tabBarBottom(insets.bottom);
  const fadeHeight = bottom + TAB.height + TAB.crest + TAB.fade.height;
  const head = TAB.headroom;
  return (
    <>
    {/* Not on the camera: its own controls sit right above the bar. */}
    {focusedName !== 'scan' && <TabBarFade height={fadeHeight} />}
    {/* The bar's view includes the headroom above the pill, so the crest and
        the disc are inside their parent's bounds and tappable. */}
    <View
      pointerEvents="box-none"
      accessibilityRole="tabbar"
      style={[styles.bar, { width: W, height: TAB.height + head, bottom, left: (screenWidth - W) / 2 }]}
    >
      <TabBarShape width={W} />
      {SLOTS.map((slot, i) => {
        const focused = focusedName === slot.name;
        const badge = slot.name === 'collection' && dueCount > 0;
        const label = badge ? `${slot.a11y}, ${dueCount} due` : slot.a11y;
        const centre = W / 2 + (i - CENTRE) * TAB.pitch;
        const camera = i === CENTRE;
        // Hit box: one pitch wide; the outer two run out to the pill's ends,
        // Scan's runs up over the crest. Contents are placed relative to the
        // pill's flat top, so `top` offsets them by the box's own top.
        const left = i === 0 ? 0 : centre - TAB.pitch / 2;
        const right = i === SLOTS.length - 1 ? W : centre + TAB.pitch / 2;
        const top = camera ? 0 : head;
        const local = centre - left;
        const y0 = head - top;
        return (
          <Pressable
            key={slot.name}
            onPress={() => press(slot)}
            onPressIn={camera ? () => { setScanDown(true); haptic.press(); } : undefined}
            onPressOut={camera ? () => setScanDown(false) : undefined}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: focused }}
            testID={`tab-${slot.name}`}
            style={({ pressed }) => [
              styles.slot,
              { left, width: right - left, top, height: TAB.height + head - top },
              !camera && pressed && styles.pressed,
            ]}
          >
            {camera ? (
              <View style={[styles.disc, { left: local - DISC_OUTER / 2, top: y0 + TAB.discCy - DISC_OUTER / 2 }]} pointerEvents="none">
                <TabDisc active={focused} pressed={scanDown} reduced={reduced} />
              </View>
            ) : (
              <View style={[styles.iconBox, { left: local - TAB.iconSize / 2, top: y0 + TAB.iconTop }]} pointerEvents="none">
                <SlotGlyph glyph={slot.glyph!} focused={focused} reduced={reduced} />
              </View>
            )}
            {badge && (
              <View style={[styles.badgeAt, { left: local + TAB.badge.left - 2, top: y0 + TAB.badge.top - 2 }]} pointerEvents="none">
                <Badge count={dueCount} reduced={reduced} />
              </View>
            )}
            <View style={[styles.labelBox, { left: local - TAB.pitch / 2, top: y0 + TAB.labelTop }]} pointerEvents="none">
              <SlotLabel text={slot.label} focused={focused} />
            </View>
          </Pressable>
        );
      })}
    </View>
    </>
  );
}

export default function TabLayout() {
  return (
    <DueCountProvider>
      <Tabs
        tabBar={(props) => <PillTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="collection" options={{ title: 'Collection' }} />
        <Tabs.Screen name="calendar" options={{ title: 'Calendar' }} />
        <Tabs.Screen name="scan" options={{ title: 'Scan' }} />
        <Tabs.Screen name="wall" options={{ title: 'Boards' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
        <Tabs.Screen
          name="friends"
          options={{
            // Off for the first release — see lib/features.ts. href: null
            // keeps the route but takes it out of the bar (the bar is fixed
            // to five slots, so Friends is reachable by route only).
            ...(SOCIAL_ENABLED ? {} : { href: null }),
            title: 'Friends',
          }}
        />
      </Tabs>
    </DueCountProvider>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', overflow: 'visible' },
  slot: { position: 'absolute' },
  pressed: { opacity: 0.6 },
  iconBox: { position: 'absolute', width: TAB.iconSize, height: TAB.iconSize },
  icon: { width: TAB.iconSize, height: TAB.iconSize },
  disc: { position: 'absolute' },
  labelBox: { position: 'absolute', width: TAB.pitch, alignItems: 'center' },
  label: { fontSize: TAB.labelSize, lineHeight: 13, fontFamily: fonts.display, textAlign: 'center' },
  // Positioned by its ring's outer edge: the 16 pt face sits at the spec's (left, top).
  badgeAt: { position: 'absolute' },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: TAB.badge.ring,
    backgroundColor: TAB.badge.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: TAB.badge.text, fontSize: 10.5, lineHeight: 13, fontFamily: fonts.monoBold },
});
