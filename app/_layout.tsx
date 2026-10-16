import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { Pressable, ScrollView, Text as RNText, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppServices } from '@/integration';
import { DatabaseProvider } from '@/lib/db';
import { ThemeProvider, useTheme } from '@/ui';

function RootStack() {
  const { scheme, colors } = useTheme();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <DatabaseProvider>
          {/* AppServices mounts ActiveWorkoutProvider and wires sync, account and points. */}
          <AppServices>
            <RootStack />
          </AppServices>
        </DatabaseProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/**
 * Last-resort screen: a render error anywhere below shows its message instead of
 * closing the app, so testers can send a screenshot. Plain RN styles on purpose:
 * the theme provider may be what failed.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, backgroundColor: '#0E1113', padding: 24, paddingTop: 72 }}>
      <RNText style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '700', marginBottom: 12 }}>
        Er ging iets mis
      </RNText>
      <RNText style={{ color: '#C9D1D6', fontSize: 15, marginBottom: 16 }}>
        Maak een schermafbeelding en stuur die naar Supp City. Daarmee kunnen we het oplossen.
      </RNText>
      <ScrollView style={{ flex: 1, backgroundColor: '#1A1F22', borderRadius: 8, padding: 12 }}>
        <RNText selectable style={{ color: '#FF8A80', fontFamily: 'monospace', fontSize: 12 }}>
          {String(error?.message ?? error)}
          {'\n\n'}
          {String(error?.stack ?? '').split('\n').slice(0, 12).join('\n')}
        </RNText>
      </ScrollView>
      <Pressable
        onPress={retry}
        accessibilityRole="button"
        style={{ marginTop: 16, minHeight: 48, borderRadius: 8, backgroundColor: '#1FC7B6', alignItems: 'center', justifyContent: 'center' }}
      >
        <RNText style={{ color: '#0E1113', fontSize: 16, fontWeight: '700' }}>Opnieuw proberen</RNText>
      </Pressable>
    </View>
  );
}
