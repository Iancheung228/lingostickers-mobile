import { View, Text, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookOpen, Calendar, Camera, Sticker as StickerIcon, Users } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useChallenges } from '@/hooks/useChallenges';
import { useFriends } from '@/hooks/useFriends';
import { colors, shadows, radii } from '@/constants/theme';
import { TAB_BAR_HEIGHT, TAB_BAR_SIDE_MARGIN, TAB_BAR_BOTTOM_MARGIN } from '@/constants/tabBar';

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

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { pendingCount } = useChallenges();
  const { friends } = useFriends();
  const pendingRequestCount = friends.filter(f => f.status === 'pending' && !f.is_requester).length;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: 'absolute',
          left: TAB_BAR_SIDE_MARGIN,
          right: TAB_BAR_SIDE_MARGIN,
          bottom: insets.bottom + TAB_BAR_BOTTOM_MARGIN,
          height: TAB_BAR_HEIGHT,
          borderRadius: radii.full,
          borderTopWidth: 0,
          backgroundColor: colors.card,
          ...shadows.tab,
        },
        tabBarItemStyle: {
          height: TAB_BAR_HEIGHT,
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
          tabBarIcon: ({ focused }) => <TabIcon Icon={Camera} focused={focused} />,
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
