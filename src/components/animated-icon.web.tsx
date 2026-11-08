import { StyleSheet, Text } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

export function AnimatedSplashOverlay() {
  return null;
}

export function AnimatedIcon() {
  const reduceMotion = useReducedMotion();

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(220)}
      style={styles.iconContainer}
    >
      <Text style={styles.brandMark}>m</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: '#EEE9F8',
  },
  brandMark: {
    color: '#67539B',
    fontSize: 42,
    fontWeight: '800',
  },
});
