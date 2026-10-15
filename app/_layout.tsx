import { Stack } from 'expo-router';
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
