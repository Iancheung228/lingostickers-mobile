import { View, Text, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { BookOpen, Camera, Users } from 'lucide-react-native';
import { useChallenges } from '@/hooks/useChallenges';
import { useFriends } from '@/hooks/useFriends';
import { colors, shadows, radii } from '@/constants/theme';

function Badge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <View style={badge.dot}>
      <Text style={badge.text}>{count > 9 ? '9+' : String(count)}</Text>
    </View>
  );
}

const badge = StyleSheet.create({
  dot: {
    position: 'absolute',
    top: -5,
    right: -9,
    backgroundColor: colors.error,
    borderRadius: radii.full,
    minWidth: 17,
    height: 17,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: colors.card,
  },
  text: { color: colors.card, fontSize: 10, fontWeight: '800' },
});

export default function TabLayout() {
  const { pendingCount } = useChallenges();
  const { friends } = useFriends();
  const pendingRequestCount = friends.filter(f => f.status === 'pending' && !f.is_requester).length;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.borderLight,
          borderTopWidth: 1,
          height: 82,
          paddingBottom: 18,
          paddingTop: 10,
          ...shadows.tab,
        },
        tabBarActiveTintColor: colors.terra,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="collection"
        options={{
          title: 'Collection',
          tabBarIcon: ({ color, size }) => <BookOpen size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color, focused }) => (
            <View style={[tabIcon.scanWrap, focused && tabIcon.scanWrapActive]}>
              <Camera size={24} color={focused ? colors.card : colors.inkMid} />
            </View>
          ),
          tabBarLabel: ({ color }) => (
            <Text style={[tabIcon.scanLabel, { color }]}>Scan</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Friends',
          tabBarIcon: ({ color, size }) => (
            <View>
              <Users size={size} color={color} />
              <Badge count={pendingCount + pendingRequestCount} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const tabIcon = StyleSheet.create({
  scanWrap: {
    width: 52,
    height: 52,
    borderRadius: radii.full,
    backgroundColor: colors.inkFaint,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
    ...shadows.button,
  },
  scanWrapActive: {
    backgroundColor: colors.terra,
  },
  scanLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: -4,
  },
});
