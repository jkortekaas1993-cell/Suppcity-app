import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

import { Text } from './Text';
import { useTheme } from './ThemeProvider';

export interface CardProps extends ViewProps {
  /** Small uppercase label above the content, e.g. "VORIGE KEER". */
  eyebrow?: string;
  /** Accent stripe on the left edge for live/active state. */
  highlighted?: boolean;
  children?: ReactNode;
}

export function Card({ eyebrow, highlighted = false, style, children, ...rest }: CardProps) {
  const { colors, radius, space } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderLeftWidth: highlighted ? 4 : 1,
          borderLeftColor: highlighted ? colors.accent : colors.border,
          borderRadius: radius.md,
          padding: space.lg,
          gap: space.sm,
        },
        style,
      ]}
      {...rest}
    >
      {eyebrow ? (
        <Text variant="label" tone="muted">
          {eyebrow}
        </Text>
      ) : null}
      {children}
    </View>
  );
}
