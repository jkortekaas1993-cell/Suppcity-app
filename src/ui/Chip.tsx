import { View } from 'react-native';

import { haptics } from './haptics';
import { Icon, type IconName } from './icons';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { HIT_SLOP_MIN, radius } from './tokens';
import { useTheme } from './ThemeProvider';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  testID?: string;
}

const CHIP_H = 34;

/**
 * Filter/choice chip (shop categories, muscle filters). Selected = light fill (text1 on bg0),
 * NOT turquoise: turquoise is reserved for actions and live state. Put chips in a horizontal
 * ScrollView with gap 8.
 */
export function Chip({ label, selected = false, onPress, icon, testID }: ChipProps) {
  const { colors, space } = useTheme();
  const fg = selected ? colors.bg0 : colors.text2;
  const slop = (HIT_SLOP_MIN - CHIP_H) / 2;
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      haptic={false}
      onPressIn={() => haptics.selection()}
      hitSlop={{ top: slop, bottom: slop, left: 2, right: 2 }}
      style={{
        height: CHIP_H,
        paddingHorizontal: space.md + 2,
        borderRadius: radius.pill,
        borderWidth: selected ? 0 : 1,
        borderColor: colors.border,
        backgroundColor: selected ? colors.text1 : colors.bg1,
        justifyContent: 'center',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 }}>
        {icon ? <Icon name={icon} size={16} color={fg} /> : null}
        <Text variant="bodyStrong" style={{ color: fg, fontSize: 14 }} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

export interface SegmentedProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Screen-reader name of the group, e.g. "Weergave". */
  accessibilityLabel?: string;
  testID?: string;
}

/** 2–4 mutually exclusive views on one screen (Voortgang: Oefening / Week / Lichaam). */
export function Segmented<T extends string>({ options, value, onChange, accessibilityLabel, testID }: SegmentedProps<T>) {
  const { colors, space } = useTheme();
  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: 'row',
        gap: space.xs + 2,
        padding: space.xs,
        borderRadius: radius.control,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.bg1,
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <PressableScale
            key={o.value}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: active }}
            haptic={active ? false : 'selection'}
            onPress={() => {
              if (!active) onChange(o.value);
            }}
            containerStyle={{ flex: 1 }}
            style={{
              minHeight: 40,
              borderRadius: 7,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? colors.bg3 : 'transparent',
            }}
          >
            <Text variant="bodyStrong" tone={active ? 'default' : 'tertiary'} style={{ fontSize: 14 }} numberOfLines={1}>
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}
