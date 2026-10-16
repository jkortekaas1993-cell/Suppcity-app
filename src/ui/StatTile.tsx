import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Icon } from './icons';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { layout, radius } from './tokens';
import { useTheme } from './ThemeProvider';

export interface StatTileProps {
  /** Eyebrow above the number ("EIWIT VANDAAG", "ZWAARSTE SET"). */
  label?: string;
  /** The number, already formatted for nl-NL ("18,4", "2.775", "52:08"). */
  value: string;
  /** Unit after the number, baseline-aligned ("ton", "kg × 3", "/ 180 g"). */
  unit?: string;
  /** Small line under the number ("oefeningen", "duur"). */
  caption?: string;
  /**
   * Change vs. previous period. 'up' renders green with an arrow; 'down'/'flat' stay neutral grey
   * (no red: progress talk stays positive).
   */
  delta?: { label: string; direction?: 'up' | 'down' | 'flat' };
  /** sm 26 (inside a hero card), md 32 (default), lg 36 (Vandaag tiles). */
  size?: 'sm' | 'md' | 'lg';
  /** No card background/border: for stats inside a hero card. */
  bare?: boolean;
  /** Extra content under the number (e.g. a ProgressBar). */
  footer?: ReactNode;
  onPress?: () => void;
  /** Full sentence for screen readers; defaults to "label value unit". */
  accessibilityLabel?: string;
  testID?: string;
}

const SIZE = { sm: 26, md: 32, lg: 36 } as const;

/** A number with a label. The numbers are the hero of this app: keep labels short. */
export function StatTile({
  label,
  value,
  unit,
  caption,
  delta,
  size = 'md',
  bare = false,
  footer,
  onPress,
  accessibilityLabel,
  testID,
}: StatTileProps) {
  const { colors, space } = useTheme();
  const fontSize = SIZE[size];
  const a11y = accessibilityLabel ?? [label, value, unit, caption, delta?.label].filter(Boolean).join(', ');

  const inner = (
    <View
      style={
        bare
          ? { gap: space.xxs }
          : {
              backgroundColor: colors.bg1,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radius.md,
              padding: layout.cardPadding,
              gap: space.xs + 2,
            }
      }
    >
      {label ? (
        <Text variant="eyebrow" tone="secondary" numberOfLines={1}>
          {label}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.xs, flexWrap: 'wrap' }}>
        <Text
          variant="metric"
          style={{ fontSize, lineHeight: fontSize + 2 }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {value}
        </Text>
        {unit ? (
          <Text variant="caption" tone="tertiary" tnum>
            {unit}
          </Text>
        ) : null}
      </View>
      {caption ? (
        <Text variant="caption" tone="tertiary" style={{ fontSize: 12, lineHeight: 16 }}>
          {caption}
        </Text>
      ) : null}
      {delta ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          {delta.direction === 'up' ? <Icon name="trend-up" size={12} color={colors.success} strokeWidth={2.5} /> : null}
          <Text
            variant="caption"
            tone={delta.direction === 'up' ? 'success' : 'secondary'}
            tnum
            style={{ fontSize: 12, lineHeight: 16 }}
          >
            {delta.label}
          </Text>
        </View>
      ) : null}
      {footer}
    </View>
  );

  if (onPress) {
    return (
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={a11y}
        onPress={onPress}
        testID={testID}
        haptic={false}
        containerStyle={{ flex: 1 }}
      >
        {inner}
      </PressableScale>
    );
  }
  return (
    <View accessible accessibilityLabel={a11y} testID={testID} style={{ flex: 1 }}>
      {inner}
    </View>
  );
}
