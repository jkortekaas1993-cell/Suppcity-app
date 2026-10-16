import { Pressable, View } from 'react-native';

import { haptics, HIT_SLOP_MIN, radius, Text, useTheme } from '@/ui';

/**
 * One choice in a radio group (product flavour, stock unit). Same look as the design
 * system Chip (selected = light fill, not turquoise) but taller (44) and announced as a radio.
 */
export function OptionChip({
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
  const { colors, space } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, selected, disabled }}
      accessibilityLabel={label}
      onPress={() => {
        if (!selected) haptics.selection();
        onPress();
      }}
      disabled={disabled}
      hitSlop={{ top: (HIT_SLOP_MIN - 44) / 2, bottom: (HIT_SLOP_MIN - 44) / 2 }}
      style={({ pressed }) => ({
        minHeight: 44,
        justifyContent: 'center',
        paddingHorizontal: space.lg,
        borderRadius: radius.pill,
        borderWidth: selected ? 0 : 1,
        borderColor: colors.border,
        backgroundColor: selected ? colors.text1 : pressed ? colors.bg2 : colors.bg1,
        opacity: disabled ? 0.45 : 1,
      })}
    >
      <View>
        <Text variant="bodyStrong" style={{ color: selected ? colors.bg0 : colors.text2, fontSize: 14 }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
