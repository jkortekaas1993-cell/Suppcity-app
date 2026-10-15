import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { makeTheme, type ColorScheme, type Theme } from './theme';

const ThemeContext = createContext<Theme>(makeTheme('dark'));

interface ThemeProviderProps {
  children: ReactNode;
  /** Force a scheme (tests, previews). Defaults to the OS setting, dark as fallback. */
  scheme?: ColorScheme;
}

export function ThemeProvider({ children, scheme }: ThemeProviderProps) {
  const system = useColorScheme();
  const resolved: ColorScheme = scheme ?? (system === 'light' ? 'light' : 'dark');
  const theme = useMemo(() => makeTheme(resolved), [resolved]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
