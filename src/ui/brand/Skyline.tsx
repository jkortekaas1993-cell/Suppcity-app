import { useEffect, useState } from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { motion } from '../tokens';
import { useTheme } from '../ThemeProvider';
import { SKYLINE_PATH, SKYLINE_VIEWBOX } from './skylinePath';

export type SkylineReveal = 'none' | 'rise' | 'sweep';

export interface SkylineProps {
  /** Fill colour. Default: accent. */
  color?: string;
  /** 0..1. Decorative backdrops use 0.10–0.22; the splash uses ~0.9. */
  opacity?: number;
  /**
   * none = static. rise = slides up and fades in (splash). sweep = lights up from left to
   * right (PR moment). Both are skipped with "reduce motion".
   */
  reveal?: SkylineReveal;
  /** Delay before the reveal, ms. */
  delay?: number;
  /** Duration of the reveal, ms. Default motion.draw. */
  duration?: number;
  /**
   * Position and size. The skyline keeps its aspect ratio and sits on the bottom edge, so
   * give it a width (often '100%') and let the height follow, or a height and let width follow.
   */
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const RATIO = SKYLINE_VIEWBOX.width / SKYLINE_VIEWBOX.height;

/**
 * The Supp City skyline from the logo, as a vector. Always decorative: hidden from screen
 * readers. One per screen at most, behind content (hero card, splash, PR moment, points card).
 */
export function Skyline({
  color,
  opacity = 0.14,
  reveal = 'none',
  delay = 0,
  duration = motion.draw,
  style,
  testID,
}: SkylineProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const animate = reveal !== 'none' && !reduceMotion;
  const progress = useSharedValue(animate ? 0 : 1);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!animate) {
      progress.set(1);
      return;
    }
    progress.set(withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.cubic) })));
  }, [animate, delay, duration, progress]);

  const riseStyle = useAnimatedStyle(() =>
    reveal === 'rise'
      ? { opacity: progress.get(), transform: [{ translateY: (1 - progress.get()) * 60 }] }
      : {},
  );
  const sweepStyle = useAnimatedStyle(() => (reveal === 'sweep' ? { width: width * progress.get() } : {}));

  const svg = (
    <Svg
      width={width || '100%'}
      height="100%"
      viewBox={`0 0 ${SKYLINE_VIEWBOX.width} ${SKYLINE_VIEWBOX.height}`}
      preserveAspectRatio="xMidYMax meet"
    >
      <Path d={SKYLINE_PATH} fill={color ?? colors.accent} fillRule="evenodd" />
    </Svg>
  );

  return (
    <View
      testID={testID}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))}
      style={[{ aspectRatio: RATIO, opacity }, style]}
    >
      {reveal === 'sweep' ? (
        <Animated.View style={[{ height: '100%', overflow: 'hidden' }, sweepStyle]}>{svg}</Animated.View>
      ) : (
        <Animated.View style={[{ flex: 1 }, riseStyle]}>{svg}</Animated.View>
      )}
    </View>
  );
}
