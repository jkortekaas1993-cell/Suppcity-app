import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen, useTheme } from '@/ui';

/**
 * Pushed (non-tab) screen of the shop and account features: the design-system `Screen`
 * with a back chevron, the smaller "title" style and an optional sticky footer that
 * clears the home indicator.
 */
export function SubScreen({
  title,
  eyebrow,
  subtitle,
  children,
  footer,
  fallback = '/shop',
}: {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  children?: ReactNode;
  /** Sticky bottom area for the screen's one primary action. */
  footer?: ReactNode;
  /** Where "Terug" goes when there is no history (deep link). */
  fallback?: Href;
}) {
  const { space } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Screen
      title={title}
      eyebrow={eyebrow}
      subtitle={subtitle}
      onBack={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
      footer={footer ? <View style={{ gap: space.sm, paddingBottom: Math.max(0, insets.bottom - space.md) }}>{footer}</View> : undefined}
    >
      {children}
    </Screen>
  );
}
