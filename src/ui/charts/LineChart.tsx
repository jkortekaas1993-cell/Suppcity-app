import { useEffect, useId, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';

import { motion } from '../tokens';

import { Text } from '../Text';
import { useTheme } from '../ThemeProvider';
import { areaPath, linePath, niceDomain, toPoints, yFor, type Frame } from './scale';

export interface LinePoint {
  /** The value (kg, e1RM, kg volume). */
  value: number;
  /** Mark this point as a PR (gold dot). */
  pr?: boolean;
}

export interface LineChartProps {
  data: readonly LinePoint[];
  /**
   * Required one-sentence summary for screen readers (the chart itself is an image):
   * "Geschat 1RM bench press stijgt van 94 naar 108 kilo in zes maanden".
   */
  accessibilityLabel: string;
  /** X labels, one per data point; empty strings are skipped ("mei", "", "jul", …). */
  xLabels?: readonly string[];
  /** Format y tick labels (default: integer, nl-NL). */
  formatY?: (v: number) => string;
  /** Plot height in px (default 150). Width fills the parent. */
  height?: number;
  /** Series colour; default accent (data series 0). */
  color?: string;
  /** Legend under the chart: series name, plus "PR" when any point is a PR. */
  legend?: string;
  testID?: string;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

/** Length of a polyline through the points (for the draw-in dash). */
function polylineLength(points: readonly { x: number; y: number }[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a && b) len += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return len;
}

const PAD: Omit<Frame, 'width' | 'height'> = { left: 4, right: 30, top: 20, bottom: 22 };
const defaultFormat = (v: number) => Math.round(v).toLocaleString('nl-NL');

/**
 * Progress line with gradient area and gold PR dots (Voortgang mockup). Own SVG, no chart lib.
 * Grid lines + right-aligned y labels on nice ticks; the last PR gets a larger ringed dot.
 */
export function LineChart({
  data,
  accessibilityLabel,
  xLabels,
  formatY = defaultFormat,
  height = 150,
  color,
  legend,
  testID,
}: LineChartProps) {
  const { colors, fonts, space } = useTheme();
  const [width, setWidth] = useState(0);
  const gradientId = `lc-fill-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const stroke = color ?? colors.data[0];

  const values = data.map((d) => d.value);
  const domain = niceDomain(values, 2);
  const frame: Frame = { width, height, ...PAD };
  const points = toPoints(values, domain, frame);
  const baseY = height - PAD.bottom;
  const lastPr = data.reduce((acc, d, i) => (d.pr ? i : acc), -1);
  const hasPr = lastPr >= 0;
  const font = fonts.regular;

  // Draw-in: the line draws itself (0.8 s), then the PR dots fade in. Replays when the data
  // changes (period switch). Static with "reduce motion".
  const reduceMotion = useReducedMotion();
  const length = Math.ceil(polylineLength(points)) + 2;
  const drawn = useSharedValue(reduceMotion ? 1 : 0);
  const signature = `${width}|${values.join(',')}`;
  useEffect(() => {
    if (reduceMotion || width === 0) {
      drawn.set(1);
      return;
    }
    drawn.set(0);
    drawn.set(withTiming(1, { duration: motion.draw, easing: Easing.out(Easing.cubic) }));
  }, [signature, reduceMotion, width, drawn]);
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - drawn.get()) }));
  const dotsProps = useAnimatedProps(() => ({ opacity: Math.max(0, (drawn.get() - 0.85) / 0.15) }));
  const areaProps = useAnimatedProps(() => ({ opacity: drawn.get() }));

  return (
    <View testID={testID} style={{ gap: space.sm + 2 }}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
        onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))}
        style={{ height }}
      >
        {width > 0 && data.length > 0 ? (
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={stroke} stopOpacity={0.28} />
                <Stop offset="1" stopColor={stroke} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {domain.ticks.map((t) => {
              const y = yFor(t, domain, frame);
              return (
                <Line key={`g${t}`} x1={0} y1={y} x2={width} y2={y} stroke={colors.border} strokeWidth={1} />
              );
            })}
            {domain.ticks.map((t) => (
              <SvgText
                key={`t${t}`}
                x={width}
                y={yFor(t, domain, frame) - 4}
                textAnchor="end"
                fontSize={10}
                fill={colors.text3}
                fontFamily={font}
              >
                {formatY(t)}
              </SvgText>
            ))}
            {points.length > 1 ? (
              <AnimatedPath d={areaPath(points, baseY)} fill={`url(#${gradientId})`} animatedProps={areaProps} />
            ) : null}
            <AnimatedPath
              d={linePath(points)}
              fill="none"
              stroke={stroke}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={`${length} ${length}`}
              animatedProps={lineProps}
            />
            <AnimatedG animatedProps={dotsProps}>
              {points.map((p, i) =>
                data[i]?.pr ? (
                  i === lastPr ? (
                    <Circle key={`p${i}`} cx={p.x} cy={p.y} r={5} fill={colors.gold} stroke={colors.bg0} strokeWidth={2} />
                  ) : (
                    <Circle key={`p${i}`} cx={p.x} cy={p.y} r={4} fill={colors.gold} />
                  )
                ) : null,
              )}
            </AnimatedG>
            {xLabels?.map((label, i) => {
              const p = points[i];
              if (!label || !p) return null;
              const anchor = i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle';
              return (
                <SvgText
                  key={`x${i}`}
                  x={p.x}
                  y={height - 4}
                  textAnchor={anchor}
                  fontSize={10}
                  fill={colors.text3}
                  fontFamily={font}
                >
                  {label}
                </SvgText>
              );
            })}
          </Svg>
        ) : null}
      </View>
      {legend ? (
        <View
          style={{ flexDirection: 'row', gap: space.md + 2 }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 }}>
            <View style={{ width: 12, height: 3, borderRadius: 2, backgroundColor: stroke }} />
            <Text variant="caption" tone="secondary" style={{ fontSize: 12 }}>
              {legend}
            </Text>
          </View>
          {hasPr ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold }} />
              <Text variant="caption" tone="secondary" style={{ fontSize: 12 }}>
                PR
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
