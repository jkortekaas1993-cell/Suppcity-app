import type { ReactNode } from 'react';
import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { haptics, type HapticKind } from './haptics';
import { motion } from './tokens';

export interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  children?: ReactNode | ((state: { pressed: boolean }) => ReactNode);
  /** Visual style (background, border, padding). Applied to the scaling inner view. */
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  /** Layout style for the outer touch area (margins, alignSelf, flex). */
  containerStyle?: StyleProp<ViewStyle>;
  /** Haptic on press. Default 'light'; pass false for none. */
  haptic?: HapticKind | false;
  /** Pressed scale. Default motion.pressScale (0.97). */
  scaleTo?: number;
}

/**
 * The tap primitive of the design system: scales to 0.97 while pressed (skipped with
 * "reduce motion"), fires a haptic on press. Build tappable things on this, not on bare Pressable.
 */
export function PressableScale({
  children,
  style,
  containerStyle,
  haptic = 'light',
  scaleTo = motion.pressScale,
  onPress,
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      style={containerStyle}
      onPressIn={(e: GestureResponderEvent) => {
        if (!reduceMotion) scale.set(withTiming(scaleTo, { duration: motion.fast }));
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        scale.set(withTiming(1, { duration: motion.base }));
        onPressOut?.(e);
      }}
      onPress={(e: GestureResponderEvent) => {
        if (haptic) haptics[haptic]();
        onPress?.(e);
      }}
    >
      {(state: { pressed: boolean }) => (
        <Animated.View style={[typeof style === 'function' ? style(state) : style, animated]}>
          {typeof children === 'function' ? children(state) : children}
        </Animated.View>
      )}
    </Pressable>
  );
}
