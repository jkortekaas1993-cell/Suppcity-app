import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { haptics } from './haptics';
import { Text } from './Text';
import { layout, motion } from './tokens';
import { useTheme } from './ThemeProvider';

export interface LiveDotProps {
  /** Default 8. */
  size?: number;
  /** Pulse (default true). Always static with "reduce motion". */
  pulsing?: boolean;
}

/** Turquoise "live now" dot: a running workout or timer. Never decorative elsewhere. */
export function LiveDot({ size = 8, pulsing = true }: LiveDotProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!pulsing || reduceMotion) {
      opacity.set(1);
      return;
    }
    opacity.set(
      withRepeat(
        withSequence(withTiming(0.3, { duration: motion.pulse }), withTiming(1, { duration: motion.pulse })),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(opacity);
  }, [pulsing, reduceMotion, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View
      style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.accent }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

export interface LiveBarProps {
  /** Eyebrow: "Bezig" or "Rust". */
  status: string;
  /** Workout title. */
  title: string;
  /** Elapsed or countdown, already formatted ("24:12", "1:24"). */
  time: string;
  /** 0..1 rest progress; draws a line along the top edge. Omit when not resting. */
  progress?: number;
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
}

/**
 * The bar above the tab bar while a workout runs (presentational; ActiveWorkoutBar owns the logic).
 * Training-only: never shows commercial content.
 */
export function LiveBar({ status, title, time, progress, onPress, accessibilityLabel, testID }: LiveBarProps) {
  const { colors, space } = useTheme();
  const p = progress === undefined ? undefined : Math.min(1, Math.max(0, progress));
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        haptics.light();
        onPress();
      }}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.bg2 : colors.bg1,
        borderTopWidth: 1,
        borderTopColor: colors.accentBorder,
      })}
    >
      {p !== undefined ? (
        <View style={{ position: 'absolute', top: -1, left: 0, right: 0, height: 2 }}>
          <View style={{ width: `${p * 100}%`, height: 2, backgroundColor: colors.accent }} />
        </View>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          paddingHorizontal: layout.screenPadding,
          paddingVertical: space.sm,
          minHeight: 56,
        }}
      >
        <LiveDot />
        <View style={{ flex: 1, gap: space.xxs }}>
          <Text variant="eyebrow" tone="accent">
            {status}
          </Text>
          <Text variant="bodyStrong" numberOfLines={1}>
            {title}
          </Text>
        </View>
        <Text variant="metric" style={{ fontSize: 26, lineHeight: 28 }} accessibilityElementsHidden>
          {time}
        </Text>
      </View>
    </Pressable>
  );
}
