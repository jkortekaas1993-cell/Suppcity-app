import { Pressable, View } from 'react-native';

import { HIT_SLOP_MIN, Text, useTheme } from '@/ui';

/** − n + control with 48pt targets. */
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
  const { colors, radius } = useTheme();
  const btn = (text: string, next: number, a11y: string) => {
    const off = disabled || next < min || next > max;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={a11y}
        accessibilityState={{ disabled: off }}
        disabled={off}
        onPress={() => onChange(next)}
        style={({ pressed }) => ({
          width: HIT_SLOP_MIN,
          height: HIT_SLOP_MIN,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed ? colors.border : colors.surfaceRaised,
          opacity: off ? 0.4 : 1,
        })}
      >
        <Text variant="heading">{text}</Text>
      </Pressable>
    );
  };
  return (
    <View
      accessibilityLabel={`${label}: ${value}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.sm,
        overflow: 'hidden',
        alignSelf: 'flex-start',
      }}
    >
      {btn('−', value - 1, `${label} verlagen`)}
      <Text variant="heading" style={{ minWidth: 36, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      {btn('+', value + 1, `${label} verhogen`)}
    </View>
  );
}
