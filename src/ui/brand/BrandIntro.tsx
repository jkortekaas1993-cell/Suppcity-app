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
/** Must equal `imageWidth` of the expo-splash-screen plugin in app.json. */
const SPLASH_LOGO = 160;

/**
 * Cold-start intro that continues the native splash (same dark background, same logo in the
 * same place): the name fades in, the skyline rises, then the overlay fades into the app. Under one second,
 * never blocks input after it fades, and is skipped entirely with "reduce motion".
 */
export function BrandIntro({ holdMs = 900 }: BrandIntroProps) {
  const reduceMotion = useReducedMotion();
  const [done, setDone] = useState(false);
  const words = useSharedValue(0);
  const fade = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    words.set(withDelay(150, withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) })));
    fade.set(withDelay(holdMs, withTiming(0, { duration: 280 })));
    // Unmount after the fade so the overlay costs nothing afterwards.
    const id = setTimeout(() => setDone(true), holdMs + 320);
    return () => clearTimeout(id);
  }, [reduceMotion, holdMs, words, fade]);

  const overlay = useAnimatedStyle(() => ({ opacity: fade.get() }));
  const wordsStyle = useAnimatedStyle(() => ({
    opacity: words.get(),
    transform: [{ translateY: (1 - words.get()) * 10 }],
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
      {/* Logo exactly where and how big the native splash drew it (160 px, centred): no jump. */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <BrandMark size={SPLASH_LOGO} />
        <Animated.View
          style={[{ position: 'absolute', top: '50%', marginTop: SPLASH_LOGO / 2 + 20, alignItems: 'center', gap: 6 }, wordsStyle]}
        >
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
