import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/ui';

import { StackHeader } from './primitives';

/**
 * Full-screen layout for tracker stack routes (workout, exercise, routine).
 * Keeps taps working while the keyboard is open (tick a set without
 * dismissing the keyboard first).
 */
export function StackScreen({
  title,
  children,
  right,
  footer,
}: {
  title: string;
  children: ReactNode;
  right?: ReactNode;
  footer?: ReactNode;
}) {
  const router = useRouter();
  const { colors, space } = useTheme();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/trainen'));
  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm }}>
          <StackHeader title={title} onBack={back} right={right} />
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, gap: space.lg, paddingBottom: space.xxxl }}
        >
          {children}
        </ScrollView>
        {footer ? (
          <View
            style={{
              padding: space.lg,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
