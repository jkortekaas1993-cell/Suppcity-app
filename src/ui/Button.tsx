import { ActivityIndicator, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import type { HapticKind } from './haptics';
import { Icon, type IconName } from './icons';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { HIT_SLOP_MIN, layout, radius } from './tokens';
import { useTheme } from './ThemeProvider';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'link' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  /**
   * primary = the ONE accent action on a screen. secondary = neutral filled. ghost = quiet text
   * ("Skip"). link = accent text without fill ("+ Set toevoegen", "Bestel"). danger = destructive.
   */
  variant?: ButtonVariant;
  /** lg 52 (screen CTA), md 48 (default), sm 40 (inline; hit area still 48). */
  size?: ButtonSize;
  /** Leading icon. */
  icon?: IconName;
  loading?: boolean;
  fullWidth?: boolean;
  /** Default: 'light' for primary, none for the rest. */
  haptic?: HapticKind | false;
  /** Outer layout style (margins, flex). */
  style?: StyleProp<ViewStyle>;
}

const HEIGHT: Record<ButtonSize, number> = { sm: 40, md: 48, lg: layout.buttonHeight };

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  fullWidth = false,
  disabled,
  haptic,
  style,
  ...rest
}: ButtonProps) {
  const { colors, space } = useTheme();
  const isDisabled = disabled === true || loading;
  const height = HEIGHT[size];
  const slop = Math.max(0, (HIT_SLOP_MIN - height) / 2);

  const palette = (pressed: boolean): { bg: string; fg: string; border: string } => {
    switch (variant) {
      case 'primary':
        return { bg: pressed ? colors.accentPressed : colors.accent, fg: colors.onAccent, border: 'transparent' };
      case 'secondary':
        return { bg: pressed ? colors.bg3 : colors.bg2, fg: colors.text1, border: colors.border };
      case 'ghost':
        return { bg: pressed ? colors.bg2 : 'transparent', fg: colors.text2, border: 'transparent' };
      case 'link':
        return { bg: pressed ? colors.bg2 : 'transparent', fg: colors.accentText, border: 'transparent' };
      case 'danger':
        return { bg: pressed ? colors.bg3 : colors.errorMuted, fg: colors.error, border: 'transparent' };
    }
  };

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      haptic={haptic ?? (variant === 'primary' ? 'light' : false)}
      hitSlop={slop > 0 ? { top: slop, bottom: slop, left: 0, right: 0 } : undefined}
      containerStyle={[{ alignSelf: fullWidth ? 'stretch' : 'flex-start', opacity: isDisabled ? 0.45 : 1 }, style]}
      style={({ pressed }) => {
        const p = palette(pressed);
        return {
          minHeight: height,
          paddingHorizontal: size === 'sm' ? space.md + 2 : space.xl,
          borderRadius: size === 'sm' ? radius.sm : radius.control,
          backgroundColor: p.bg,
          borderColor: p.border,
          borderWidth: p.border === 'transparent' ? 0 : 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.sm,
        };
      }}
      {...rest}
    >
      {({ pressed }) => {
        const { fg } = palette(pressed);
        return loading ? (
          <ActivityIndicator color={fg} />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 18} color={fg} strokeWidth={2.2} /> : null}
            <Text variant="button" style={{ color: fg, fontSize: size === 'sm' ? 14 : size === 'md' ? 15 : 16 }} numberOfLines={1}>
              {label}
            </Text>
          </View>
        );
      }}
    </PressableScale>
  );
}
