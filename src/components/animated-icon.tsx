import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  Keyframe,
  useReducedMotion,
} from 'react-native-reanimated';

const DURATION = 260;
const SPLASH_EXIT = new Keyframe({
  0: { opacity: 1 },
  65: { opacity: 1 },
  100: { opacity: 0, easing: Easing.out(Easing.cubic) },
});

function BrandMark() {
  return (
    <View style={styles.brandMark}>
      <Text style={styles.brandMarkText}>m</Text>
    </View>
  );
}

function BrandLockup() {
  return (
    <View style={styles.brandLockup}>
      <BrandMark />
      <View>
        <Text style={styles.wordmark}>moodcanvas</Text>
        <Text style={styles.tagline}>Your personal reflection journal</Text>
      </View>
    </View>
  );
}

export function AnimatedSplashOverlay() {
  const [animate, setAnimate] = useState(false);
  const [visible, setVisible] = useState(true);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!animate) return;

    const timeout = setTimeout(() => setVisible(false), DURATION);
    return () => clearTimeout(timeout);
  }, [animate]);

  if (!visible) return null;

  return animate ? (
    <Animated.View
      entering={SPLASH_EXIT.duration(DURATION)}
      style={styles.splashOverlay}
    >
      <BrandLockup />
    </Animated.View>
  ) : (
    <View
      onLayout={() => {
        SplashScreen.hideAsync()
          .then(() => {
            if (reduceMotion) {
              setVisible(false);
            } else {
              setAnimate(true);
            }
          })
          .catch((error: unknown) => {
            console.error('Hiding the splash screen failed:', error);
            setVisible(false);
          });
      }}
      style={styles.splashOverlay}
    >
      <BrandLockup />
    </View>
  );
}

export function AnimatedIcon() {
  const reduceMotion = useReducedMotion();

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(DURATION)}
      style={styles.iconContainer}
    >
      <BrandMark />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#F8F6FC',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 24,
  },
  brandMark: {
    width: 56,
    height: 56,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEE9F8',
  },
  brandMarkText: {
    color: '#67539B',
    fontSize: 32,
    fontWeight: '800',
  },
  wordmark: {
    color: '#51416F',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tagline: {
    color: '#777186',
    fontSize: 12,
    marginTop: 2,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 72,
    height: 72,
  },
});
