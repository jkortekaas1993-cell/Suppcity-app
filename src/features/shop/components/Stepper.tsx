import { View } from 'react-native';

import { IconButton, radius, Text, useTheme } from '@/ui';

/** − n + control (40 visual, 48 touch area via hitSlop). */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 20,
  disabled = false,
  label,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  /** For screen readers, e.g. "Aantal Creatine". */
  label: string;
}) {
  const { colors, space } = useTheme();
  const btn = (icon: 'minus' | 'plus', next: number, a11y: string) => (
    <IconButton
      icon={icon}
      size={40}
      iconSize={18}
      color={colors.text1}
      haptic="selection"
      accessibilityLabel={a11y}
      disabled={disabled || next < min || next > max}
      onPress={() => onChange(next)}
    />
  );
  return (
    <View
      accessibilityLabel={`${label}: ${value}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xxs,
        padding: space.xxs,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.control,
        backgroundColor: colors.bg2,
        alignSelf: 'flex-start',
      }}
    >
      {btn('minus', value - 1, `${label} verlagen`)}
      <Text variant="heading" tnum style={{ minWidth: 28, textAlign: 'center' }}>
        {value}
      </Text>
      {btn('plus', value + 1, `${label} verhogen`)}
    </View>
  );
}
