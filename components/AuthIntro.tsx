import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/constants/theme';

interface AuthIntroProps {
  children: React.ReactNode;
}

// Brief solid-color brand moment before the sign-in/sign-up form fades in.
// Replaces the old illustrated background for a sleeker first impression —
// purely time-based, not gated on any real loading.
const INTRO_HOLD_MS = 450;
const FADE_MS = 380;

export default function AuthIntro({ children }: AuthIntroProps) {
  const [introVisible, setIntroVisible] = useState(true);
  const introOpacity = useRef(new Animated.Value(1)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(introOpacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
        Animated.timing(contentOpacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
      ]).start(() => setIntroVisible(false));
    }, INTRO_HOLD_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.fill, { opacity: contentOpacity }]}>
        {children}
      </Animated.View>
      {introVisible && (
        <Animated.View style={[styles.intro, { opacity: introOpacity }]} pointerEvents="none">
          <Text style={styles.wordmark}>Lingo</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.sky },
  fill: { flex: 1 },
  intro: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.sky,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    fontSize: 30,
    fontFamily: fonts.cozy,
    color: colors.inkDark,
    letterSpacing: -0.5,
  },
});
