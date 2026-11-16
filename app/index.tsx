import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useTheme, useThemedStyles, type Theme } from '@/hooks/useTheme';

// The frame between the splash hiding and the root layout deciding where to
// route. It is only ever on screen for an instant, which is exactly why it
// has to be painted in the app's own colours — an off-palette flash here is
// the first thing every user sees on every cold launch.
export default function Index() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.terraInk} />
    </View>
  );
}

const makeStyles = ({ colors }: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.sky,
  },
});
