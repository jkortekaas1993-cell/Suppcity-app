import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { ReactNode } from 'react';

import type { ThemeColors } from './tokens';
import { useTheme } from './ThemeProvider';

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
  testID?: string;
}

/** Circular progress (rest timer, kcal). Starts at 12 o'clock, runs clockwise. */
export function Ring({ progress, size = 64, strokeWidth = 6, tone = 'accent', children, accessibilityLabel, testID }: RingProps) {
  const { colors } = useTheme();
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const v = clamp01(progress);
  return (
    <View
      testID={testID}
      accessible={accessibilityLabel !== undefined}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.bg3} strokeWidth={strokeWidth} fill="none" />
        {v > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={toneFill(colors, tone)}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${circ} ${circ}`}
            strokeDashoffset={circ * (1 - v)}
            fill="none"
          />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}
