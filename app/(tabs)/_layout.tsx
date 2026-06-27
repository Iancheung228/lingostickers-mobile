import { View, Text, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { BookOpen, Camera, Users } from 'lucide-react-native';
import { useChallenges } from '@/hooks/useChallenges';
import { useFriends } from '@/hooks/useFriends';

function ChallengeBadge({ count }: { count: number }) {
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
    top: -4,
    right: -8,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  text: { color: '#fff', fontSize: 10, fontWeight: '800' },
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
          backgroundColor: '#F5F0E8',
          borderTopColor: '#E5E7EB',
          height: 80,
          paddingBottom: 20,
        },
        tabBarActiveTintColor: '#A7D7C5',
        tabBarInactiveTintColor: '#9E9E9E',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
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
          tabBarIcon: ({ color, size }) => <Camera size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Friends',
          tabBarIcon: ({ color, size }) => (
            <View>
              <Users size={size} color={color} />
              <ChallengeBadge count={pendingCount + pendingRequestCount} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
