import { ActivityIndicator, View } from 'react-native';

import { Button, Text, useTheme } from '@/ui';

/** Loading / error placeholder for async sections. */
export function LoadState({ loading, error, onRetry }: { loading: boolean; error: string | null; onRetry?: () => void }) {
  const { colors, space } = useTheme();
  if (loading) {
    return (
      <View style={{ paddingVertical: space.xl, alignItems: 'center' }}>
        <ActivityIndicator color={colors.text2} accessibilityLabel="Laden" />
      </View>
    );
  }
  if (!error) return null;
  return (
    <View style={{ gap: space.md, alignItems: 'flex-start' }} accessibilityLiveRegion="polite">
      <Text tone="secondary">{error}</Text>
      {onRetry ? <Button label="Opnieuw proberen" variant="secondary" size="sm" onPress={onRetry} /> : null}
    </View>
  );
}
