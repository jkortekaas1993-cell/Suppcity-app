import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HIT_SLOP_MIN, Text, useTheme } from '@/ui';

/**
 * Pushed (non-tab) screen: back button + uppercase title, same rhythm as `Screen`.
 * Candidate for src/ui once the Architect agrees on a shared header.
 */
export function SubScreen({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  /** Sticky bottom area for the screen's one primary action. */
  footer?: ReactNode;
}) {
  const { colors, space } = useTheme();
  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Terug"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/shop'))}
        style={{ minHeight: HIT_SLOP_MIN, justifyContent: 'center', paddingHorizontal: space.lg }}
      >
        <Text variant="label" tone="muted">
          ‹ Terug
        </Text>
      </Pressable>
      <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled">
        <View style={{ padding: space.lg, paddingTop: 0, gap: space.lg }}>
          <View style={{ gap: space.xs }}>
            <Text variant="title" accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? <Text tone="muted">{subtitle}</Text> : null}
          </View>
          {children}
        </View>
      </ScrollView>
      {footer ? (
        <View
          style={{
            padding: space.lg,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.surface,
            gap: space.sm,
          }}
        >
          {footer}
        </View>
      ) : null}
    </SafeAreaView>
  );
}
