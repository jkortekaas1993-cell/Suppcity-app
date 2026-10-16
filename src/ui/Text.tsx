import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import type { ThemeColors } from './tokens';
import { useTheme } from './ThemeProvider';
import { tnum as tnumStyle, type TypographyVariant } from './typography';

export type TextTone =
  | 'default'
  | 'secondary'
  | 'tertiary'
  | 'accent'
  | 'onAccent'
  | 'success'
  | 'gold'
  | 'danger'
  /** @deprecated release-1 name; same as 'secondary'. */
  | 'muted';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  tone?: TextTone;
  /** Tabular figures (already on for hero/metric). Use for every number that changes. */
  tnum?: boolean;
  align?: 'left' | 'center' | 'right';
}

export function toneColor(colors: ThemeColors, tone: TextTone): string {
  switch (tone) {
    case 'secondary':
    case 'muted':
      return colors.text2;
    case 'tertiary':
      return colors.text3;
    case 'accent':
      return colors.accentText;
    case 'onAccent':
      return colors.onAccent;
    case 'success':
      return colors.success;
    case 'gold':
      return colors.gold;
    case 'danger':
      return colors.error;
    case 'default':
      return colors.text1;
  }
}

/** Themed text. Pick a `variant` from the type scale; do not set fontFamily/fontSize ad hoc. */
export function Text({ variant = 'body', tone = 'default', tnum = false, align, style, ...rest }: TextProps) {
  const { colors, type } = useTheme();
  return (
    <RNText
      style={[
        type[variant],
        { color: toneColor(colors, tone) },
        tnum ? tnumStyle : null,
        align ? { textAlign: align } : null,
        style,
      ]}
      maxFontSizeMultiplier={variant === 'hero' || variant === 'display' ? 1.3 : 1.6}
      {...rest}
    />
  );
}
