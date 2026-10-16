import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '../Text';
import { colors as palette } from '../tokens';
import { BrandMark } from './BrandMark';
import { Skyline } from './Skyline';

export interface BrandIntroProps {
  /** Total time on screen before the fade-out starts, ms. Default 900. */
  holdMs?: number;
}

const bg = palette.dark.bg0;

/**
 * Cold-start intro that continues the native splash (same dark background, same logo):
 * the logo settles, the skyline rises, then the overlay fades into the app. Under one second,
 * never blocks input after it fades, and is skipped entirely with "reduce motion".
 */
export function BrandIntro({ holdMs = 900 }: BrandIntroProps) {
  const reduceMotion = useReducedMotion();
  const [done, setDone] = useState(false);
  const mark = useSharedValue(0);
  const fade = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    mark.set(withTiming(1, { duration: 500, easing: Easing.out(Easing.back(1.4)) }));
    fade.set(withDelay(holdMs, withTiming(0, { duration: 280 })));
    // Unmount after the fade so the overlay costs nothing afterwards.
    const id = setTimeout(() => setDone(true), holdMs + 320);
    return () => clearTimeout(id);
  }, [reduceMotion, holdMs, mark, fade]);

  const overlay = useAnimatedStyle(() => ({ opacity: fade.get() }));
  const markStyle = useAnimatedStyle(() => ({
    opacity: mark.get(),
    transform: [{ scale: 0.9 + mark.get() * 0.1 }],
  }));

  if (reduceMotion || done) return null;

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { backgroundColor: bg, zIndex: 100 }, overlay]}
    >
      <View style={{ position: 'absolute', left: -20, right: -20, bottom: 0 }}>
        <Skyline reveal="rise" opacity={0.9} duration={600} style={{ width: '100%' }} />
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, paddingBottom: 160 }}>
        <Animated.View style={markStyle}>
          <BrandMark size={128} />
        </Animated.View>
        <Animated.View style={[{ alignItems: 'center', gap: 6 }, markStyle]}>
          <Text variant="display" style={{ letterSpacing: 3 }}>
            SUPP CITY
          </Text>
          <Text variant="eyebrow" tone="accent" style={{ letterSpacing: 2.4 }}>
            Train · Track · Bestel
          </Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}
