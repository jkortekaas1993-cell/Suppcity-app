import { TextInput, View, type TextInputProps } from 'react-native';

import { HIT_SLOP_MIN, Text, useTheme } from '@/ui';

export interface FieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  hint?: string;
  error?: string | null;
  /** Unit shown right of the input, e.g. "g". */
  suffix?: string;
}

/** Labelled text input in the design-system style (numbers use tabular figures). */
export function Field({ label, hint, error, suffix, ...input }: FieldProps) {
  const { colors, radius, space } = useTheme();
  return (
    <View style={{ gap: space.xs }}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: HIT_SLOP_MIN,
          borderWidth: 1,
          borderColor: error ? colors.danger : colors.border,
          borderRadius: radius.sm,
          backgroundColor: colors.surfaceRaised,
          paddingHorizontal: space.md,
        }}
      >
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.textMuted}
          style={{ flex: 1, color: colors.text, fontSize: 16, fontVariant: ['tabular-nums'], paddingVertical: space.sm }}
          {...input}
        />
        {suffix ? <Text tone="muted">{suffix}</Text> : null}
      </View>
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
