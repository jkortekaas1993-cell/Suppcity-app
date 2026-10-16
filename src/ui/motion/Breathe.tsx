import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { motion } from '../tokens';
import { useTheme } from '../ThemeProvider';

export interface BreatheProps {
  /** Pulse only while true (e.g. a workout is planned today). Default true. */
  active?: boolean;
  /** Corner radius of the wrapped control, so the halo follows its shape. Default 14. */
  radius?: number;
  /** Halo colour. Default accent. */
  color?: string;
  /** Layout style of the wrapper (alignSelf, margins). */
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/**
 * A soft halo that grows out of the screen's ONE primary action and fades, every 2.4 s.
 * Invites the tap without moving the button itself. Off with "reduce motion".
 */
export function Breathe({ active = true, radius = 14, color, style, children }: BreatheProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);
  const on = active && !reduceMotion;

  useEffect(() => {
    if (!on) {
      cancelAnimation(t);
      t.set(0);
      return;
    }
    t.set(withRepeat(withTiming(1, { duration: motion.breathe, easing: Easing.out(Easing.quad) }), -1, false));
    return () => cancelAnimation(t);
  }, [on, t]);

  const halo = useAnimatedStyle(() => {
    // Grow 0 → 8 px and fade 0.45 → 0 in the first 70% of the period, rest quiet.
    const p = Math.min(1, t.get() / 0.7);
    return { opacity: on ? 0.45 * (1 - p) : 0, transform: [{ scaleX: 1 + p * 0.05 }, { scaleY: 1 + p * 0.3 }] };
  });

  return (
    <View style={style}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: radius, backgroundColor: color ?? colors.accent }, halo]}
      />
      {children}
    </View>
  );
}
