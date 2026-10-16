import { TextInput, View, type TextInputProps } from 'react-native';

import { HIT_SLOP_MIN, radius, Text, useTheme } from '@/ui';

export interface FieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  hint?: string;
  error?: string | null;
  /** Unit shown right of the input, e.g. "g". */
  suffix?: string;
}

/** Labelled text input (bg2 well, 48 high; numbers use tabular figures). */
export function Field({ label, hint, error, suffix, ...input }: FieldProps) {
  const { colors, space, type } = useTheme();
  return (
    <View style={{ gap: space.xs + 2 }}>
      <Text variant="eyebrow" tone="secondary">
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: HIT_SLOP_MIN,
          borderWidth: 1,
          borderColor: error ? colors.error : colors.border,
          borderRadius: radius.control,
          backgroundColor: colors.bg2,
          paddingHorizontal: space.md + 2,
          gap: space.sm,
        }}
      >
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.text3}
          style={{ ...type.body, flex: 1, color: colors.text1, fontSize: 16, fontVariant: ['tabular-nums'], paddingVertical: space.sm }}
          {...input}
        />
        {suffix ? (
          <Text variant="caption" tone="tertiary">
            {suffix}
          </Text>
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="tertiary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
