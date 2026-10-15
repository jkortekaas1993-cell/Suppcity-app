import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native';

import { Text } from './Text';
import { HIT_SLOP_MIN } from './theme';
import { useTheme } from './ThemeProvider';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  /** primary = the one accent action on a screen. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  label,
  variant = 'primary',
  loading = false,
  fullWidth = false,
  disabled,
  ...rest
}: ButtonProps) {
  const { colors, radius, space } = useTheme();
  const isDisabled = disabled === true || loading;

  const bg = (pressed: boolean): string => {
    switch (variant) {
      case 'primary':
        return pressed ? colors.accentPressed : colors.accent;
      case 'danger':
        return colors.danger;
      case 'secondary':
        return pressed ? colors.border : colors.surfaceRaised;
      case 'ghost':
        return pressed ? colors.surfaceRaised : 'transparent';
    }
  };
  const fg = variant === 'primary' || variant === 'danger' ? colors.textOnAccent : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg(pressed),
          borderRadius: radius.sm,
          paddingHorizontal: space.xl,
          borderColor: variant === 'secondary' ? colors.border : 'transparent',
          opacity: isDisabled ? 0.5 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text variant="label" style={{ color: fg, fontSize: 14 }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: HIT_SLOP_MIN,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
