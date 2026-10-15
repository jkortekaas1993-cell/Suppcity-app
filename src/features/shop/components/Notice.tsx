import { View } from 'react-native';

import { Button, Text, useTheme } from '@/ui';

/** Inline message (no pop-up). tone=danger for errors. */
export function Notice({
  message,
  tone = 'default',
  onDismiss,
  action,
}: {
  message: string;
  tone?: 'default' | 'danger';
  onDismiss?: () => void;
  action?: { label: string; onPress: () => void };
}) {
  const { colors, radius, space } = useTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        borderWidth: 1,
        borderColor: tone === 'danger' ? colors.danger : colors.border,
        borderRadius: radius.sm,
        padding: space.md,
        gap: space.sm,
        backgroundColor: colors.surfaceRaised,
      }}
    >
      <Text tone={tone === 'danger' ? 'danger' : 'default'}>{message}</Text>
      {action || onDismiss ? (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {action ? <Button label={action.label} variant="secondary" onPress={action.onPress} /> : null}
          {onDismiss ? <Button label="Sluiten" variant="ghost" onPress={onDismiss} /> : null}
        </View>
      ) : null}
    </View>
  );
}
