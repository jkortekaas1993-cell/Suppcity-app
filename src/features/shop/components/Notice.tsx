import { View } from 'react-native';

import { Button, Icon, radius, Text, useTheme } from '@/ui';

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
  const { colors, space } = useTheme();
  const danger = tone === 'danger';
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        borderWidth: 1,
        borderColor: danger ? colors.error : colors.border,
        borderRadius: radius.md,
        padding: space.md + 2,
        gap: space.sm,
        backgroundColor: danger ? colors.errorMuted : colors.bg2,
      }}
    >
      <View style={{ flexDirection: 'row', gap: space.sm + 2, alignItems: 'flex-start' }}>
        <Icon name="info" size={18} color={danger ? colors.error : colors.text2} />
        <Text variant="caption" tone={danger ? 'danger' : 'default'} style={{ flex: 1, fontSize: 14, lineHeight: 19 }}>
          {message}
        </Text>
      </View>
      {action || onDismiss ? (
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          {action ? <Button label={action.label} variant="secondary" size="sm" onPress={action.onPress} /> : null}
          {onDismiss ? <Button label="Sluiten" variant="ghost" size="sm" onPress={onDismiss} /> : null}
        </View>
      ) : null}
    </View>
  );
}
