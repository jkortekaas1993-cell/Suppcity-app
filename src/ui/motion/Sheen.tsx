import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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

export interface SheenProps {
  /** Peak white opacity of the band. Default 0.10. */
  intensity?: number;
}

const BAND = 70;

/**
 * A slow light band sweeping across a premium surface (the points card), like a bank card
 * under a lamp. Place inside a container with overflow hidden. Static with "reduce motion".
 */
export function Sheen({ intensity = 0.1 }: SheenProps) {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || width === 0) return;
    t.set(withRepeat(withTiming(1, { duration: motion.sheen, easing: Easing.inOut(Easing.quad) }), -1, false));
    return () => cancelAnimation(t);
  }, [reduceMotion, width, t]);

  const band = useAnimatedStyle(() => {
    // Sweep during the first 60% of the period, then rest off-card.
    const p = Math.min(1, t.get() / 0.6);
    return { transform: [{ translateX: -BAND * 2 + p * (width + BAND * 3) }, { skewX: '-20deg' }] };
  });

  if (reduceMotion) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={StyleSheet.absoluteFill}
    >
      <Animated.View style={[{ position: 'absolute', top: -40, bottom: -40, width: BAND }, band]}>
        <LinearGradient
          colors={['rgba(255,255,255,0)', `rgba(255,255,255,${intensity})`, 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}
