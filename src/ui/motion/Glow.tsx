import { useId } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { useTheme } from '../ThemeProvider';

export interface GlowProps {
  /** Glow colour. Default accent. */
  color?: string;
  /** Peak opacity in the centre. Default 0.22. */
  intensity?: number;
  /** Position and size (usually absolute, larger than the area it lights). */
  style?: StyleProp<ViewStyle>;
}

/**
 * Soft radial light behind content: the top of Vandaag, behind the rest timer, gold behind a
 * PR. Pure SVG, so it renders identically on Android (no blur or shadow spread needed).
 * Decorative and non-interactive.
 */
export function Glow({ color, intensity = 0.22, style }: GlowProps) {
  const { colors } = useTheme();
  const id = `glow-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const c = color ?? colors.accent;
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={style}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={c} stopOpacity={intensity} />
            <Stop offset="1" stopColor={c} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx="50%" cy="50%" rx="50%" ry="50%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
