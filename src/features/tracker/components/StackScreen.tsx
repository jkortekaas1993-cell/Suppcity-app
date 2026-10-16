import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton, Text, useTheme } from '@/ui';

/**
 * Full-screen layout for tracker stack routes (exercise, routine, history, summary).
 * Same rhythm as `Screen` from `@/ui` (20pt gutter, 16pt gaps, back chevron + condensed title),
 * plus keyboard avoidance so a set can be ticked without dismissing the keyboard first.
 */
export function StackScreen({
  title,
  eyebrow,
  subtitle,
  children,
  right,
  footer,
  onBack,
  hideBack = false,
}: {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  children: ReactNode;
  right?: ReactNode;
  footer?: ReactNode;
  /** Defaults to router.back() (or Trainen when there is no history). */
  onBack?: () => void;
  /** For celebration screens that end with an explicit button. */
  hideBack?: boolean;
}) {
  const router = useRouter();
  const { colors, space, layout } = useTheme();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/trainen')));
  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.bg0 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          indicatorStyle="white"
          contentContainerStyle={{ paddingHorizontal: layout.screenPadding, gap: layout.screenGap, paddingBottom: space.xxl }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: hideBack ? 'flex-start' : 'center',
              gap: space.xs,
              paddingTop: space.md,
              marginLeft: hideBack ? 0 : -(space.md + 2),
            }}
          >
            {hideBack ? null : <IconButton icon="chevron-left" accessibilityLabel="Terug" onPress={back} color={colors.text1} />}
            <View style={{ flex: 1, gap: space.xs }}>
              {eyebrow ? (
                <Text variant="eyebrow" tone="tertiary">
                  {eyebrow}
                </Text>
              ) : null}
              <Text variant={hideBack ? 'display' : 'title'} accessibilityRole="header" numberOfLines={2}>
                {title}
              </Text>
              {subtitle ? <Text tone="secondary">{subtitle}</Text> : null}
            </View>
            {right}
          </View>
          {children}
        </ScrollView>
        {footer ? (
          <View
            style={{
              paddingHorizontal: layout.screenPadding,
              paddingVertical: space.md,
              gap: space.sm + 2,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.bg0,
            }}
          >
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
