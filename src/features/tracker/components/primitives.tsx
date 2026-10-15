import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';

import { HIT_SLOP_MIN, Text, useTheme } from '@/ui';

import { formatNumberNl, parseDecimalInput } from '../logic/format';
import { normalizeSeries } from '../logic/progress';

/** Square 48pt text-glyph button (no icon font dependency). */
export function IconButton({
  glyph,
  label,
  onPress,
  onLongPress,
  active = false,
  tone = 'default',
  disabled = false,
  testID,
}: {
  glyph: string;
  label: string;
  onPress?: () => void;
  onLongPress?: () => void;
  active?: boolean;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  testID?: string;
}) {
  const { colors, radius } = useTheme();
  const fg = active ? colors.textOnAccent : tone === 'danger' ? colors.danger : colors.text;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      hitSlop={4}
      style={({ pressed }) => ({
        width: HIT_SLOP_MIN,
        height: HIT_SLOP_MIN,
        borderRadius: radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: active ? colors.accent : pressed ? colors.border : colors.surfaceRaised,
        borderWidth: 1,
        borderColor: active ? colors.accent : colors.border,
        opacity: disabled ? 0.4 : 1,
      })}
    >
      <Text variant="heading" style={{ color: fg, fontSize: 18 }}>
        {glyph}
      </Text>
    </Pressable>
  );
}

/** Small selectable pill for filters. */
export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors, radius, space } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        minHeight: 36,
        paddingHorizontal: space.md,
        justifyContent: 'center',
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: selected ? colors.accent : colors.border,
        backgroundColor: selected ? colors.surfaceRaised : 'transparent',
      }}
    >
      <Text variant="label" tone={selected ? 'accent' : 'muted'}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Row({ children, gap }: { children: ReactNode; gap?: number }) {
  const { space } = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: gap ?? space.sm, flexWrap: 'wrap' }}>{children}</View>;
}

/** Big tabular number with a label underneath (summary tiles). */
export function Stat({ label, value }: { label: string; value: string }) {
  const { space } = useTheme();
  return (
    <View style={{ flexGrow: 1, flexBasis: '40%', gap: space.xxs }}>
      <Text variant="metric" style={{ fontSize: 24, lineHeight: 28 }}>
        {value}
      </Text>
      <Text variant="label" tone="muted">
        {label}
      </Text>
    </View>
  );
}

export function TextField(props: TextInputProps) {
  const { colors, radius, space } = useTheme();
  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      {...props}
      style={[
        {
          minHeight: HIT_SLOP_MIN,
          paddingHorizontal: space.md,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surfaceRaised,
          color: colors.text,
          fontSize: 16,
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
 */
export function NumberField({
  value,
  onChange,
  decimals,
  placeholder,
  accessibilityLabel,
  done = false,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  decimals: number;
  placeholder?: string;
  accessibilityLabel: string;
  done?: boolean;
}) {
  const { colors, radius } = useTheme();
  const toText = (v: number | null) => (v === null ? '' : formatNumberNl(v, decimals));
  const [text, setText] = useState(() => toText(value));

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
      placeholderTextColor={colors.textMuted}
      keyboardType={decimals > 0 ? 'decimal-pad' : 'number-pad'}
      selectTextOnFocus
      returnKeyType="done"
      onChangeText={(t) => {
        setText(t);
        const n = parseDecimalInput(t);
        if (t.trim() === '') onChange(null);
        else if (n !== null) onChange(decimals === 0 ? Math.round(n) : n);
      }}
      onBlur={() => setText(toText(value))}
      style={{
        flex: 1,
        minHeight: 44,
        textAlign: 'center',
        borderRadius: radius.sm,
        backgroundColor: done ? 'transparent' : colors.surfaceRaised,
        borderWidth: 1,
        borderColor: done ? 'transparent' : colors.border,
        color: colors.text,
        fontSize: 18,
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
      }}
    />
  );
}

/** Simple bar chart drawn with Views (react-native-svg is not a dependency). */
export function BarChart({
  values,
  labels,
  height = 120,
  accessibilityLabel,
}: {
  values: number[];
  labels: string[];
  height?: number;
  accessibilityLabel: string;
}) {
  const { colors, space, radius } = useTheme();
  const scaled = normalizeSeries(values);
  return (
    <View accessible accessibilityLabel={accessibilityLabel} style={{ gap: space.xs }}>
      <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: space.xs }}>
        {scaled.map((h, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: Math.max(2, h * height),
              borderTopLeftRadius: radius.sm,
              borderTopRightRadius: radius.sm,
              backgroundColor: i === scaled.length - 1 ? colors.accent : colors.border,
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="caption" tone="muted">
          {labels[0] ?? ''}
        </Text>
        <Text variant="caption" tone="muted">
          {labels[labels.length - 1] ?? ''}
        </Text>
      </View>
    </View>
  );
}

/** Header row for stack screens: back button + title. */
export function StackHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
  const { space } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <IconButton glyph="‹" label="Terug" onPress={onBack} />
      <Text variant="title" numberOfLines={1} style={{ flex: 1 }} accessibilityRole="header">
        {title}
      </Text>
      {right}
    </View>
  );
}
