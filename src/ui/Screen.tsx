import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from './Text';
import { useTheme } from './ThemeProvider';

export interface ScreenProps {
  title: string;
  /** One line under the title, muted. */
  subtitle?: string;
  children?: ReactNode;
  scroll?: boolean;
}

/** Standard tab screen: big uppercase title, safe-area aware, themed background. */
export function Screen({ title, subtitle, children, scroll = true }: ScreenProps) {
  const { colors, space } = useTheme();
  const body = (
    <View style={{ padding: space.lg, gap: space.lg }}>
      <View style={{ gap: space.xs, paddingTop: space.sm }}>
        <Text variant="display" accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text tone="muted">{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      {scroll ? <ScrollView contentInsetAdjustmentBehavior="automatic">{body}</ScrollView> : body}
    </SafeAreaView>
  );
}
