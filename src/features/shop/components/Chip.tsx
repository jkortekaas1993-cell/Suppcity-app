import { Pressable } from 'react-native';

import { HIT_SLOP_MIN, Text, useTheme } from '@/ui';

/** Selectable option (variants, units). */
export function Chip({
  label,
  selected,
  disabled = false,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors, radius, space } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={{
        minHeight: HIT_SLOP_MIN,
        justifyContent: 'center',
        paddingHorizontal: space.lg,
        borderRadius: radius.sm,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? colors.accent : colors.border,
        backgroundColor: colors.surfaceRaised,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <Text variant="heading" style={{ fontSize: 15 }}>
        {label}
      </Text>
    </Pressable>
  );
}
