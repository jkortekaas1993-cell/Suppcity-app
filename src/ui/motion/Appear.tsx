import { useEffect, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { motion } from '../tokens';

export interface AppearProps {
  /** Position in the screen's card stack: delay = index × motion.stagger. */
  index?: number;
  /** Rise distance in px. Default 14. */
  distance?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/**
 * Enter animation for cards on a screen: fade in while rising 14 px, staggered by index
 * (60 ms apart). Plays once on mount. With "reduce motion" the content is simply there.
 */
export function Appear({ index = 0, distance = 14, style, children }: AppearProps) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      t.set(1);
      return;
    }
    t.set(
      withDelay(
        Math.min(index, 8) * motion.stagger,
        withTiming(1, { duration: motion.enter, easing: Easing.out(Easing.cubic) }),
      ),
    );
    // Mount-only: re-renders must not replay the entrance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animated = useAnimatedStyle(() => ({
    opacity: t.get(),
    transform: [{ translateY: (1 - t.get()) * distance }],
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
