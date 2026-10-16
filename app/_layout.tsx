import { useFonts } from 'expo-font';
import { SplashScreen, Stack, type ErrorBoundaryProps } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text as RNText, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppServices } from '@/integration';
import { DatabaseProvider } from '@/lib/db';
import { FONT_ASSETS, FONT_LOAD_TIMEOUT_MS, ThemeProvider, useTheme } from '@/ui';

// Keep the native splash up until Barlow is registered (or we give up waiting, see below).
SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RootStack() {
  const { colors } = useTheme();
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg0 },
        }}
      >
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}

/**
 * Fonts gate: render as soon as the fonts loaded, failed, or FONT_LOAD_TIMEOUT_MS passed.
 * Without fonts the theme falls back to the system font, so the app never hangs on the splash.
 * If the fonts arrive after the timeout, the theme switches to Barlow on that render.
 */
function useFontsReady(): { ready: boolean; fontsLoaded: boolean } {
  const [loaded, error] = useFonts(FONT_ASSETS);
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), FONT_LOAD_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, []);
  const ready = loaded || error != null || timedOut;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);
  return { ready, fontsLoaded: loaded };
}

export default function RootLayout() {
  const { ready, fontsLoaded } = useFontsReady();
  if (!ready) return null;
  return (
    <SafeAreaProvider>
      <ThemeProvider scheme="dark" fontsLoaded={fontsLoaded}>
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
    <View style={{ flex: 1, backgroundColor: '#08090A', padding: 24, paddingTop: 72 }}>
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
