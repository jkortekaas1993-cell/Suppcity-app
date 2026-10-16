import { type PressableProps } from 'react-native';

import type { HapticKind } from './haptics';
import { Icon, type IconName } from './icons';
import { Badge } from './Pill';
import { PressableScale } from './PressableScale';
import { HIT_SLOP_MIN, TOUCH_MIN, radius } from './tokens';
import { useTheme } from './ThemeProvider';

export interface IconButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  icon: IconName;
  /** Required: an icon alone has no text ("Terug", "Meer opties", "Winkelwagen, 1 product"). */
  accessibilityLabel: string;
  /**
   * plain = icon only (back, more, settings). outline = round bg1 + border (header actions: cart,
   * profile). filled = bg2 square (add to cart, steppers). accent = the live/primary icon action.
   */
  variant?: 'plain' | 'outline' | 'filled' | 'accent';
  /** Visual size (default 44). The touch area is at least 48 via hitSlop. */
  size?: number;
  iconSize?: number;
  /** Icon colour override (default per variant). */
  color?: string;
  /** Count bubble (cart). */
  badge?: number;
  haptic?: HapticKind | false;
}

export function IconButton({
  icon,
  accessibilityLabel,
  variant = 'plain',
  size = TOUCH_MIN,
  iconSize,
  color,
  badge,
  haptic = false,
  disabled,
  ...rest
}: IconButtonProps) {
  const { colors } = useTheme();
  const slop = Math.max(0, (HIT_SLOP_MIN - size) / 2);
  const fg =
    color ??
    (variant === 'accent' ? colors.onAccent : variant === 'filled' ? colors.accentText : variant === 'plain' ? colors.text2 : colors.text1);

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: disabled === true }}
      disabled={disabled}
      haptic={haptic}
      hitSlop={slop > 0 ? slop : undefined}
      containerStyle={{ opacity: disabled ? 0.45 : 1 }}
      style={({ pressed }) => ({
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: variant === 'outline' ? size / 2 : variant === 'plain' ? size / 2 : radius.control,
        borderWidth: variant === 'outline' || variant === 'filled' ? 1 : 0,
        borderColor: colors.border,
        backgroundColor:
          variant === 'accent'
            ? pressed
              ? colors.accentPressed
              : colors.accent
            : variant === 'filled'
              ? pressed
                ? colors.bg3
                : colors.bg2
              : variant === 'outline'
                ? pressed
                  ? colors.bg2
                  : colors.bg1
                : pressed
                  ? colors.bg2
                  : 'transparent',
      })}
      {...rest}
    >
      <Icon name={icon} size={iconSize ?? Math.round(size * 0.47)} color={fg} />
      {badge !== undefined ? <Badge count={badge} /> : null}
    </PressableScale>
  );
}
