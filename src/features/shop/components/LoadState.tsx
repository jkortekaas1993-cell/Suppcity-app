import { ActivityIndicator, View } from 'react-native';

import { Button, Text, useTheme } from '@/ui';

/** Loading / error placeholder for async sections. */
export function LoadState({ loading, error, onRetry }: { loading: boolean; error: string | null; onRetry?: () => void }) {
  const { colors, space } = useTheme();
  if (loading) {
    return (
      <View style={{ padding: space.lg, alignItems: 'center' }}>
        <ActivityIndicator color={colors.accent} accessibilityLabel="Laden" />
      </View>
    );
  }
  if (!error) return null;
  return (
    <View style={{ gap: space.sm }}>
      <Text tone="danger">{error}</Text>
      {onRetry ? <Button label="Opnieuw proberen" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}
