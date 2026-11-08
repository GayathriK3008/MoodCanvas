import { useEffect } from 'react';
import {
  Pressable,
  type StyleProp,
  type GestureResponderEvent,
  type PressableProps,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const ReanimatedPressable = Animated.createAnimatedComponent(Pressable);

type AnimatedPressableProps = Omit<PressableProps, 'style'> & {
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function AnimatedPressable({
  onPressIn,
  onPressOut,
  selected = false,
  style,
  ...props
}: AnimatedPressableProps) {
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(false);
  const selectionScale = useSharedValue(selected ? 1.015 : 1);

  useEffect(() => {
    selectionScale.value = withTiming(selected && !reduceMotion ? 1.015 : 1, {
      duration: 160,
    });
  }, [reduceMotion, selected, selectionScale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(pressed.value && !reduceMotion ? 0.92 : 1, {
      duration: 110,
    }),
    transform: [
      {
        scale: withTiming(
          pressed.value && !reduceMotion ? 0.975 : selectionScale.value,
          { duration: 110 },
        ),
      },
    ],
  }));

  function handlePressIn(event: GestureResponderEvent) {
    pressed.value = true;
    onPressIn?.(event);
  }

  function handlePressOut(event: GestureResponderEvent) {
    pressed.value = false;
    onPressOut?.(event);
  }

  return (
    <ReanimatedPressable
      {...props}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
    />
  );
}
