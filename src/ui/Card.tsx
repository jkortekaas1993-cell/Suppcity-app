import type { ReactNode } from 'react';
import { View, type ViewProps, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Skyline } from './brand/Skyline';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { BRAND_LIGHT, elevation, layout, radius } from './tokens';
import { useTheme } from './ThemeProvider';

export type CardVariant = 'default' | 'hero' | 'gold' | 'inset' | 'brand';

export interface CardProps extends ViewProps {
  /** Small uppercase label above the content, e.g. "VOLGENDE TRAINING". */
  eyebrow?: string;
  /**
   * default = bg1 card with hairline border. hero = turquoise gradient (ONE per screen: the
   * next workout, the active challenge). gold = PR celebration. inset = bg2 well inside a card.
   * brand = solid Supp City turquoise with dark text (shop banner; at most one per screen).
   */
  variant?: CardVariant;
  /**
   * Draw the logo skyline along the bottom edge (decorative, behind the content).
   * Use on at most one card per screen: the hero, the shop banner, the points card.
   */
  skyline?: boolean;
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
  skyline = false,
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
  const isBrand = variant === 'brand';
  const isHero = variant === 'hero' || variant === 'gold' || isBrand;
  const pad = padding ?? (isHero ? layout.heroPadding : layout.cardPadding);

  const frame: ViewStyle = {
    borderRadius: isHero ? radius.xl : radius.lg,
    borderWidth: isBrand ? 0 : 1,
    borderColor:
      variant === 'hero' ? colors.accentBorder : variant === 'gold' ? colors.goldBorder : colors.border,
    backgroundColor: variant === 'inset' ? colors.bg2 : colors.bg1,
    padding: pad,
    gap: gap ?? (isHero ? space.lg : space.sm),
    overflow: 'hidden',
    ...(highlighted ? { borderLeftWidth: 4, borderLeftColor: colors.accent } : null),
    // Depth for hero cards. Android elevation renders with overflow hidden; on iOS the shadow
    // is clipped by it, which is acceptable (the gradient and hairline still give the depth).
    ...(isHero ? elevation.hero : null),
  };

  const content = (
    <>
      {skyline ? (
        // Bottom half only, so the tallest towers never run behind the card's text.
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: '55%', overflow: 'hidden', justifyContent: 'flex-end' }}
        >
          <Skyline
            color={isBrand ? colors.onAccent : variant === 'gold' ? colors.gold : colors.accent}
            opacity={isBrand ? 0.22 : 0.16}
            style={{ width: '100%' }}
          />
        </View>
      ) : null}
      {variant === 'inset' || isBrand ? null : (
        // Hairline top highlight: the "lit from above" edge of the premium cards.
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 16, right: 16, height: 1, backgroundColor: colors.highlight }}
        />
      )}
      {eyebrow ? (
        <Text
          variant="eyebrow"
          tone={variant === 'hero' ? 'accent' : variant === 'gold' ? 'gold' : isBrand ? undefined : 'secondary'}
          style={isBrand ? { color: colors.onAccent } : undefined}
        >
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
        colors={
          isBrand
            ? [colors.accent, BRAND_LIGHT]
            : variant === 'hero'
              ? [colors.accentMuted, colors.bg1]
              : [colors.goldMuted, colors.bg1]
        }
        locations={isBrand ? [0, 1] : variant === 'hero' ? [0, 0.62] : [0, 0.7]}
        // ≈ CSS linear-gradient(160deg, …) from the mockups; gold is top-centre (radial look).
        start={variant === 'gold' ? { x: 0.5, y: 0 } : { x: 0.2, y: 0 }}
        end={variant === 'gold' ? { x: 0.5, y: 1 } : { x: 0.8, y: 1 }}
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
