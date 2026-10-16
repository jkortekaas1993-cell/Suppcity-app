import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { haptics } from './haptics';
import { Icon, type IconName } from './icons';
import { Text, type TextTone } from './Text';
import { HIT_SLOP_MIN, layout, radius } from './tokens';
import { useTheme } from './ThemeProvider';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Right-aligned value, tabular ("100 kg × 5", "22 over", "~6 dagen"). */
  value?: string;
  valueTone?: TextTone;
  /** An icon name (drawn in a 40×40 bg2 well) or any node (check box, avatar, initials). */
  leading?: IconName | ReactNode;
  /** Custom right side (a small Button, Switch). Rendered after `value`. */
  trailing?: ReactNode;
  /** Show a chevron (navigates somewhere). Defaults to true when onPress is set and no trailing. */
  chevron?: boolean;
  /** Hairline under the row (rows stacked inside a Card with padding 0). */
  divider?: boolean;
  /** Done state: title struck through and dimmed (supplement taken). */
  done?: boolean;
  /** Title in error colour ("Account verwijderen"). */
  destructive?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

function isIconName(v: unknown): v is IconName {
  return typeof v === 'string';
}

/** One row in a list/card: settings, supplements, orders, exercises. Min height 56. */
export function ListRow({
  title,
  subtitle,
  value,
  valueTone = 'default',
  leading,
  trailing,
  chevron,
  divider = false,
  done = false,
  destructive = false,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: ListRowProps) {
  const { colors, space } = useTheme();
  const showChevron = chevron ?? (onPress !== undefined && trailing === undefined);

  return (
    <Pressable
      testID={testID}
      onPress={
        onPress
          ? () => {
              haptics.selection();
              onPress();
            }
          : undefined
      }
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel ?? [title, subtitle, value].filter(Boolean).join(', ')}
      accessibilityHint={accessibilityHint}
      accessibilityState={done ? { checked: true } : undefined}
      style={({ pressed }) => ({
        minHeight: HIT_SLOP_MIN + space.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: space.md,
        paddingHorizontal: layout.cardPadding,
        backgroundColor: pressed && onPress ? colors.bg2 : 'transparent',
        borderBottomWidth: divider ? 1 : 0,
        borderBottomColor: colors.border,
      })}
    >
      {leading === undefined || leading === null ? null : isIconName(leading) ? (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.control,
            backgroundColor: colors.bg2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={leading} size={20} color={colors.text2} />
        </View>
      ) : (
        leading
      )}
      <View style={{ flex: 1, gap: space.xxs }}>
        <Text
          variant="bodyStrong"
          tone={destructive ? 'danger' : done ? 'secondary' : 'default'}
          style={done ? { textDecorationLine: 'line-through' } : null}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="tertiary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="caption" tone={valueTone} tnum>
          {value}
        </Text>
      ) : null}
      {trailing}
      {showChevron ? <Icon name="chevron-right" size={18} color={colors.text3} /> : null}
    </Pressable>
  );
}
