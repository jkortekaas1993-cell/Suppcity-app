import { View } from 'react-native';

import { ProgressBar, type ProgressTone } from '../Progress';
import { Text } from '../Text';
import { useTheme } from '../ThemeProvider';

export interface BarListItem {
  label: string;
  value: number;
  /** Optional per-row tone (e.g. gold for "almost out of stock"). */
  tone?: ProgressTone;
  /** Text on the right; defaults to the value. */
  valueLabel?: string;
}

export interface BarListProps {
  items: readonly BarListItem[];
  /** Value that fills the bar; default = the largest value. */
  max?: number;
  /** Width of the label column (default 76). */
  labelWidth?: number;
  /** Bar thickness (default 8; stock list uses 6). */
  barHeight?: number;
  /** Unit for screen readers ("sets", "dagen"). */
  unit?: string;
  testID?: string;
}

/** Horizontal bars with label and value: sets per muscle group, stock left per supplement. */
export function BarList({ items, max, labelWidth = 76, barHeight = 8, unit, testID }: BarListProps) {
  const { space } = useTheme();
  const top = max ?? Math.max(0, ...items.map((i) => i.value));
  return (
    <View testID={testID} style={{ gap: space.sm + 2 }}>
      {items.map((item) => {
        const shown = item.valueLabel ?? item.value.toLocaleString('nl-NL');
        return (
          <View
            key={item.label}
            accessible
            accessibilityLabel={`${item.label}: ${shown}${unit ? ` ${unit}` : ''}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.md - 2 }}
          >
            <Text variant="caption" tone="secondary" numberOfLines={1} style={{ width: labelWidth }}>
              {item.label}
            </Text>
            <View style={{ flex: 1 }}>
              <ProgressBar value={top > 0 ? item.value / top : 0} height={barHeight} tone={item.tone ?? 'accent'} />
            </View>
            <Text variant="bodyStrong" tnum align="right" style={{ minWidth: 28, fontSize: 13, lineHeight: 18 }}>
              {shown}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
