import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme } from './ThemeProvider';
import { typography, type TypographyVariant } from './typography';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  tone?: 'default' | 'muted' | 'accent' | 'danger';
}

export function Text({ variant = 'body', tone = 'default', style, ...rest }: TextProps) {
  const { colors } = useTheme();
  const color =
    tone === 'muted'
      ? colors.textMuted
      : tone === 'accent'
        ? colors.accent
        : tone === 'danger'
          ? colors.danger
          : colors.text;
  return <RNText style={[typography[variant], { color }, style]} {...rest} />;
}
