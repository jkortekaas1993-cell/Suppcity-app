import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { Glow } from './motion/Glow';
import { motion, type ThemeColors } from './tokens';
import { useTheme } from './ThemeProvider';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type ProgressTone = 'accent' | 'gold' | 'success' | 'neutral';

function toneFill(colors: ThemeColors, tone: ProgressTone): string {
  switch (tone) {
    case 'accent':
      return colors.accent;
    case 'gold':
      return colors.gold;
    case 'success':
      return colors.success;
    case 'neutral':
      return colors.text2;
  }
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

export interface ProgressBarProps {
  /** 0..1 (clamped). */
  value: number;
  /** Track height: 4 (tiles), 6 (stock), 8 (BarList). Default 4. */
  height?: number;
  /** accent = progress toward your goal; gold = running low / attention (never red). */
  tone?: ProgressTone;
  /** Screen-reader text, e.g. "Eiwit 112 van 180 gram". Omit when the numbers are already read nearby. */
  accessibilityLabel?: string;
  testID?: string;
}

/** Thin rounded progress line ("112 / 180 g", stock left). */
export function ProgressBar({ value, height = 4, tone = 'accent', accessibilityLabel, testID }: ProgressBarProps) {
  const { colors } = useTheme();
  const v = clamp01(value);
  return (
    <View
      testID={testID}
      accessible={accessibilityLabel !== undefined}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}
      style={{ height, borderRadius: height / 2, backgroundColor: colors.bg3, overflow: 'hidden' }}
    >
      <View style={{ width: `${v * 100}%`, height, borderRadius: height / 2, backgroundColor: toneFill(colors, tone) }} />
    </View>
  );
}

export interface SegmentBarProps {
  /** Number of segments (weekly goal 3–7, monthly challenge 12). */
  total: number;
  /** Segments filled. */
  filled: number;
  /** Default 6; use 8 for the challenge. */
  height?: number;
  tone?: ProgressTone;
  /** e.g. "Weekdoel: 2 van 4 trainingen". Required: segments carry meaning. */
  accessibilityLabel: string;
  testID?: string;
}

/** Discrete goal progress: one segment per workout. Used for weekdoel and the monthly challenge. */
export function SegmentBar({ total, filled, height = 6, tone = 'accent', accessibilityLabel, testID }: SegmentBarProps) {
  const { colors } = useTheme();
  const n = Math.max(1, Math.floor(total));
  const dense = n > 7;
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: n, now: Math.min(n, Math.max(0, filled)) }}
      style={{ flexDirection: 'row', gap: dense ? 4 : 6 }}
    >
      {Array.from({ length: n }, (_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height,
            borderRadius: dense ? 2 : height / 2,
            backgroundColor: i < filled ? toneFill(colors, tone) : colors.bg3,
          }}
        />
      ))}
    </View>
  );
}

export interface RingProps {
  /** 0..1 (clamped). */
  progress: number;
  /** Outer size in px. Default 64 (rest timer). */
  size?: number;
  strokeWidth?: number;
  tone?: ProgressTone;
  /** Centre content (time, kcal). */
  children?: ReactNode;
  /** e.g. "Rusttimer, 1 minuut 24 over". */
  accessibilityLabel?: string;
  /**
   * Fill from 0 on mount (weekly goal, kcal). Leave off for live values (rest timer): those
   * glide 300 ms between updates instead.
   */
  animateIn?: boolean;
  /** Soft light behind the ring (the running rest timer). */
  glow?: boolean;
  testID?: string;
}

/** Circular progress (rest timer, kcal, weekly goal). Starts at 12 o'clock, runs clockwise. */
export function Ring({
  progress,
  size = 64,
  strokeWidth = 6,
  tone = 'accent',
  children,
  accessibilityLabel,
  animateIn = false,
  glow = false,
  testID,
}: RingProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const v = clamp01(progress);
  const shown = useSharedValue(animateIn && !reduceMotion ? 0 : v);

  useEffect(() => {
    if (reduceMotion) {
      shown.set(v);
      return;
    }
    shown.set(
      withTiming(v, {
        duration: animateIn ? motion.draw : 300,
        easing: animateIn ? Easing.out(Easing.cubic) : Easing.linear,
      }),
    );
  }, [v, animateIn, reduceMotion, shown]);

  const arc = useAnimatedProps(() => ({ strokeDashoffset: circ * (1 - shown.get()) }));
  const fill = toneFill(colors, tone);

  return (
    <View
      testID={testID}
      accessible={accessibilityLabel !== undefined}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      {glow ? (
        <Glow
          color={fill}
          intensity={0.35}
          style={{ position: 'absolute', left: -size * 0.3, top: -size * 0.3, width: size * 1.6, height: size * 1.6 }}
        />
      ) : null}
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.bg3} strokeWidth={strokeWidth} fill="none" />
        {v > 0 ? (
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={fill}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${circ} ${circ}`}
            animatedProps={arc}
            fill="none"
          />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}
