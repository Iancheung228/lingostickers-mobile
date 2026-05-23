import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#E6F4FE' }}>
      <ActivityIndicator size="large" color="#3B82F6" />
    </View>
  );
}
