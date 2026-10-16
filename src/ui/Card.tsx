import type { ReactNode } from 'react';
import { View, type ViewProps, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { layout, radius } from './tokens';
import { useTheme } from './ThemeProvider';

export type CardVariant = 'default' | 'hero' | 'gold' | 'inset';

export interface CardProps extends ViewProps {
  /** Small uppercase label above the content, e.g. "VOLGENDE TRAINING". */
  eyebrow?: string;
  /**
   * default = bg1 card with hairline border. hero = turquoise gradient (ONE per screen: the
   * next workout, the active challenge). gold = PR celebration. inset = bg2 well inside a card.
   */
  variant?: CardVariant;
  /** @deprecated release-1 accent stripe; prefer variant="hero" or a Pill. */
  highlighted?: boolean;
  /** Override inner padding (default 14, hero 20). Use 0 for row lists (ListRow inside). */
  padding?: number;
  /** Gap between children (default 8). */
  gap?: number;
  /** Makes the whole card tappable (scale + haptic). Give it an accessibilityLabel. */
  onPress?: () => void;
  children?: ReactNode;
}

export function Card({
  eyebrow,
  variant = 'default',
  highlighted = false,
  padding,
  gap,
  onPress,
  style,
  children,
  accessibilityLabel,
  accessibilityHint,
  testID,
  ...rest
}: CardProps) {
  const { colors, space } = useTheme();
  const isHero = variant === 'hero' || variant === 'gold';
  const pad = padding ?? (isHero ? layout.heroPadding : layout.cardPadding);

  const frame: ViewStyle = {
    borderRadius: variant === 'gold' ? radius.xl : isHero ? radius.lg : radius.md,
    borderWidth: 1,
    borderColor: variant === 'hero' ? colors.accentBorder : variant === 'gold' ? colors.goldBorder : colors.border,
    backgroundColor: variant === 'inset' ? colors.bg2 : colors.bg1,
    padding: pad,
    gap: gap ?? (isHero ? space.lg : space.sm),
    overflow: 'hidden',
    ...(highlighted ? { borderLeftWidth: 4, borderLeftColor: colors.accent } : null),
  };

  const content = (
    <>
      {eyebrow ? (
        <Text variant="eyebrow" tone={variant === 'hero' ? 'accent' : variant === 'gold' ? 'gold' : 'secondary'}>
          {eyebrow}
        </Text>
      ) : null}
      {children}
    </>
  );

  // `style` merges into the card itself (release-1 callers pass e.g. { padding: 0 }).
  const body = (extra: ViewProps) =>
    isHero ? (
      <LinearGradient
        {...extra}
        colors={variant === 'hero' ? [colors.accentMuted, colors.bg1] : [colors.goldMuted, colors.bg1]}
        locations={variant === 'hero' ? [0, 0.62] : [0, 0.7]}
        // ≈ CSS linear-gradient(160deg, …) from the mockups; gold is top-centre (radial look).
        start={variant === 'hero' ? { x: 0.2, y: 0 } : { x: 0.5, y: 0 }}
        end={variant === 'hero' ? { x: 0.8, y: 1 } : { x: 0.5, y: 1 }}
        style={[frame, style]}
      >
        {content}
      </LinearGradient>
    ) : (
      <View {...extra} style={[frame, style]}>
        {content}
      </View>
    );

  if (onPress) {
    return (
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        testID={testID}
        onPress={onPress}
        haptic={false}
      >
        {body({})}
      </PressableScale>
    );
  }
  return body({ ...rest, accessibilityLabel, accessibilityHint, testID });
}
