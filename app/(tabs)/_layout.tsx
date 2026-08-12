import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookOpen, Calendar, Camera, Sticker as StickerIcon, Users } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useChallenges } from '@/hooks/useChallenges';
import { useFriends } from '@/hooks/useFriends';
import { colors, shadows, radii } from '@/constants/theme';
import { TAB_BAR_HEIGHT, TAB_BAR_BOTTOM_MARGIN, TAB_BAR_WIDTH, TAB_BAR_ITEM_WIDTH, TAB_BAR_SCAN_ITEM_WIDTH } from '@/constants/tabBar';

// Every tab gets the same treatment: a dark, legible icon by default, and a
// soft rounded "area effect" behind it when active — no separate outlier
// styling per tab, so the pill reads as one clean, consistent object.
function TabIcon({ Icon, focused, badgeCount }: { Icon: LucideIcon; focused: boolean; badgeCount?: number }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Icon size={20} color={focused ? colors.sageDark : colors.inkMid} />
      {!!badgeCount && <Badge count={badgeCount} />}
    </View>
  );
}

function Badge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <View style={styles.badgeDot}>
      <Text style={styles.badgeText}>{count > 9 ? '9+' : String(count)}</Text>
    </View>
  );
}

// Scan is the one action that actually produces stickers — everything else
// in this bar is just a way to browse what scanning made. Its own solid
// color makes it read as the bar's one deliberate call to action rather
// than a fifth peer of Collection/Calendar/Wall/Friends, but it sits
// in-line with the rest of the row instead of floating above it.
// Intentionally the same regardless of `focused` — a CTA, not a destination
// you "arrive at" the way the other four are.
function ScanTabIcon() {
  return (
    <View style={styles.scanWrap}>
      <Camera size={22} color={colors.white} strokeWidth={2.25} />
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const { pendingCount } = useChallenges();
  const { friends } = useFriends();
  const pendingRequestCount = friends.filter(f => f.status === 'pending' && !f.is_requester).length;

  return (
    <Tabs
      screenListeners={({ navigation }) => ({
        // isFocused() is false only when the pressed tab isn't the one
        // already showing — re-tapping the current tab stays silent, same
        // as native iOS/Android tab bars.
        tabPress: () => {
          if (!navigation.isFocused()) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        },
      })}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: 'absolute',
          // React Navigation's own default tab bar style sets `start: 0,
          // end: 0` (RN's logical left/right) to make it span edge-to-edge
          // — and per RN's own precedence rules, `start`/`end` win over
          // `left`/`right`/`width` when both are present. Overriding
          // `start`/`end` directly (not `left`/`width`) is what actually
          // takes effect; symmetric offsets fully determine both position
          // and width without a redundant, ambiguity-prone `width` key.
          start: (winW - TAB_BAR_WIDTH) / 2,
          end: (winW - TAB_BAR_WIDTH) / 2,
          bottom: insets.bottom + TAB_BAR_BOTTOM_MARGIN,
          height: TAB_BAR_HEIGHT,
          borderRadius: radii.full,
          borderTopWidth: 0,
          backgroundColor: colors.card,
          ...shadows.tab,
        },
        tabBarItemStyle: {
          width: TAB_BAR_ITEM_WIDTH,
          height: TAB_BAR_HEIGHT,
        },
        // The item's own flex:1 fills the full pill height, but its inner
        // layout still defaults to justifyContent: 'flex-start' (meant for
        // icon-above-label) — with tabBarShowLabel: false there's no label
        // to make room for, so the icon sat pinned near the top. That
        // inner layout isn't reachable via tabBarItemStyle at all; the icon
        // wrapper itself has to be told to grow and center within it.
        tabBarIconStyle: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        },
      }}
    >
      <Tabs.Screen
        name="collection"
        options={{
          title: 'Collection',
          tabBarIcon: ({ focused }) => <TabIcon Icon={BookOpen} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ focused }) => <TabIcon Icon={Calendar} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: () => <ScanTabIcon />,
          tabBarItemStyle: { width: TAB_BAR_SCAN_ITEM_WIDTH, height: TAB_BAR_HEIGHT },
        }}
      />
      <Tabs.Screen
        name="wall"
        options={{
          title: 'Wall',
          tabBarIcon: ({ focused }) => <TabIcon Icon={StickerIcon} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Friends',
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={Users} focused={focused} badgeCount={pendingCount + pendingRequestCount} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.sageLight,
  },
  scanWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.rust,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.rust,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  badgeDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: colors.error,
    borderRadius: radii.full,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: colors.card,
  },
  badgeText: { color: colors.card, fontSize: 9, fontWeight: '800' },
});
