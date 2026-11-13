import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Keyboard } from 'react-native';
import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookOpen, Calendar, Camera, Sticker as StickerIcon, User } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { haptic } from '@/lib/haptics';
import { DueCountProvider, useDueCount } from '@/hooks/useDueCount';
import { SOCIAL_ENABLED } from '@/lib/features';
import { colors, e2, fonts, radii } from '@/constants/theme';
import {
  TAB_BAR_HEIGHT, TAB_BAR_WIDTH, TAB_BAR_ITEM_WIDTH, TAB_BAR_DISC, TAB_BAR_DISC_OVERHANG, tabBarBottom,
} from '@/constants/tabBar';

// Five equal slots, mirror-symmetric: Collection, Calendar, [Scan], Boards,
// Profile. The bar is a custom component (not tabBarButton overrides) because
// the raised disc needs an overflow-visible wrapper, and React Navigation's
// default one clips.
interface Slot {
  name: string;
  label: string;
  a11y: string;
  Icon: LucideIcon;
  camera?: boolean;
}
const SLOTS: Slot[] = [
  { name: 'collection', label: 'Collection', a11y: 'Collection', Icon: BookOpen },
  { name: 'calendar', label: 'Calendar', a11y: 'Calendar', Icon: Calendar },
  { name: 'scan', label: 'Scan', a11y: 'Scan a new sticker', Icon: Camera, camera: true },
  { name: 'wall', label: 'Boards', a11y: 'Boards', Icon: StickerIcon },
  { name: 'profile', label: 'Profile', a11y: 'Profile', Icon: User },
];

function PillTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { dueCount } = useDueCount();
  const [keyboardUp, setKeyboardUp] = useState(false);

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
      haptic.tap();
      navigation.navigate(route.name as never);
    }
  };

  return (
    // The wrapper is the overflow-visible one: the pill below has the rose
    // fill, the disc is a sibling that overhangs it.
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: tabBarBottom(insets.bottom) }]}
    >
      <View style={styles.row} accessibilityRole="tabbar">
        <View style={styles.pill} pointerEvents="none" />
        {SLOTS.map(slot => {
          const focused = focusedName === slot.name;
          const badge = slot.name === 'collection' && dueCount > 0;
          const label = badge ? `${slot.a11y}, ${dueCount} due` : slot.a11y;
          const Icon = slot.Icon;
          return (
            <Pressable
              key={slot.name}
              onPress={() => press(slot)}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: focused }}
              testID={`tab-${slot.name}`}
              style={styles.slot}
            >
              {slot.camera ? (
                <View style={styles.discHolder} pointerEvents="none">
                  <View style={styles.disc}>
                    <Camera size={26} color={colors.white} strokeWidth={2} />
                  </View>
                </View>
              ) : (
                <>
                  {focused && <View style={styles.highlight} />}
                  <View>
                    <Icon size={24} color={focused ? colors.terra : colors.maroon} strokeWidth={1.75} />
                    {badge && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText} maxFontSizeMultiplier={1}>
                          {dueCount > 9 ? '9+' : String(dueCount)}
                        </Text>
                      </View>
                    )}
                  </View>
                </>
              )}
              <Text
                style={[styles.label, focused && styles.labelActive, slot.camera && styles.labelCamera]}
                numberOfLines={1}
                maxFontSizeMultiplier={1.15}
              >
                {slot.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
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
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    overflow: 'visible',
  },
  // The row is taller than the pill by the disc's overhang, so the disc sits
  // inside its parent's bounds and is tappable (iOS ignores touches outside).
  row: {
    width: TAB_BAR_WIDTH,
    height: TAB_BAR_HEIGHT + TAB_BAR_DISC_OVERHANG,
    flexDirection: 'row',
    overflow: 'visible',
  },
  pill: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: TAB_BAR_HEIGHT,
    borderRadius: radii.full,
    backgroundColor: colors.blush,
    ...e2,
  },
  slot: {
    width: TAB_BAR_ITEM_WIDTH,
    height: TAB_BAR_HEIGHT + TAB_BAR_DISC_OVERHANG,
    paddingTop: TAB_BAR_DISC_OVERHANG,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  highlight: {
    position: 'absolute',
    top: TAB_BAR_DISC_OVERHANG + 7, bottom: 7, left: 3, right: 3,
    borderRadius: 22,
    backgroundColor: colors.white,
  },
  label: { fontSize: 12, lineHeight: 14, fontFamily: fonts.display, color: colors.maroon },
  labelActive: { color: colors.inkDark },
  labelCamera: { position: 'absolute', bottom: 8 },
  // The disc lives in the camera slot but is lifted so it overhangs the pill.
  discHolder: {
    position: 'absolute',
    top: 0,
    alignItems: 'center',
  },
  disc: {
    width: TAB_BAR_DISC,
    height: TAB_BAR_DISC,
    borderRadius: radii.full,
    backgroundColor: colors.terra,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.cream,
    ...e2,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -12,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radii.full,
    backgroundColor: colors.errorDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.white, fontSize: 11, lineHeight: 14, fontFamily: fonts.monoBold },
});
