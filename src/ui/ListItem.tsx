import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from './Text';
import { HIT_SLOP_MIN } from './theme';
import { useTheme } from './ThemeProvider';

export interface ListItemProps {
  title: string;
  subtitle?: string;
  /** Right-aligned value, rendered with tabular figures (e.g. "100 kg × 5"). */
  value?: string;
  leading?: ReactNode;
  onPress?: () => void;
  testID?: string;
}

export function ListItem({ title, subtitle, value, leading, onPress, testID }: ListItemProps) {
  const { colors, space } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => ({
        minHeight: HIT_SLOP_MIN + space.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: space.md,
        paddingHorizontal: space.lg,
        backgroundColor: pressed ? colors.surfaceRaised : 'transparent',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      })}
    >
      {leading}
      <View style={{ flex: 1, gap: space.xxs }}>
        <Text variant="heading">{title}</Text>
        {subtitle ? (
          <Text variant="caption" tone="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="heading" style={{ fontVariant: ['tabular-nums'] }}>
          {value}
        </Text>
      ) : null}
    </Pressable>
  );
}
