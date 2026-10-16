import { useEffect, useState, type ReactNode } from 'react';
import { ScrollView, TextInput, View, type StyleProp, type TextInputProps, type TextStyle } from 'react-native';

import { HIT_SLOP_MIN, Text, tnum, useTheme } from '@/ui';

import { formatNumberNl, parseDecimalInput } from '../logic/format';

/** Horizontal row of chips that scrolls instead of wrapping (design-system rule for Chip). */
export function ChipRow({ children }: { children: ReactNode }) {
  const { space, layout } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={{ marginHorizontal: -layout.screenPadding }}
      contentContainerStyle={{ gap: space.sm, paddingHorizontal: layout.screenPadding, paddingVertical: space.xs }}
    >
      {children}
    </ScrollView>
  );
}

/** Wrapping row (buttons, small groups). */
export function Row({ children, gap }: { children: ReactNode; gap?: number }) {
  const { space } = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: gap ?? space.sm, flexWrap: 'wrap' }}>{children}</View>;
}

/** Single-line text input in the design-system style (bg2 well, strong border on focus). */
export function TextField(props: TextInputProps) {
  const { colors, radius, space, type } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={colors.text3}
      selectionColor={colors.accent}
      {...props}
      onFocus={(...args: Parameters<NonNullable<TextInputProps['onFocus']>>) => {
        setFocused(true);
        props.onFocus?.(...args);
      }}
      onBlur={(...args: Parameters<NonNullable<TextInputProps['onBlur']>>) => {
        setFocused(false);
        props.onBlur?.(...args);
      }}
      style={[
        type.body,
        {
          minHeight: HIT_SLOP_MIN,
          paddingHorizontal: space.md + 2,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: focused ? colors.borderStrong : colors.border,
          backgroundColor: colors.bg2,
          color: colors.text1,
        },
        props.style,
      ]}
    />
  );
}

/**
 * Numeric input that keeps the typed text (so "62," survives) and reports a
 * parsed number (or null) to the parent. Re-syncs when the value changes
 * from outside, e.g. when ticking a set copies "vorige keer".
 *
 * `done` renders it as plain text on the completed (accentMuted) set row.
 */
export function NumberField({
  value,
  onChange,
  decimals,
  placeholder,
  accessibilityLabel,
  done = false,
  align = 'center',
  style,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  decimals: number;
  placeholder?: string;
  accessibilityLabel: string;
  done?: boolean;
  align?: 'center' | 'right';
  style?: StyleProp<TextStyle>;
}) {
  const { colors, radius, type } = useTheme();
  const toText = (v: number | null) => (v === null ? '' : formatNumberNl(v, decimals));
  const [text, setText] = useState(() => toText(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (parseDecimalInput(text) !== value) setText(toText(value));
    // Only react to outside changes of `value`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <TextInput
      accessibilityLabel={accessibilityLabel}
      value={text}
      placeholder={placeholder}
      placeholderTextColor={colors.text3}
      selectionColor={colors.accent}
      keyboardType={decimals > 0 ? 'decimal-pad' : 'number-pad'}
      selectTextOnFocus
      returnKeyType="done"
      maxFontSizeMultiplier={1.3}
      onChangeText={(t) => {
        setText(t);
        const n = parseDecimalInput(t);
        if (t.trim() === '') onChange(null);
        else if (n !== null) onChange(decimals === 0 ? Math.round(n) : n);
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        setText(toText(value));
      }}
      style={[
        type.heading,
        tnum,
        {
          minHeight: 40,
          paddingHorizontal: 10,
          paddingVertical: 0,
          textAlign: align,
          borderRadius: radius.sm,
          backgroundColor: done ? 'transparent' : colors.bg2,
          borderWidth: 1,
          borderColor: focused ? colors.accent : done ? 'transparent' : colors.bg2,
          color: colors.text1,
          fontSize: 18,
          lineHeight: 22,
        },
        style,
      ]}
    />
  );
}

/** Small labelled field for compact forms (routine editor). */
export function LabeledField({ label, children }: { label: string; children: ReactNode }) {
  const { space } = useTheme();
  return (
    <View style={{ flex: 1, gap: space.xs }}>
      <Text variant="eyebrow" tone="tertiary" numberOfLines={1}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row' }}>{children}</View>
    </View>
  );
}
