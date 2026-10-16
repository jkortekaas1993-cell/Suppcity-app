import { Pressable, View } from 'react-native';

import { Text } from './Text';
import { useTheme } from './ThemeProvider';

export interface SectionLabelProps {
  /** Uppercase eyebrow: "WEEKDOEL", "MIJLPALEN · 9 VAN 24", "VANDAAG · TRAININGSDAG". */
  label: string;
  /** Right side value (tabular): "2 van 4 trainingen". */
  value?: string;
  /** Right side link: "Alles", "Opnieuw bestellen". Ignored when `value` is set. */
  action?: { label: string; onPress: () => void; accessibilityLabel?: string };
  testID?: string;
}

/** Section header above a block of content. Marked as a header for screen readers. */
export function SectionLabel({ label, value, action, testID }: SectionLabelProps) {
  const { space } = useTheme();
  return (
    <View
      testID={testID}
      style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.md }}
    >
      <Text variant="eyebrow" tone="secondary" accessibilityRole="header" style={{ flexShrink: 1 }}>
        {label}
      </Text>
      {value ? (
        <Text variant="caption" tnum style={{ fontSize: 13 }}>
          {value}
        </Text>
      ) : action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="link"
          accessibilityLabel={action.accessibilityLabel ?? action.label}
          hitSlop={{ top: 14, bottom: 14, left: 12, right: 12 }}
        >
          {({ pressed }: { pressed: boolean }) => (
            <Text variant="bodyStrong" tone="accent" style={{ fontSize: 13, opacity: pressed ? 0.6 : 1 }}>
              {action.label}
            </Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

/** Hairline separator in the border colour. */
export function Divider({ inset = 0 }: { inset?: number }) {
  const { colors } = useTheme();
  return <View style={{ height: 1, marginLeft: inset, backgroundColor: colors.border }} />;
}
