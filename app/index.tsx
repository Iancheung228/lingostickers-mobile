import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { colors } from '@/constants/theme';

// The frame between the splash hiding and the root layout deciding where to
// route. It is only ever on screen for an instant, which is exactly why it
// has to be painted in the app's own colours — an off-palette flash here is
// the first thing every user sees on every cold launch.
export default function Index() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.terra} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.sky,
  },
});
